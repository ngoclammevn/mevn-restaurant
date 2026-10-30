import { HttpError, readBoundedJson, type Config } from '../http.ts'
export function slackDatabase(config:Config,token:string,fetcher:typeof fetch=fetch){
 async function call(path:string,body?:unknown){
  const response=await fetcher(`${config.supabaseUrl}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(4000),headers:{apikey:config.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  if(!response.ok)throw new HttpError(response.status===401||response.status===403?403:409,'slack_state_unavailable')
  return readBoundedJson(response,128*1024,503)
 }
 return {rpc:(name:string,body:Record<string,unknown>)=>call(`rpc/${name}`,body),rows:async(table:string,params:Record<string,string>)=>{const result=await call(`${table}?${new URLSearchParams(params)}`);if(!Array.isArray(result))throw new HttpError(503,'data_unavailable');return result as Record<string,unknown>[]}}
}
export type SlackDatabase=ReturnType<typeof slackDatabase>
