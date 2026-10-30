import { HttpError, isRecord, jsonResponse, readBoundedJson, type Config } from '../http.ts'
import { hashText } from '../suggestions.ts'
import { dispatchNotification, type Action } from './service.ts'
import type { SlackEnv } from './config.ts'
export const slackActions=new Set(['publish','share','closed','reopened','pickup-changed','received','reminder','retry','resolve','link-account','sync'])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function parseSlackBody(request:Request,action:string):Promise<Record<string,unknown>>{
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HttpError(415,'unsupported_media_type')
 const body=await readBoundedJson(request,8192)
 if(!isRecord(body))throw new HttpError(400,'invalid_body')
 const allowed=action==='link-account'?['member_id']:action==='resolve'?['event_id','resolution']:action==='retry'?['event_id']:['menu_id','revision']
 if(Object.keys(body).some(k=>!allowed.includes(k)))throw new HttpError(400,'invalid_body')
 if(action==='link-account'){if(typeof body.member_id!=='string'||!/^[UW][A-Z0-9]{8,20}$/.test(body.member_id))throw new HttpError(400,'invalid_member_id')}
 else if(action==='retry'||action==='resolve'){if(typeof body.event_id!=='string'||!uuid.test(body.event_id))throw new HttpError(400,'invalid_body');if(action==='resolve'&&!['sent','not_sent'].includes(String(body.resolution)))throw new HttpError(400,'invalid_body')}
 else if(typeof body.menu_id!=='string'||!uuid.test(body.menu_id)||body.revision!==undefined&&(!Number.isSafeInteger(body.revision)||Number(body.revision)<0))throw new HttpError(400,'invalid_body')
 return body
}
export async function routeSlack(request:Request,env:Env & SlackEnv,config:Config,auth:{subject:string;token:string},origin:string,action:string){
 if(!env.SLACK_USER_RATE_LIMITER||!env.SLACK_SERVICE_RATE_LIMITER)throw new HttpError(503,'slack_not_configured')
 if(!(await env.SLACK_USER_RATE_LIMITER.limit({key:await hashText(auth.subject)})).success||!(await env.SLACK_SERVICE_RATE_LIMITER.limit({key:'slack-v1'})).success)throw new HttpError(429,'rate_limited')
 const body=await parseSlackBody(request,action)
 return jsonResponse(await dispatchNotification({...auth,action:action as Action,body},env,{config}),200,origin)
}
