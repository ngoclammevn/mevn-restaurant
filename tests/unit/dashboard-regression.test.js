import { beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({ user: { value: { id: 'user_a' } }, menus: [] }))
vi.mock('@clerk/vue', () => ({ useUser: () => ({ user: state.user }) }))
vi.mock('../../src/lib/supabase', () => ({ useSupabaseClient: () => ({ from() {
  const filters=[]
  const query={ select(){return query},order(){return query},eq(key,value){filters.push(m=>m[key]===value);return query},gte(key,value){filters.push(m=>m[key]>=value);return query},lte(key,value){filters.push(m=>m[key]<=value);return query},then(resolve){return Promise.resolve({data:state.menus.filter(m=>filters.every(f=>f(m))),error:null}).then(resolve)} }
  return query
} }) }))
import { useDashboard } from '../../src/composables/useDashboard.js'
beforeEach(() => {
  state.user.value={id:'user_a'}
  const order=(id,user_id,item_text,is_paid)=>({id,user_id,item_text,is_paid,user:{full_name:user_id}})
  state.menus=[
    {id:'old',title:'Bữa tháng 8',menu_date:'2026-08-01',poster_id:'user_a',note:JSON.stringify({dishes:[{name:'Cơm gà',price:35000}]}),orders:[order('o1','user_b','Cơm gà',false),order('o2','user_a','Cơm gà',true)]},
    {id:'new',title:'Bữa mới',menu_date:'2026-10-29',poster_id:'user_a',note:'Menu chữ',orders:[order('o3','user_c','Món chưa có giá',false)]},
    {id:'other',title:'Quán khác',menu_date:'2026-10-29',poster_id:'user_d',note:JSON.stringify({dishes:[{name:'Bún',price:40000}]}),orders:[order('o4','user_a','Bún',false)]},
  ]
})
test('keeps unpaid entries from every date for the poster',async()=>{
  const {data}=await useDashboard().unpaidByPersonForMyMenus()
  expect(data.map(person=>person.user_id).sort()).toEqual(['user_b','user_c'])
  expect(data.flatMap(person=>person.items).map(item=>item.menu_id).sort()).toEqual(['new','old'])
})
test('retains statistics, date ranges and personal spend across posters',async()=>{
  const {data}=await useDashboard().fetchStatistics({startDate:'2026-08-01',endDate:'2026-10-29',onlyMyMenus:true})
  expect(data.summary).toMatchObject({totalMenus:2,totalOrders:3,paidOrders:1,unpaidOrders:2,totalAmount:70000,myPersonalSpentAmount:75000})
  const filtered=await useDashboard().fetchStatistics({startDate:'2026-10-29',endDate:'2026-10-29',onlyMyMenus:false})
  expect(filtered.data.summary).toMatchObject({totalMenus:2,totalOrders:2,totalAmount:40000})
})
