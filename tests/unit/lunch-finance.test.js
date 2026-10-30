import { expect, test } from 'vitest'
import { orderSettlement, isOutstanding } from '../../shared/lunch-finance.js'

test('sponsored vendor cost is separate from the diner debt without rewriting paid status', () => {
  expect(orderSettlement({payment_mode:'sponsored'}, {is_paid:false}, [{unit_price:35000}]))
    .toEqual({vendorAmount:35000,amountDue:0,paymentState:'sponsored',priceSource:'frozen'})
  expect(isOutstanding({payment_mode:'sponsored'}, {is_paid:false})).toBe(false)
})
test('unknown self-pay remains outstanding and zero is a known price', () => {
  expect(orderSettlement({is_closed:true}, {is_paid:false}, [{unit_price:null}]))
    .toMatchObject({vendorAmount:null,amountDue:null,paymentState:'unpaid',priceSource:'frozen'})
  expect(orderSettlement({}, {is_paid:false}, [{unit_price:0}]).amountDue).toBe(0)
  expect(isOutstanding({}, {is_paid:false})).toBe(true)
})
test('closed prices use only the current closure and preserve unknown legacy history', () => {
  const order={id:'o',item_text:'Cơm',is_paid:false}
  const menu={is_closed:true,note:'{"dishes":[{"name":"Cơm","price":90000}]}',current_closure:{items:[{order_id:'o',unit_price:35000},{order_id:'other',unit_price:5000}]}}
  expect(orderSettlement(menu,order).vendorAmount).toBe(35000)
  expect(orderSettlement({...menu,current_closure:null},order)).toMatchObject({vendorAmount:null,priceSource:'legacy_unknown'})
})
test('open prices require exact unique dish names and keep incomplete totals unknown', () => {
  expect(orderSettlement({note:'{"dishes":[{"name":"Cơm","price":35000},{"name":"Rau","price":null}]}'},{item_text:'Cơm\nRau'}).vendorAmount).toBeNull()
  expect(orderSettlement({note:'{"dishes":[{"name":"Cơm","price":35000},{"name":"Cơm","price":40000}]}'},{item_text:'Cơm'}).vendorAmount).toBeNull()
  expect(orderSettlement({note:'{"dishes":[{"name":"Cơm","price":35000}]}'},{item_text:'cơm'}).vendorAmount).toBeNull()
})

test('an empty frozen snapshot never invents a zero price', () => {
  expect(orderSettlement({is_closed:true}, {item_text:'Cơm'}, []).vendorAmount).toBeNull()
})
