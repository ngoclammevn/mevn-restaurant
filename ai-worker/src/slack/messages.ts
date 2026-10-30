import { boundedMetadata } from '../database.ts'
export type PublicRow = Record<string, unknown>
export function escapeSlack(value: unknown): string {
 return boundedMetadata(value, 240).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
export function menuLink(menu: PublicRow, base: string): string { return `${base}/menu/${encodeURIComponent(String(menu.id))}` }
export function buildMenuMessage(menu: PublicRow, publicBaseUrl: string) {
 const text=`${escapeSlack(menu.title)} — ${menuLink(menu,publicBaseUrl)}`
 return {text,blocks:[{type:'section',text:{type:'mrkdwn',text}}],unfurl_links:false,unfurl_media:false}
}
export function buildPickupMessage(menu: PublicRow, pickup: PublicRow, slackLinks: Record<string,string>, base?:string) {
 if(pickup.status==='unassigned'){
  const text=`${escapeSlack(menu.title)} · Đã chốt menu · Chưa phân công người nhận cơm${base?` — ${menuLink(menu,base)}`:''}`
  return {text,blocks:[{type:'section',text:{type:'mrkdwn',text}}],unfurl_links:false,unfurl_media:false}
 }
 const id=String(pickup.primary_user_id ?? '')
 const member=slackLinks[id]
 const person=member && /^[UW][A-Z0-9]{8,20}$/.test(member)?`<@${member}>`:escapeSlack(pickup.primary_name || 'Người nhận chưa liên kết Slack')
 const text=`${escapeSlack(menu.title)} · ${pickup.status==='received'?'Đã nhận cơm':'Người nhận cơm'}: ${person}${base?` — ${menuLink(menu,base)}`:''}`
 return {text,blocks:[{type:'section',text:{type:'mrkdwn',text}}],unfurl_links:false,unfurl_media:false}
}
