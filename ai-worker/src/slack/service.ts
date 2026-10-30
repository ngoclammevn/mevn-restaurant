import { HttpError, isRecord, type Config } from '../http.ts'
import { sendSlack, SlackError } from './client.ts'
import { readSlackConfig, type SlackEnv } from './config.ts'
import { slackDatabase, type SlackDatabase } from './database.ts'
import { buildMenuMessage, buildPickupMessage, menuLink } from './messages.ts'
import { signReceipt, verifyReceipt, type Receipt, type ReceiptScope } from './receipts.ts'
export type Action='publish'|'share'|'closed'|'reopened'|'pickup-changed'|'received'|'reminder'|'retry'|'resolve'|'link-account'|'sync'
type Row=Record<string,unknown>
function one(value:unknown):Row {const row=Array.isArray(value)?value[0]:value;if(!isRecord(row))throw new HttpError(409,'slack_state_unavailable');return row}
const kinds:Record<string,string>={publish:'published',share:'shared',closed:'closed',reopened:'reopened','pickup-changed':'pickup_changed',received:'received',reminder:'reminder_schedule'}
export async function dispatchNotification(input:{subject:string;token:string;eventId?:string;action?:Action;body?:Row},env:Env & SlackEnv,options:{fetcher?:typeof fetch;now?:Date;config:Config}):Promise<Record<string,unknown>> {
 const sc=readSlackConfig(env),db=slackDatabase(options.config,input.token,options.fetcher),body=input.body??{}
 const rpc=async(name:string,args:Row)=>one(await db.rpc(name,args))
 if(input.action==='link-account'){
  const result=await sendSlack('users.info',{user:body.member_id},{token:sc.token,fetcher:options.fetcher})
  const user=one(result.user)
  if(user.id!==body.member_id||user.team_id!==sc.workspace||user.deleted||user.is_bot)throw new HttpError(400,'invalid_slack_member')
  await db.rpc('link_lunch_slack_account',{p_workspace_id:sc.workspace,p_slack_user_id:user.id})
  return {status:'linked',memberId:user.id,name:typeof user.real_name==='string'?user.real_name.slice(0,100):String(user.name??'')}
 }
 let event:Row|undefined
 if(input.eventId||body.event_id){
  event=(await db.rows('slack_notifications',{select:'*',id:`eq.${input.eventId??body.event_id}`,namespace:`eq.${sc.namespace}`,limit:'1'}))[0]
  if(!event)throw new HttpError(403,'forbidden')
 }
 const menuId=String(event?.menu_id??body.menu_id??'')
 const menu=(await db.rows('menus',{select:'id,poster_id,title,menu_date,image_url,is_closed,current_closure_id,reminder_at,reminder_version',id:`eq.${menuId}`,limit:'1'}))[0]
 if(!menu)throw new HttpError(403,'forbidden')
 const pickup=menu.current_closure_id?(await db.rows('menu_pickups',{select:'id,closure_id,menu_id,primary_user_id,backup_user_id,version,status,received_at',closure_id:`eq.${menu.current_closure_id}`,limit:'1'}))[0]:undefined
 const requestedKind=String(event?.kind??kinds[input.action??'publish'])
 const isOwner=menu.poster_id===input.subject
 if(!isOwner&&!(requestedKind==='received'&&pickup?.primary_user_id===input.subject))throw new HttpError(403,'forbidden')
 if(input.action==='resolve'){
  if(!isOwner||event?.namespace!==sc.namespace)throw new HttpError(403,'forbidden')
  if(body.resolution==='not_sent'&&event?.last_error_code==='daily_thread_unavailable')await db.rpc('resolve_lunch_daily_thread',{p_menu_id:menuId,p_namespace:sc.namespace,p_workspace_id:sc.workspace,p_channel_id:sc.orderChannel})
  const resolved=await rpc('resolve_lunch_notification',{p_event_id:event.id,p_resolution:body.resolution})
  return {status:resolved.status,eventId:event.id,warning:body.resolution==='not_sent'?'retry_may_duplicate':undefined}
 }
 if(input.action==='sync'){
  // Browser supplies only its own menu IDs. Each action is rechecked on the server.
  const pending=await db.rows('slack_notifications',{select:'id,kind,status,next_attempt_at',menu_id:`eq.${menuId}`,namespace:`eq.${sc.namespace}`,status:'in.(pending,retryable,cancel_pending,sending,unknown)',limit:'40'})
  return {status:'pending',namespace:sc.namespace,events:pending}
 }
 const closure=menu.current_closure_id?(await db.rows('menu_closures',{select:'id,revision',id:`eq.${menu.current_closure_id}`,limit:'1'}))[0]:undefined
 const currentRevision=Number(closure?.revision??0)
 let revision=requestedKind==='published'||requestedKind==='shared'?1:requestedKind==='pickup_changed'||requestedKind==='received'?Number(pickup?.version??0):requestedKind.startsWith('reminder_')?Number(menu.reminder_version):currentRevision
 // Each pickup version is scoped to a closure; use closure revision as high digits.
 if(requestedKind==='pickup_changed'||requestedKind==='received')revision=currentRevision*100000+revision
 if(body.revision!==undefined&&Number(body.revision)!==revision)throw new HttpError(409,'stale_revision')
 if(event&&Number(event.revision)!==revision&&requestedKind!=='reminder_cancel')throw new HttpError(409,'stale_revision')
 if(requestedKind==='closed'&&(!menu.is_closed||!pickup))throw new HttpError(409,'pickup_unassigned')
 if(['pickup_changed','received'].includes(requestedKind)&&(!menu.is_closed||!pickup||pickup.status==='unassigned'||!pickup.primary_user_id))throw new HttpError(409,'pickup_unassigned')
 if(requestedKind==='received'&&pickup?.status!=='received')throw new HttpError(409,'not_received')
 if(requestedKind==='reopened'&&menu.is_closed)throw new HttpError(409,'stale_revision')
 if(!event)event=await rpc('enqueue_lunch_notification',{p_menu_id:menuId,p_kind:requestedKind,p_revision:revision,p_namespace:sc.namespace})
 const channel=requestedKind==='shared'?sc.generalChannel:sc.orderChannel
 const scope:ReceiptScope={namespace:sc.namespace,workspace:sc.workspace,channel,resource:menuId,kind:requestedKind,revision:Number(event.revision)}
 const validReceipt=async(e:Row,s:ReceiptScope)=>await verifyReceipt(e.receipt,sc.key,s)
 if(event.status==='sent'){
  if(!await validReceipt(event,scope)){await db.rpc('invalidate_lunch_notification',{p_event_id:event.id});return {status:'unknown',eventId:event.id,error:'invalid_receipt'}}
  return delivery(event,sc.workspace,channel)
 }
 if(event.status==='cancelled')return {status:'cancelled',eventId:event.id}
 event=await rpc('claim_lunch_notification',{p_event_id:event.id})
 if(!event.claim_nonce)return {status:event.status,eventId:event.id}
 const finish=async(status:string,receipt:unknown=null,error?:string,retryAfter?:number)=>rpc('finish_lunch_notification',{p_event_id:event!.id,p_claim_nonce:event!.claim_nonce,p_status:status,p_receipt:receipt,p_error_code:error??null,p_retry_after:retryAfter??null})
 try{
  // Cancel acknowledged schedules before replacing, disabling, or closing a menu.
  if(['closed','reopened','reminder_schedule','reminder_cancel'].includes(requestedKind))await cancelSchedules(db,menu,sc,options.fetcher,requestedKind==='reminder_schedule'?Number(event.revision):undefined,options.now)
  if(requestedKind==='reminder_cancel'||requestedKind==='reminder_schedule'&&(!menu.reminder_at||menu.is_closed)){
   const receipt=await signReceipt(scope,sc.key)
   await finish('cancelled',receipt);return {status:'cancelled',eventId:event.id}
  }
  const thread=requestedKind==='shared'?undefined:await ensureThread(db,menu,sc,input.subject,isOwner,options.fetcher)
  if(thread?.status!=='sent'&&requestedKind!=='shared'){
   await finish(thread?.status==='unknown'?'unknown':'retryable',null,'daily_thread_unavailable',30)
   return {status:thread?.status==='unknown'?'unknown':'retryable',eventId:event.id,error:'daily_thread_unavailable'}
  }
  let message:Row=buildMenuMessage(menu,sc.base)
  if(['closed','pickup_changed','received'].includes(requestedKind)&&pickup?.primary_user_id){
   const rows=await db.rows('slack_profile_links',{select:'user_id,slack_user_id',workspace_id:`eq.${sc.workspace}`,user_id:`eq.${pickup.primary_user_id}`,limit:'1'})
   const links:Record<string,string>={}
   // Links may be forged through the self-owned table: revalidate membership before mentioning.
   for(const row of rows){try{const checked=await sendSlack('users.info',{user:row.slack_user_id},{token:sc.token,fetcher:options.fetcher});const user=one(checked.user);if(user.team_id===sc.workspace&&user.id===row.slack_user_id&&!user.deleted&&!user.is_bot)links[String(row.user_id)]=String(row.slack_user_id)}catch{}}
   const names=await db.rows('profiles',{select:'id,full_name',id:`eq.${pickup.primary_user_id}`,limit:'1'})
   message=buildPickupMessage(menu,{...pickup,primary_name:names[0]?.full_name},links,sc.base)
  }else if(requestedKind==='closed'&&pickup)message=buildPickupMessage(menu,pickup,{},sc.base)
  else if(requestedKind==='reopened')message={text:`Menu đã mở lại — ${menuLink(menu,sc.base)}`,unfurl_links:false}
  if(['published','shared'].includes(requestedKind)&&typeof menu.image_url==='string'){try{const image=new URL(menu.image_url);if(image.origin===options.config.supabaseUrl&&image.pathname.startsWith('/storage/v1/object/public/menus/')&&!image.search&&!image.hash){message.blocks=[...(Array.isArray(message.blocks)?message.blocks:[]),{type:'image',image_url:image.href,alt_text:'Ảnh menu'}]}}catch{}}
  const payload:Row={...message,channel,...(thread?{thread_ts:thread.ts}:{})}
  let method:'chat.postMessage'|'chat.scheduleMessage'='chat.postMessage'
  if(requestedKind==='reminder_schedule'){
   const at=new Date(String(menu.reminder_at)),now=options.now??new Date()
   if(!Number.isFinite(at.getTime())||at.getTime()<=now.getTime()+60000||at.getTime()>now.getTime()+120*86400000||new Date(at.getTime()+7*3600000).toISOString().slice(0,10)!==menu.menu_date)throw new HttpError(400,'invalid_reminder_time')
   method='chat.scheduleMessage';payload.post_at=Math.floor(at.getTime()/1000)
   payload.text=`Nếu chưa đặt, mở menu kiểm tra còn nhận đơn — ${menuLink(menu,sc.base)}`;delete payload.blocks
   // Slack warns metadata can prevent scheduled delivery. Never include metadata.
  }
  const ack=await sendSlack(method,payload,{token:sc.token,fetcher:options.fetcher})
  if(ack.channel!==channel||method==='chat.postMessage'&&(typeof ack.ts!=='string'||!/^\d+\.\d+$/.test(ack.ts))||method==='chat.scheduleMessage'&&typeof ack.scheduled_message_id!=='string')throw new SlackError('unknown','slack_invalid_ack')
  const receipt=await signReceipt({...scope,...(method==='chat.scheduleMessage'?{scheduled_message_id:String(ack.scheduled_message_id),post_at:Number(payload.post_at)}:{ts:String(ack.ts)})},sc.key)
  // If persistence fails after Slack ACK, never downgrade to retryable.
  try{const saved=await finish('sent',receipt);return delivery(saved,sc.workspace,channel)}catch{return {status:'unknown',eventId:event.id,error:'receipt_persistence_unknown'}}
 }catch(error){
  const state=error instanceof SlackError?error.status:error instanceof HttpError?'retryable':'unknown'
  const code=error instanceof SlackError||error instanceof HttpError?error.code:'delivery_unknown'
  const after=error instanceof SlackError?error.retryAfter:undefined
  try{await finish(state,null,code,after)}catch{}
  return {status:state,eventId:event.id,error:code,retryAfter:after}
 }
}
function delivery(event:Row,workspace:string,channel:string){const receipt=event.receipt as Receipt;const ts=receipt?.payload?.ts;return {status:event.status,eventId:event.id,slackUrl:ts?`https://app.slack.com/client/${workspace}/${channel}/thread/${channel}-${ts}`:undefined}}
async function ensureThread(db:SlackDatabase,menu:Row,sc:ReturnType<typeof readSlackConfig>,_subject:string,owner:boolean,fetcher?:typeof fetch){
 const scope:ReceiptScope={namespace:sc.namespace,workspace:sc.workspace,channel:sc.orderChannel,resource:String(menu.menu_date),kind:'daily_root',revision:1}
 let row:Row
 if(owner)row=one(await db.rpc('claim_lunch_daily_thread',{p_namespace:sc.namespace,p_workspace_id:sc.workspace,p_menu_date:menu.menu_date,p_channel_id:sc.orderChannel}))
 else row=(await db.rows('slack_daily_threads',{select:'*',namespace:`eq.${sc.namespace}`,workspace_id:`eq.${sc.workspace}`,menu_date:`eq.${menu.menu_date}`,channel_id:`eq.${sc.orderChannel}`,limit:'1'}))[0]??{status:'unknown'}
 if(row.status==='sent'){if(await verifyReceipt(row.receipt,sc.key,scope)&&typeof(row.receipt as Receipt).payload.ts==='string')return {status:'sent',ts:(row.receipt as Receipt).payload.ts};if(owner)await db.rpc('invalidate_lunch_daily_thread',{p_thread_id:row.id});return {status:'unknown'}}
 if(!row.claim_nonce)return {status:row.status}
 try{
 const ack=await sendSlack('chat.postMessage',{channel:sc.orderChannel,text:`Đặt cơm trưa · ${menu.menu_date}`,unfurl_links:false},{token:sc.token,fetcher})
 if(ack.channel!==sc.orderChannel||typeof ack.ts!=='string'||!/^\d+\.\d+$/.test(ack.ts))throw new SlackError('unknown','slack_invalid_ack')
 const receipt=await signReceipt({...scope,ts:ack.ts},sc.key)
 try{await db.rpc('finish_lunch_daily_thread',{p_thread_id:row.id,p_claim_nonce:row.claim_nonce,p_status:'sent',p_receipt:receipt})}catch{return {status:'unknown'}}
 return {status:'sent',ts:ack.ts}
 }catch(error){const status=error instanceof SlackError?error.status:'unknown';try{await db.rpc('finish_lunch_daily_thread',{p_thread_id:row.id,p_claim_nonce:row.claim_nonce,p_status:status,p_receipt:null,p_retry_after:error instanceof SlackError?error.retryAfter??null:null})}catch{}return {status}}
}
async function cancelSchedules(db:SlackDatabase,menu:Row,sc:ReturnType<typeof readSlackConfig>,fetcher?:typeof fetch,keepRevision?:number,now=new Date()){
 const events=await db.rows('slack_notifications',{select:'*',menu_id:`eq.${menu.id}`,namespace:`eq.${sc.namespace}`,kind:'eq.reminder_schedule',status:'in.(sent,cancel_pending,unknown,sending)',limit:'100'})
 for(const event of events){
  if(Number(event.revision)===keepRevision)continue
  if(event.status==='unknown'||event.status==='sending')throw new SlackError('unknown','reminder_schedule_unknown')
  const scope:ReceiptScope={namespace:sc.namespace,workspace:sc.workspace,channel:sc.orderChannel,resource:String(menu.id),kind:'reminder_schedule',revision:Number(event.revision)}
  if(!await verifyReceipt(event.receipt,sc.key,scope))throw new SlackError('unknown','invalid_reminder_receipt')
  const payload=(event.receipt as Receipt).payload
  if(!payload.scheduled_message_id)continue
  if(payload.post_at&&payload.post_at<=now.getTime()/1000)continue
  try{await sendSlack('chat.deleteScheduledMessage',{channel:sc.orderChannel,scheduled_message_id:payload.scheduled_message_id},{token:sc.token,fetcher})}
  catch(error){await db.rpc('mark_lunch_schedule_cancelled',{p_event_id:event.id,p_cancelled:false});throw error}
  await db.rpc('mark_lunch_schedule_cancelled',{p_event_id:event.id,p_cancelled:true})
 }
}
