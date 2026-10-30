import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dispatchNotification } from '../src/slack/service.ts'
import { signReceipt } from '../src/slack/receipts.ts'
import type { SlackEnv } from '../src/slack/config.ts'
import { HttpError } from '../src/http.ts'
const MENU='11111111-1111-4111-8111-111111111111'
const EVENT='22222222-2222-4222-8222-222222222222'
const config={issuer:'https://clerk.test',origins:['https://lunch.test'],supabaseUrl:'https://db.test',publishableKey:'sb_publishable_test'}
const env={SLACK_WORKSPACE_ID:'T0123456789',SLACK_ORDER_CHANNEL_ID:'C0123456789',SLACK_GENERAL_CHANNEL_ID:'C9876543210',APP_PUBLIC_BASE_URL:'https://lunch.test',SLACK_NAMESPACE:'offline',SLACK_BOT_TOKEN:'fake-bot-token',SLACK_RECEIPT_SIGNING_KEY:'test-secret-key-at-least-32-characters'} as Env & SlackEnv
const now=new Date('2026-10-29T04:00:00Z')
type Row=Record<string,unknown>
async function fixture(overrides:Row={},slackReply?:(method:string,payload:Row)=>Promise<Response>){
 const menu:Row={id:MENU,poster_id:'user_owner',title:'Cơm',menu_date:'2026-10-29',is_closed:false,current_closure_id:null,reminder_at:null,reminder_version:0,...overrides}
 const events=new Map<string,Row>()
 const calls:{method:string;payload:Row}[]=[]
 const rootReceipt=await signReceipt({namespace:'offline',workspace:env.SLACK_WORKSPACE_ID,channel:env.SLACK_ORDER_CHANNEL_ID,resource:'2026-10-29',kind:'daily_root',revision:1,ts:'123.001'},env.SLACK_RECEIPT_SIGNING_KEY)
 let root:Row={id:'root',status:'sent',receipt:rootReceipt}
 let pickup:Row|undefined
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input)),headers=new Headers(init?.headers),body=init?.body?JSON.parse(String(init.body)):{}
  if(url.origin==='https://slack.com'){
   assert.equal(headers.get('Authorization'),'Bearer fake-bot-token')
   calls.push({method:url.pathname.split('/').at(-1)!,payload:body})
   return slackReply?slackReply(url.pathname.split('/').at(-1)!,body):Response.json({ok:true,channel:body.channel,ts:'123.002',scheduled_message_id:'Q123'})
  }
  assert.equal(url.origin,'https://db.test');assert.equal(headers.get('Authorization'),'Bearer caller-jwt');assert.equal(headers.get('apikey'),'sb_publishable_test')
  const table=url.pathname.split('/').at(-1)!
  if(url.pathname.includes('/rpc/')){
   if(table==='enqueue_lunch_notification'){
    const key=`${body.p_kind}:${body.p_revision}`
    if(!events.has(key))events.set(key,{id:EVENT,menu_id:MENU,namespace:'offline',kind:body.p_kind,revision:body.p_revision,status:'pending'})
    return Response.json(events.get(key))
   }
   if(table==='claim_lunch_notification'){
    const event=[...events.values()].find(e=>e.id===body.p_event_id)!
    if(event.status==='pending'||event.status==='retryable'){event.status='sending';event.claim_nonce='nonce';return Response.json(event)}
    return Response.json({...event,claim_nonce:null})
   }
   if(table==='finish_lunch_notification'){
    const event=[...events.values()].find(e=>e.id===body.p_event_id)!
    assert.equal(body.p_claim_nonce,event.claim_nonce)
    Object.assign(event,{status:body.p_status,receipt:body.p_receipt,claim_nonce:null,last_error_code:body.p_error_code,next_attempt_at:body.p_retry_after})
    return Response.json(event)
   }
   if(table==='claim_lunch_daily_thread')return Response.json(root)
   if(table==='finish_lunch_daily_thread'){root={...root,status:body.p_status,receipt:body.p_receipt};return Response.json(root)}
   if(table==='invalidate_lunch_notification'){const event=[...events.values()].find(e=>e.id===body.p_event_id)!;event.status='unknown';return Response.json(null)}
   if(table==='mark_lunch_schedule_cancelled'){const event=[...events.values()].find(e=>e.id===body.p_event_id)!;event.status=body.p_cancelled?'cancelled':'cancel_pending';return Response.json(null)}
   throw Error(`unexpected RPC ${table}`)
  }
  if(table==='menus')return Response.json([menu])
  if(table==='menu_pickups')return Response.json(pickup?[pickup]:[])
  if(table==='menu_closures')return Response.json([{id:'closure',revision:1}])
  if(table==='slack_profile_links')return Response.json([])
  if(table==='profiles')return Response.json([{full_name:'Người nhận'}])
  if(table==='slack_daily_threads')return Response.json([root])
  if(table==='slack_notifications'){
   let rows=[...events.values()]
   if(url.searchParams.has('id'))rows=rows.filter(e=>`eq.${e.id}`===url.searchParams.get('id'))
   if(url.searchParams.get('kind')==='eq.reminder_schedule')rows=rows.filter(e=>e.kind==='reminder_schedule'&&['sent','cancel_pending','unknown'].includes(String(e.status)))
   return Response.json(rows)
  }
  throw Error(`unexpected table ${table}`)
 }
 const send=(action='publish',body:Row={menu_id:MENU},subject='user_owner')=>dispatchNotification({subject,token:'caller-jwt',action:action as never,body},env,{config,fetcher,now})
 return {send,menu,calls,events,setRoot:(value:Row)=>{root=value},setPickup:(value:Row)=>{pickup=value}}
}
test('durable sent receipt deduplicates repeated publish and never uses AI',async()=>{
 const f=await fixture()
 assert.equal((await f.send()).status,'sent');assert.equal((await f.send()).status,'sent');assert.equal(f.calls.length,1)
 assert.equal(f.calls[0].method,'chat.postMessage');assert.equal(f.calls[0].payload.thread_ts,'123.001')
 assert.doesNotMatch(JSON.stringify(f.calls),/caller-jwt|phone|payment_info/)
})
test('foreign owner rejected and received requires current primary with completed domain state',async()=>{
 const f=await fixture({is_closed:true,current_closure_id:'closure'})
 f.setPickup({id:'pickup',primary_user_id:'user_primary',backup_user_id:'user_backup',version:2,status:'received'})
 await assert.rejects(f.send('publish',{menu_id:MENU},'user_stranger'),(e:unknown)=>e instanceof HttpError&&e.status===403)
 await assert.rejects(f.send('received',{menu_id:MENU},'user_backup'),(e:unknown)=>e instanceof HttpError&&e.status===403)
 assert.equal((await f.send('received',{menu_id:MENU},'user_primary')).status,'sent')
 f.setPickup({id:'pickup',primary_user_id:'new_primary',version:3,status:'assigned'})
 await assert.rejects(f.send('received',{menu_id:MENU},'user_primary'))
})
test('forged event receipt cannot be used as successful delivery',async()=>{
 const f=await fixture();await f.send();const event=[...f.events.values()][0];event.receipt={payload:{ts:'999.999'},signature:'fake'}
 assert.equal((await f.send()).status,'unknown');assert.equal(f.calls.length,1);assert.equal(event.status,'unknown')
})
test('ambiguous send persists unknown and a second click never resends',async()=>{
 const f=await fixture({},async()=>{throw Error('connection reset after accepted')})
 assert.equal((await f.send()).status,'unknown');assert.equal((await f.send()).status,'unknown');assert.equal(f.calls.length,1)
})
test('in-flight claim prevents a second sender from posting',async()=>{
 const f=await fixture();f.events.set('published:1',{id:EVENT,menu_id:MENU,namespace:'offline',kind:'published',revision:1,status:'sending',claim_nonce:'another-claim'})
 assert.equal((await f.send()).status,'sending');assert.equal(f.calls.length,0)
})
test('Slack 429 persists retry delay without guessing success',async()=>{
 const f=await fixture({},async()=>new Response('',{status:429,headers:{'retry-after':'45'}}))
 const result=await f.send();assert.equal(result.status,'retryable');assert.equal(result.retryAfter,45);assert.equal([...f.events.values()][0].next_attempt_at,45)
})
test('daily root ambiguous outcome prevents menu reply',async()=>{
 const f=await fixture({},async()=>{throw Error('network')});f.setRoot({id:'root',status:'sending',claim_nonce:'root-nonce'})
 assert.equal((await f.send()).status,'unknown');assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.thread_ts,undefined)
})
test('schedules are durable and contain no Slack metadata; replacement cancels first',async()=>{
 const f=await fixture({reminder_at:'2026-10-29T05:00:00Z',reminder_version:1})
 assert.equal((await f.send('reminder')).status,'sent');assert.equal(f.calls[0].method,'chat.scheduleMessage');assert.equal(f.calls[0].payload.metadata,undefined)
 assert.equal(f.calls[0].payload.post_at,Date.parse('2026-10-29T05:00:00Z')/1000)
 f.menu.reminder_version=2;f.menu.reminder_at='2026-10-29T06:00:00Z';[...f.events.values()][0].id='old-event'
 assert.equal((await f.send('reminder')).status,'sent')
 assert.deepEqual(f.calls.map(c=>c.method),['chat.scheduleMessage','chat.deleteScheduledMessage','chat.scheduleMessage'])
})
test('disabling cancels acknowledged schedule and failed cancellation stays visible',async()=>{
 let fail=false
 const f=await fixture({reminder_at:'2026-10-29T05:00:00Z',reminder_version:1},async(method,payload)=>method==='chat.deleteScheduledMessage'&&fail?Response.json({ok:false,error:'missing_scope'}):Response.json({ok:true,channel:payload.channel,ts:'123.002',scheduled_message_id:'Q123'}))
 await f.send('reminder');[...f.events.values()][0].id='old-event';f.menu.reminder_version=2;f.menu.reminder_at=null;fail=true
 const result=await f.send('reminder');assert.equal(result.status,'retryable');assert.equal(f.events.get('reminder_schedule:1')?.status,'cancel_pending')
})
test('past, foreign-day and unassigned pickup sends are rejected without post',async()=>{
 const f=await fixture({reminder_at:'2026-10-29T03:00:00Z',reminder_version:1})
 assert.equal((await f.send('reminder')).status,'retryable');assert.equal(f.calls.length,0)
 f.menu.is_closed=true;f.menu.current_closure_id='closure';f.setPickup({status:'unassigned',version:1})
 await assert.rejects(f.send('pickup-changed'));assert.equal(f.calls.length,0)
})

test('closed notification without volunteers posts useful text without a person mention',async()=>{
 const f=await fixture({is_closed:true,current_closure_id:'closure',title:'Cơm <@UFAKE>'})
 f.setPickup({id:'pickup',status:'unassigned',primary_user_id:null,backup_user_id:null,version:1})
 assert.equal((await f.send('closed')).status,'sent')
 assert.equal(f.calls.length,1)
 const payload=JSON.stringify(f.calls[0].payload)
 assert.match(payload,/Đã chốt menu/);assert.match(payload,/Chưa phân công người nhận cơm/)
 assert.match(payload,/https:\/\/lunch.test\/menu\//);assert.doesNotMatch(payload,/<@|Người nhận chưa liên kết Slack|Người nhận"/)
 await assert.rejects(f.send('pickup-changed'),(e:unknown)=>e instanceof HttpError&&e.code==='pickup_unassigned')
 await assert.rejects(f.send('received'),(e:unknown)=>e instanceof HttpError&&e.code==='pickup_unassigned')
 assert.equal(f.calls.length,1)
})
test('menu publish and share include the public menus bucket used by app uploads',async()=>{
 for(const action of ['publish','share']){
  const image_url='https://db.test/storage/v1/object/public/menus/user_owner/menu-photo.jpg'
  const f=await fixture({image_url})
  assert.equal((await f.send(action)).status,'sent')
  const images=(f.calls[0].payload.blocks as Row[]).filter(block=>block.type==='image')
  assert.deepEqual(images,[{type:'image',image_url,alt_text:'Ảnh menu'}])
 }
})
test('menu image blocks exclude other origins buckets queries and fragments',async()=>{
 for(const image_url of [
  'https://elsewhere.test/storage/v1/object/public/menus/photo.jpg',
  'https://db.test/storage/v1/object/public/menu-images/photo.jpg',
  'https://db.test/storage/v1/object/public/menus-private/photo.jpg',
  'https://db.test/storage/v1/object/public/menus/photo.jpg?download=1',
  'https://db.test/storage/v1/object/public/menus/photo.jpg#fragment',
  'https://db.test/storage/v1/object/sign/menus/photo.jpg',
 ]){
  const f=await fixture({image_url});assert.equal((await f.send()).status,'sent')
  assert.equal((f.calls[0].payload.blocks as Row[]).some(block=>block.type==='image'),false,image_url)
 }
})
