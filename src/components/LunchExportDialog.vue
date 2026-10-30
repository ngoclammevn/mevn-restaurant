<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useUser } from '@clerk/vue'
import { useLunchExport } from '../composables/useLunchExport'
import { lunchExportCsv } from '../lib/lunch-export'
import { createLunchWorkbook, downloadLunchFile } from '../lib/lunch-workbook'
import { todayInVN } from '../lib/date'
import { AppDialog, AppButton } from './ui'
const props=defineProps({open:Boolean,menu:Object})
const emit=defineEmits(['close'])
const {user}=useUser(),{loadLunchExport}=useLunchExport()
const scope=ref('menu'),from=ref(''),to=ref(''),busy=ref(false),error=ref(''),model=ref(null)
let controller,generation=0
function cancel(){generation++;controller?.abort();controller=null;busy.value=false}
watch([()=>props.open,()=>props.menu?.id,()=>user.value?.id],()=>{cancel();model.value=null;error.value='';scope.value=props.menu?'menu':'range';from.value='';to.value=''})
watch([scope,from,to],()=>{cancel();model.value=null;error.value=''})
onUnmounted(cancel)
async function exportFile(kind){
  if(busy.value)return
  const current=++generation,uid=user.value?.id
  controller=new AbortController();busy.value=true;error.value=''
  try{
    const result=await loadLunchExport({menuId:scope.value==='menu'?props.menu?.id:undefined,from:scope.value==='range'?from.value:'',to:scope.value==='range'?to.value:'',signal:controller.signal})
    if(current!==generation || user.value?.id!==uid)return
    if(result.error)throw result.error
    model.value=result.data
    const data=kind==='csv'?lunchExportCsv(result.data):await createLunchWorkbook(result.data)
    if(current!==generation || user.value?.id!==uid)return
    downloadLunchFile(data,'don-com-'+(props.menu?.menu_date || todayInVN())+'.'+kind,kind==='csv'?'text/csv;charset=utf-8':undefined)
  }catch(errorValue){if(current===generation && errorValue.name!=='AbortError')error.value='Chưa xuất được đầy đủ dữ liệu. Kiểm tra kết nối và khoảng ngày rồi thử lại.'}
  finally{if(current===generation)busy.value=false}
}
function close(){cancel();emit('close')}
</script>
<template><AppDialog :open="open" title="Xuất đơn và tiền chưa thu" @close="close"><div class="stack"><label v-if="menu" class="field">Phạm vi<select v-model="scope" class="input" :disabled="busy"><option value="menu">Menu đang xem</option><option value="range">Menu của tôi theo khoảng ngày</option></select></label><div v-if="scope==='range'" class="row-wrap"><label class="field">Từ ngày<input v-model="from" type="date" class="input" :disabled="busy" /></label><label class="field">Đến ngày<input v-model="to" type="date" class="input" :disabled="busy" /></label></div><p class="meta">Excel có ba sheet: Gửi quán, Theo người và Chưa thu. Món chưa có giá nằm riêng; bữa được mời không tính nợ.</p><p v-if="model" role="status">{{ model.meta.menuCount }} menu · {{ model.meta.orderCount }} đơn đã xuất.</p><p v-if="error" class="alert" role="alert">{{ error }}</p></div><template #footer><AppButton variant="ghost" @click="close">Đóng</AppButton><AppButton variant="ghost" :loading="busy" @click="exportFile('csv')">CSV</AppButton><AppButton :loading="busy" @click="exportFile('xlsx')">Tải Excel</AppButton></template></AppDialog></template>
