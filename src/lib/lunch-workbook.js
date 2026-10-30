export async function createLunchWorkbook(model){
  const module=await import('exceljs'),ExcelJS=module.default || module
  const workbook=new ExcelJS.Workbook()
  workbook.creator='Cơm Trưa';workbook.created=new Date(model.meta.exportedAt)
  const labels={paid:'Đã trả',unpaid:'Chưa trả',sponsored:'Được mời'}
  const definitions=[
    {name:'Gui quan',title:'Danh sách gửi quán',columns:[['Ngày','menuDate',14],['Quán','restaurant',24],['Món','name',30],['Số suất','servings',12],['Tổng đã biết','knownTotal',20],['Suất chưa có giá','unknownPriceCount',20],['Ghi chú','note',46]],rows:model.buyRows},
    {name:'Theo nguoi',title:'Đơn theo người',columns:[['Ngày','menuDate',14],['Quán','restaurant',24],['Người ăn','name',24],['Món','items',32],['Ghi chú','note',36],['Giá quán','vendorAmount',18],['Phải trả','amountDue',18],['Trạng thái','stateLabel',18],['Giá chưa biết','unknownLabel',20],['Đã trả lúc','paidAt',26],['Lần chốt','closureRevision',22]],rows:model.personRows},
    {name:'Chua thu',title:'Các khoản chưa thu',columns:[['Ngày','menuDate',14],['Quán','restaurant',24],['Người ăn','name',24],['Món','items',32],['Phải trả','amountDue',18],['Giá chưa biết','unknownLabel',20],['Ghi chú','note',36]],rows:model.outstandingRows},
  ]
  for(const definition of definitions){
    const sheet=workbook.addWorksheet(definition.name)
    sheet.columns=definition.columns.map(([,key,width])=>({key,width}))
    sheet.addRow([definition.title]);sheet.getRow(1).font={bold:true,size:16}
    sheet.addRow(['Xuất '+new Date(model.meta.exportedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+' · '+model.meta.menuCount+' menu · '+model.meta.orderCount+' đơn'])
    sheet.addRow(['Khoảng ngày: '+(model.meta.from || 'Tất cả')+' → '+(model.meta.to || 'Tất cả')])
    sheet.addRow(definition.columns.map(([label])=>label))
    sheet.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}}
    sheet.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF385C42'}}
    for(const row of definition.rows)sheet.addRow({...row,stateLabel:labels[row.paymentState],unknownLabel:row.amountDue==null?'Chưa có đủ giá':''})
    sheet.views=[{state:'frozen',ySplit:4}]
    sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,sheet.rowCount),column:definition.columns.length}}
    sheet.eachRow((row,number)=>{if(number>4){row.alignment={vertical:'top',wrapText:true};for(const [index,[,key]] of definition.columns.entries())if(['knownTotal','vendorAmount','amountDue'].includes(key))row.getCell(index+1).numFmt='#,##0" đ"'}})
    const amounts=definition.rows.map(row=>definition.name==='Gui quan'?row.knownTotal:row.amountDue)
    const total=amounts.reduce((sum,value)=>sum+(typeof value==='number'?value:0),0)
    sheet.addRow([])
    sheet.addRow(['Tổng tiền đã biết: '+total.toLocaleString('vi-VN')+' đ · '+(definition.name==='Gui quan'?definition.rows.reduce((sum,row)=>sum+row.unknownPriceCount,0):amounts.filter(value=>value==null).length)+' khoản/suất chưa đủ giá'])
  }
  return workbook.xlsx.writeBuffer()
}
export function downloadLunchFile(buffer,filename,mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
  const url=URL.createObjectURL(new Blob([buffer],{type:mime})),anchor=document.createElement('a')
  anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
