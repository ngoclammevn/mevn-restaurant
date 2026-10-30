import { orderSettlement, isOutstanding } from '../../shared/lunch-finance.js'
import { orderPriceItems } from './settlement-items'
export async function collectPages(fetchPage,{pageSize=100,signal,keyOf=row=>row.id}={}) {
  const rows=[],ids=new Set()
  for(let offset=0;;offset+=pageSize){
    signal?.throwIfAborted()
    const result=await fetchPage(offset,pageSize)
    signal?.throwIfAborted()
    if(result.error)throw result.error
    const page=result.data || []
    for(const row of page){const key=keyOf(row);if(key==null)throw new Error('Thiếu mã định danh dòng xuất.');if(!ids.has(key)){rows.push(row);ids.add(key)}}
    if(page.length<pageSize)return rows
  }
}
export function buildLunchExport({menus,orders,from='',to=''}){
  const byMenu=new Map(menus.map(menu=>[menu.id,menu])),buy=new Map(),personRows=[]
  for(const order of orders){
    const menu=byMenu.get(order.menu_id)
    if(!menu)continue
    const settlement=orderSettlement(menu,order),items=orderPriceItems(menu,order)
    const row={orderId:order.id,userId:order.user_id,menuId:menu.id,menuDate:menu.menu_date,restaurant:menu.restaurant?.name || menu.title,
      name:order.user?.full_name || 'Chưa đặt tên',items:order.item_text,note:order.note || '',...settlement,paidAt:order.paid_at || '',
      closureRevision:menu.is_closed?menu.current_closure?.revision || 'Chưa có giá chốt':'Đang nhận đơn'}
    personRows.push(row)
    for(const item of items){
      const key=menu.id+':'+item.key
      if(!buy.has(key))buy.set(key,{menuId:menu.id,menuDate:menu.menu_date,restaurant:row.restaurant,name:item.name,servings:0,knownTotal:0,unknownPriceCount:0,notes:[]})
      const grouped=buy.get(key);grouped.servings++
      if(item.unitPrice==null)grouped.unknownPriceCount++;else grouped.knownTotal+=item.unitPrice
      if(order.note)grouped.notes.push(row.name+': '+order.note)
    }
  }
  personRows.sort((a,b)=>a.menuDate.localeCompare(b.menuDate) || a.name.localeCompare(b.name,'vi') || a.orderId.localeCompare(b.orderId))
  const outstandingRows=personRows.filter(row=>isOutstanding(byMenu.get(row.menuId),orders.find(order=>order.id===row.orderId)))
  return {buyRows:[...buy.values()].map(row=>({...row,note:row.notes.join('\n')})),personRows,outstandingRows,
    meta:{from,to,menuCount:menus.length,orderCount:personRows.length,exportedAt:new Date().toISOString(),
      knownDue:personRows.reduce((sum,row)=>sum+(row.amountDue ?? 0),0),unknownCount:personRows.filter(row=>row.amountDue==null).length}}
}
export function lunchExportCsv(model){
  const cell=value=>{let text=String(value ?? '');if(/^\s*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
  const labels={paid:'Đã trả',unpaid:'Chưa trả',sponsored:'Được mời'}
  const rows=[['Ngày','Quán','Người ăn','Món','Ghi chú','Giá quán','Phải trả','Thanh toán','Đã trả lúc','Lần chốt']]
  for(const row of model.personRows)rows.push([row.menuDate,row.restaurant,row.name,row.items,row.note,row.vendorAmount,row.amountDue,labels[row.paymentState],row.paidAt,row.closureRevision])
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')
}
