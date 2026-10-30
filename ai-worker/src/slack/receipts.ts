import { isRecord } from '../http.ts'
export interface ReceiptScope {namespace:string;workspace:string;channel:string;resource:string;kind:string;revision:number}
export interface ReceiptPayload extends ReceiptScope {ts?:string;scheduled_message_id?:string;post_at?:number}
export interface Receipt {payload:ReceiptPayload;signature:string}
function canonical(payload:ReceiptPayload):string {return JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a],[b])=>a.localeCompare(b))))}
async function key(value:string){return crypto.subtle.importKey('raw',new TextEncoder().encode(value),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function signReceipt(payload:ReceiptPayload,secret:string):Promise<Receipt> {
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(canonical(payload))))
 return {payload,signature:Array.from(signature,b=>b.toString(16).padStart(2,'0')).join('')}
}
export async function verifyReceipt(receipt:unknown,secret:string,scope:ReceiptScope):Promise<boolean> {
 if(!isRecord(receipt)||!isRecord(receipt.payload)||typeof receipt.signature!=='string'||!/^[a-f0-9]{64}$/.test(receipt.signature))return false
 const payload=receipt.payload
 if(Object.entries(scope).some(([k,v])=>payload[k]!==v))return false
 if(payload.ts!==undefined&&(typeof payload.ts!=='string'||!/^\d+\.\d+$/.test(payload.ts)))return false
 if(payload.scheduled_message_id!==undefined&&(typeof payload.scheduled_message_id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(payload.scheduled_message_id)))return false
 try{return await crypto.subtle.verify('HMAC',await key(secret),Uint8Array.from(receipt.signature.match(/../g)!,v=>parseInt(v,16)),new TextEncoder().encode(canonical(payload as unknown as ReceiptPayload)))}catch{return false}
}
