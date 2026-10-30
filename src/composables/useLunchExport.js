import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { collectPages, buildLunchExport } from '../lib/lunch-export'
export function useLunchExport(){
  const {user}=useUser(),sb=useSupabaseClient()
  async function loadLunchExport({menuId,from='',to='',signal}={}){
    const uid=user.value?.id
    if(!uid)return {data:null,error:new Error('Vui lòng đăng nhập.')}
    try{
      const valid=value=>!value || /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
      if(!valid(from)||!valid(to)||(from&&to&&from>to))throw new Error('Khoảng ngày không hợp lệ.')
      const guarded=async query=>{const result=await query.abortSignal(signal || new AbortController().signal);if(user.value?.id!==uid)throw new Error('Tài khoản đã thay đổi.');return result}
      const menus=await collectPages((offset,size)=>{
        let query=sb.from('menus').select('*,restaurant:restaurants!menus_restaurant_id_fkey(name),current_closure:menu_closures!menus_current_closure_id_fkey(id,revision,closed_at,payment_mode)').eq('poster_id',uid)
        if(menuId)query=query.eq('id',menuId)
        if(from)query=query.gte('menu_date',from)
        if(to)query=query.lte('menu_date',to)
        return guarded(query.order('id').range(offset,offset+size-1))
      },{signal})
      if(menuId&&!menus.length)throw new Error('Bạn không có quyền xuất menu này.')
      const orders=[],closureItems=[]
      for(let start=0;start<menus.length;start+=50){
        const batch=menus.slice(start,start+50),ids=batch.map(menu=>menu.id),closures=batch.map(menu=>menu.current_closure_id).filter(Boolean)
        orders.push(...await collectPages((offset,size)=>guarded(sb.from('orders').select('*,user:profiles!orders_user_id_fkey(full_name),order_items:order_items!order_items_order_id_menu_id_fkey(*)').in('menu_id',ids).order('id').range(offset,offset+size-1)),{signal}))
        if(closures.length)closureItems.push(...await collectPages((offset,size)=>guarded(sb.from('closure_items').select('*').in('closure_id',closures).order('closure_id').order('order_item_id').range(offset,offset+size-1)),{signal,keyOf:row=>row.closure_id+':'+row.order_item_id}))
      }
      for(const menu of menus)if(menu.current_closure)menu.current_closure.items=closureItems.filter(item=>item.closure_id===menu.current_closure_id)
      if(user.value?.id!==uid)throw new Error('Tài khoản đã thay đổi.')
      return {data:buildLunchExport({menus,orders,from,to}),error:null}
    }catch(error){return {data:null,error}}
  }
  return {loadLunchExport}
}
