import { describe, expect, it } from 'vitest'
import { serializePresenceContext, dedupeViewers } from '../../src/lib/presence.js'
import { summarizeManagedMenu, managedOrderAmount, groupOutstandingOrders } from '../../src/lib/manage-summary.js'
import { summarizeTaste } from '../../src/lib/taste-summary.js'
const menu = { id: 'm', restaurant_id: 'r', restaurant: {name: 'Quán A'}, menu_date: '2026-10-05', menu_items: [{id:'i',name:'Gà',price:35000,restaurant_dish_id:'d',position:0},{id:'j',name:'Rau',price:null,position:1}] }
describe('public presence boundary', () => {
  it('strips menu drafts and all metadata from private pages', () => {
    for (const path of ['/profile', '/history?user=secret', '/taste', '/manage', '/post']) expect(serializePresenceContext({path,menu:{id:'m',restaurantName:'secret'},picks:['Gà']})).toEqual({page:'online',label:'Đang online',menuId:null,restaurantName:null,picks:[]})
  })
  it('only shares picks when menu matches current route', () => {
    expect(serializePresenceContext({path:'/menu/other',menu:{id:'m'},picks:['Gà']}).picks).toEqual([])
    expect(serializePresenceContext({path:'/menu/m',menu:{id:'m',restaurantName:'Quán A'},picks:['Gà','Gà','Rau']}).picks).toEqual(['Gà','Rau'])
  })
  it('deduplicates tabs without mixing different menus', () => {
    const rows = dedupeViewers({a:[{userId:'u',name:'A',page:'menu',menuId:'m',picks:['Gà'],updatedAt:1}],b:[{userId:'u',name:'A',page:'menu',menuId:'n',picks:['Cá'],updatedAt:2}],c:[{userId:'v',name:'B',page:'profile',menuId:'m',picks:['Private'],updatedAt:3}]})
    expect(rows).toHaveLength(2); expect(rows.find(r=>r.id==='u').picks).toEqual(['Cá']); expect(rows.find(r=>r.id==='v').picks).toEqual([])
  })
})
describe('poster quantities and outstanding ledger', () => {
  it('counts multiple servings and retains unknown prices instead of zero', () => {
    const summary=summarizeManagedMenu({...menu,orders:[{id:'o',user_id:'u',item_text:'Gà\nRau',order_items:[{menu_item_id:'i',name_snapshot:'Gà'},{menu_item_id:'j',name_snapshot:'Rau'}]}]})
    expect(summary.servings).toBe(2); expect(summary.knownTotal).toBe(35000); expect(summary.unknownPriceCount).toBe(1)
    expect(managedOrderAmount(menu,{item_text:'Gà\nRau'})).toBeNull()
  })
  it('does not merge mixed legacy unlinked items and only matches exact names', () => {
    const orders=[{id:'o',user_id:'u',order_items:[{menu_item_id:'i',name_snapshot:'Gà'},{menu_item_id:null,name_snapshot:'Rau'},{menu_item_id:null,name_snapshot:'ga'}]}]
    const summary=summarizeManagedMenu({...menu,orders})
    expect(summary.orderedDishes.map(d=>d.name).sort()).toEqual(['Gà','Rau','ga'].sort()); expect(summary.unknownPriceCount).toBe(2)
  })
  it('groups months-old unpaid orders independently of today and ignores paid', () => {
    const groups=groupOutstandingOrders([{id:'old',user_id:'u',item_text:'Gà',menu:{...menu,menu_date:'2026-02-01'}},{id:'new',user_id:'u',item_text:'Không có giá',menu},{id:'paid',user_id:'u',is_paid:true,item_text:'Gà',menu}])
    expect(groups).toHaveLength(1); expect(groups[0]).toMatchObject({count:2,knownTotal:35000,unknownAmountCount:1,oldestDate:'2026-02-01'})
  })
})
describe('taste observations', () => {
  it('keeps same-name dishes from different restaurants separate and excludes removed reviews', () => {
    const a={id:'a',menu,order_items:[{id:'oa',menu_item_id:'i',name_snapshot:'Gà',review:{id:'ra',rating:5,labels:['Thịt mềm']}}]}
    const b={id:'b',menu:{...menu,id:'b',restaurant_id:'r2',restaurant:{name:'Quán B'}},order_items:[{id:'ob',menu_item_id:'i',name_snapshot:'Gà',review:{id:'rb',rating:1,deleted_at:'now',labels:['Hơi mặn']}}]}
    const result=summarizeTaste([a,b],{from:'2026-10-01',to:'2026-10-06'})
    expect(result.frequentDishes).toHaveLength(2); expect(result.reviewCount).toBe(1); expect(result.likedDishes).toHaveLength(1); expect(result.commonLabels).toEqual([{label:'Thịt mềm',count:1}])
  })
  it('does not infer preferences or ratings from unreviewed selections', () => {
    const result=summarizeTaste([{id:'a',menu,order_items:[{id:'oa',menu_item_id:'i',name_snapshot:'Gà'}]}])
    expect(result.orderCount).toBe(1); expect(result.reviewCount).toBe(0); expect(result.likedDishes).toEqual([])
  })
})
