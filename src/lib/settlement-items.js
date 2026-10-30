import { menuDishes } from './menu'
export function orderPriceItems(menu, order) {
  const closure = Array.isArray(menu.current_closure) ? menu.current_closure[0] : menu.current_closure
  if (menu.is_closed && closure) return (closure.items || []).filter(item => item.order_id === order.id).map(item => ({
    key:order.order_items?.find(row=>row.id===item.order_item_id)?.menu_item_id?'item:'+order.order_items.find(row=>row.id===item.order_item_id).menu_item_id:'legacy:'+item.name_snapshot, menuItemId:order.order_items?.find(row=>row.id===item.order_item_id)?.menu_item_id || null,
    name:item.name_snapshot, unitPrice:item.unit_price,
  }))
  const dishes=menuDishes(menu), price=dish=>menu.is_closed?null:typeof dish?.price==='number' && Number.isInteger(dish.price) && dish.price>=0?dish.price:null
  const fromText=text=>String(text || '').split('\n').map(name=>name.trim()).filter(Boolean).map(name=>{
    const matches=dishes.filter(dish=>dish.name===name), dish=matches.length===1?matches[0]:null
    return {key:dish?.id?'item:'+dish.id:'legacy:'+name,menuItemId:dish?.id || null,name,unitPrice:price(dish)}
  })
  if(!order.order_items?.length)return fromText(order.item_text)
  return order.order_items.flatMap(item=>{
    if(!item.menu_item_id)return fromText(item.name_snapshot || order.item_text)
    const dish=dishes.find(row=>row.id===item.menu_item_id)
    return [{key:'item:'+item.menu_item_id,menuItemId:item.menu_item_id,name:item.name_snapshot || dish?.name || 'Món đã đặt',unitPrice:price(dish)}]
  })
}
