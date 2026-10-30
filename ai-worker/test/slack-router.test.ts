import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import worker from '../src/index.ts'
const origin='https://lunch.example.test',issuer='https://clerk.example.test'
const keys=await generateKeyPair('RS256'),jwk=await exportJWK(keys.publicKey)
async function request(path:string,expired=false){
 const now=Math.floor(Date.now()/1000)
 const token=await new SignJWT({sub:'user_owner',iss:issuer,azp:origin,nbf:now-120,exp:now+(expired?-60:600)}).setProtectedHeader({alg:'RS256',kid:'slack-test'}).sign(keys.privateKey)
 return new Request(`https://worker.example.test${path}`,{method:'POST',headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(path.includes('link-account')?{member_id:'U0123456789'}:{menu_id:'11111111-1111-4111-8111-111111111111'})})
}
function env(){return {CLERK_ISSUER:issuer,ALLOWED_ORIGINS:origin,SUPABASE_URL:'https://db.example.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SLACK_WORKSPACE_ID:'T0123456789',SLACK_ORDER_CHANNEL_ID:'C0123456789',SLACK_GENERAL_CHANNEL_ID:'C9876543210',APP_PUBLIC_BASE_URL:origin,SLACK_NAMESPACE:'offline',SLACK_BOT_TOKEN:'fake',SLACK_RECEIPT_SIGNING_KEY:'receipt-signing-key-at-least-32-characters',SLACK_USER_RATE_LIMITER:{limit:async()=>({success:true})},SLACK_SERVICE_RATE_LIMITER:{limit:async()=>({success:true})},USER_RATE_LIMITER:{limit:async()=>({success:false})},SERVICE_RATE_LIMITER:{limit:async()=>{throw Error('AI limiter must not run for Slack')}}} as unknown as Env}
function fetchMock(){return mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{
 const url=String(input)
 if(url===`${issuer}/.well-known/jwks.json`)return Response.json({keys:[{...jwk,kid:'slack-test',alg:'RS256',use:'sig'}]})
 if(url==='https://slack.com/api/users.info')return Response.json({ok:true,user:{id:'U0123456789',team_id:'T0123456789',real_name:'Member'}})
 // PostgREST answers void RPCs with 204 No Content.
 if(url==='https://db.example.test/rest/v1/rpc/link_lunch_slack_account')return new Response(null,{status:204})
 throw Error(`unexpected ${url}`)
})}
test('Slack route rejects missing and expired credentials before Slack calls',async()=>{
 const mocked=fetchMock()
 try{
  const missing=await request('/v1/slack/publish');missing.headers.delete('authorization')
  assert.equal((await worker.fetch(missing,env(),{} as ExecutionContext)).status,401)
  assert.equal((await worker.fetch(await request('/v1/slack/publish',true),env(),{} as ExecutionContext)).status,401)
  assert.equal(mocked.mock.calls.length,1)
 }finally{mocked.mock.restore()}
})
test('Slack works while AI quota is exhausted and links only checked workspace members',async()=>{
 const mocked=fetchMock()
 try{const response=await worker.fetch(await request('/v1/slack/link-account'),env(),{} as ExecutionContext);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'linked',memberId:'U0123456789',name:'Member'})}finally{mocked.mock.restore()}
})
test('missing Slack secrets cannot disable the AI route',async()=>{
 const mocked=fetchMock()
 try{const current=env();delete (current as unknown as Record<string,unknown>).SLACK_BOT_TOKEN;assert.equal((await worker.fetch(await request('/v1/feedback-suggestions'),current,{} as ExecutionContext)).status,429)}finally{mocked.mock.restore()}
})
test('Slack rejects unsupported paths, query strings, methods and origins',async()=>{
 const current=env()
 for(const path of ['/v1/slack/no-such-route','/v1/slack/publish?channel=C123'])assert.equal((await worker.fetch(await request(path),current,{} as ExecutionContext)).status,404)
 const foreign=await request('/v1/slack/publish');foreign.headers.set('origin','https://attacker.test')
 assert.equal((await worker.fetch(foreign,current,{} as ExecutionContext)).status,403)
 assert.equal((await worker.fetch(new Request('https://worker.example.test/v1/slack/publish',{headers:{origin}}),current,{} as ExecutionContext)).status,405)
})
