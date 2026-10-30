import { expect, test } from 'vitest'
import ExcelJS from 'exceljs'
import { buildLunchExport, collectPages, lunchExportCsv } from '../../src/lib/lunch-export'
import { createLunchWorkbook } from '../../src/lib/lunch-workbook'
function fixture(){
  const menu={id:'m1',menu_date:'2026-10-29',title:'Cơm',payment_mode:'self',is_closed:true,
    current_closure:{id:'c1',revision:1,payment_mode:'self',items:[
      {order_item_id:'i1',order_id:'o1',name_snapshot:'Cơm gà',unit_price:35000},
      {order_item_id:'i2',order_id:'o2',name_snapshot:'Cơm gà',unit_price:35000},
      {order_item_id:'i3',order_id:'o3',name_snapshot:'Món chưa rõ giá',unit_price:null},
    ]},menu_items:[{id:'d1',name:'Cơm gà',price:40000}]}
  const order=(id,name,item,is_paid=false)=>({id,menu_id:'m1',user_id:name,user:{full_name:name},item_text:item,note:'',is_paid,
    order_items:[{id:id==='o1'?'i1':id==='o2'?'i2':'i3',menu_item_id:id==='o3'?null:'d1',name_snapshot:item}]})
  const orders=[order('o1','An','Cơm gà',true),order('o2','=1+1','Cơm gà'),order('o3','Chưa có giá','Món chưa rõ giá')]
  const sponsored={id:'m2',menu_date:'2026-10-29',title:'Mời nước',payment_mode:'sponsored',is_closed:false,note:JSON.stringify({dishes:[{name:'Trà',price:25000}]})}
  orders.push({id:'o4',menu_id:'m2',user_id:'duoc-moi',user:{full_name:'Được mời'},item_text:'Trà',is_paid:false,note:''})
  return {menus:[menu,sponsored],orders}
}
test('uses frozen money and separates unknown and sponsored amounts',()=>{
  const model=buildLunchExport(fixture())
  expect(model.personRows.find(row=>row.orderId==='o1').amountDue).toBe(35000)
  expect(model.personRows.find(row=>row.orderId==='o3').amountDue).toBeNull()
  expect(model.personRows.find(row=>row.orderId==='o4')).toMatchObject({vendorAmount:25000,amountDue:0,paymentState:'sponsored'})
  expect(model.outstandingRows.map(row=>row.orderId)).toEqual(['o2','o3'])
  expect(model.buyRows.find(row=>row.name==='Cơm gà')).toMatchObject({servings:2,knownTotal:70000})
  expect(lunchExportCsv(model)).toContain("'=1+1")
})
test('collects all pages and rejects incomplete results',async()=>{
  const rows=Array.from({length:101},(_,id)=>({id:String(id)}))
  expect(await collectPages((offset,size)=>Promise.resolve({data:rows.slice(offset,offset+size)}))).toHaveLength(101)
  await expect(collectPages(offset=>Promise.resolve(offset?{error:new Error('offline')}:{data:rows.slice(0,100)}))).rejects.toThrow('offline')
})
test('retains composite-key closure rows across pages',async()=>{
  const rows=Array.from({length:101},(_,id)=>({closure_id:'c',order_item_id:'i'+id}))
  const actual=await collectPages((offset,size)=>Promise.resolve({data:rows.slice(offset,offset+size)}),{keyOf:row=>row.closure_id+':'+row.order_item_id})
  expect(actual).toHaveLength(101)
})
test('round-trips three sheets with strings, numeric money and blank unknowns',async()=>{
  const model=buildLunchExport(fixture()),buffer=await createLunchWorkbook(model),book=new ExcelJS.Workbook()
  await book.xlsx.load(buffer)
  expect(book.worksheets.map(sheet=>sheet.name)).toEqual(['Gui quan','Theo nguoi','Chua thu'])
  const sheet=book.getWorksheet('Theo nguoi')
  const values=sheet.getSheetValues().filter(Boolean)
  const formulaRow=values.find(row=>row[3]==='=1+1')
  expect(formulaRow[7]).toBe(35000)
  const userCell=sheet.getColumn(3).values.findIndex(value=>value==='=1+1')
  expect(sheet.getRow(userCell).getCell(3).type).toBe(ExcelJS.ValueType.String)
  const unknownRow=values.find(row=>row[3]==='Chưa có giá')
  expect(unknownRow[7] ?? null).toBeNull()
  expect(unknownRow[9]).toBe('Chưa có đủ giá')
})
