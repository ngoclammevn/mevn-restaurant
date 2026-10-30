import { HttpError } from '../http.ts'
export interface SlackEnv {
 SLACK_WORKSPACE_ID:string;SLACK_ORDER_CHANNEL_ID:string;SLACK_GENERAL_CHANNEL_ID:string;APP_PUBLIC_BASE_URL:string;SLACK_NAMESPACE:string;SLACK_BOT_TOKEN:string;SLACK_RECEIPT_SIGNING_KEY:string
 SLACK_USER_RATE_LIMITER:RateLimit;SLACK_SERVICE_RATE_LIMITER:RateLimit
}
export function readSlackConfig(env:SlackEnv) {
 try{
 const base=new URL(env.APP_PUBLIC_BASE_URL)
 if(base.protocol!=='https:'||base.origin!==env.APP_PUBLIC_BASE_URL||base.username||base.password)throw Error()
 if(!/^T[A-Z0-9]{8,20}$/.test(env.SLACK_WORKSPACE_ID)||!/^C[A-Z0-9]{8,20}$/.test(env.SLACK_ORDER_CHANNEL_ID)||!/^C[A-Z0-9]{8,20}$/.test(env.SLACK_GENERAL_CHANNEL_ID)||!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(env.SLACK_NAMESPACE)||!env.SLACK_BOT_TOKEN||env.SLACK_RECEIPT_SIGNING_KEY?.length<32)throw Error()
 return {workspace:env.SLACK_WORKSPACE_ID,orderChannel:env.SLACK_ORDER_CHANNEL_ID,generalChannel:env.SLACK_GENERAL_CHANNEL_ID,base:base.origin,namespace:env.SLACK_NAMESPACE,token:env.SLACK_BOT_TOKEN,key:env.SLACK_RECEIPT_SIGNING_KEY}
 }catch{throw new HttpError(503,'slack_not_configured')}
}
