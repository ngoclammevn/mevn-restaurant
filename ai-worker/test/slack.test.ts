import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPickupMessage, buildMenuMessage } from '../src/slack/messages.ts'
import { signReceipt, verifyReceipt } from '../src/slack/receipts.ts'
import { sendSlack, SlackError } from '../src/slack/client.ts'
import { parseSlackBody } from '../src/slack/router.ts'

test('builders allowlist public fields and escape untrusted mentions', () => {
 const menu = {id:'menu-1',title:'<@UFAKE> & cơm',image_url:null,phone_e164:'+84901234567',payment_info:'secret'}
 const message=JSON.stringify(buildPickupMessage(menu,{primary_user_id:'b',backup_user_id:'c',phone_e164:'+84901234567'},{b:'U0123456789',c:'U0987654321'}))
 assert.match(message,/<@U0123456789>/); assert.doesNotMatch(message,/84901234567|U0987654321|secret|<@UFAKE>/)
 assert.doesNotMatch(JSON.stringify(buildMenuMessage(menu,'https://lunch.example.test')),/secret|84901234567/)
})
test('HMAC receipts reject changes, foreign namespace, channel and revision', async () => {
 const scope={namespace:'test',workspace:'T123',channel:'C123',resource:'menu-1',kind:'published',revision:1}
 const receipt=await signReceipt({...scope,ts:'123.456'},'long-secret-key-at-least-32-characters')
 assert.ok(await verifyReceipt(receipt,'long-secret-key-at-least-32-characters',scope))
 for(const override of [{namespace:'production'},{channel:'C999'},{revision:2}]) assert.equal(await verifyReceipt(receipt,'long-secret-key-at-least-32-characters',{...scope,...override}),false)
 assert.equal(await verifyReceipt({...receipt,payload:{...receipt.payload,ts:'999.999'}},'long-secret-key-at-least-32-characters',scope),false)
})
test('Slack handles 429, definitive API errors, and ambiguous timeout without retry', async () => {
 let count=0
 const result=await sendSlack('chat.postMessage',{text:'safe'},{token:'test',fetcher:async()=>{count++;return Response.json({ok:true,ts:'1.2'})}})
 assert.equal(result.ts,'1.2');assert.equal(count,1)
 await assert.rejects(sendSlack('chat.postMessage',{}, {token:'test',fetcher:async()=>new Response('',{status:429,headers:{'Retry-After':'12'}})}),(e:unknown)=>e instanceof SlackError&&e.status==='retryable'&&e.retryAfter===12)
 await assert.rejects(sendSlack('chat.postMessage',{}, {token:'test',fetcher:async()=>Response.json({ok:false,error:'missing_scope'})}),(e:unknown)=>e instanceof SlackError&&e.status==='retryable'&&e.code==='missing_scope')
 count=0
 await assert.rejects(sendSlack('chat.postMessage',{}, {token:'test',timeoutMs:2,fetcher:async()=>{count++;return new Promise(()=>{})}}),(e:unknown)=>e instanceof SlackError&&e.status==='unknown')
 assert.equal(count,1)
})
test('Slack bodies reject private arbitrary data and oversized bodies',async()=>{
 const req=(body:unknown)=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 assert.deepEqual(await parseSlackBody(req({menu_id:'11111111-1111-4111-8111-111111111111'}),'publish'),{menu_id:'11111111-1111-4111-8111-111111111111'})
 for(const value of [{menu_id:'bad'},{menu_id:'11111111-1111-4111-8111-111111111111',channel:'C123'},{member_id:'email@example.test'}]) await assert.rejects(parseSlackBody(req(value),'publish'))
 await assert.rejects(parseSlackBody(req({extra:'a'.repeat(8193)}),'publish'))
})
