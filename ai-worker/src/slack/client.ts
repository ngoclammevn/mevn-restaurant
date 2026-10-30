import { isRecord, readBoundedJson } from '../http.ts'
export class SlackError extends Error {
 constructor(public status:'retryable'|'unknown',public code:string,public retryAfter?:number){super(code)}
}
export async function sendSlack(method:'chat.postMessage'|'chat.scheduleMessage'|'chat.deleteScheduledMessage'|'users.info',payload:Record<string,unknown>,options:{token:string;fetcher?:typeof fetch;timeoutMs?:number}):Promise<Record<string,unknown>> {
 const controller=new AbortController()
 let timer:ReturnType<typeof setTimeout>|undefined
 try {
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new SlackError('unknown','slack_timeout'))},options.timeoutMs??5000)})
  const response=await Promise.race([(options.fetcher??fetch)(`https://slack.com/api/${method}`,{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${options.token}`,'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(payload)}),deadline])
  if(response.status===429)throw new SlackError('retryable','ratelimited',Math.max(1,Math.min(3600,Number(response.headers.get('retry-after'))||60)))
  // A 5xx can happen after Slack accepted a non-idempotent post.
  if(!response.ok)throw new SlackError(response.status>=500?'unknown':'retryable','slack_http_error')
  const result=await Promise.race([readBoundedJson(response,128*1024,503),deadline])
  if(!isRecord(result)||typeof result.ok!=='boolean')throw new SlackError('unknown','slack_invalid_response')
  if(!result.ok)throw new SlackError('retryable',typeof result.error==='string'?result.error.slice(0,80):'slack_rejected')
  return result
 }catch(error){if(error instanceof SlackError)throw error;throw new SlackError('unknown','slack_network_error')}
 finally{clearTimeout(timer)}
}
