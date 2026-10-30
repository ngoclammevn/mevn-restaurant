<script setup>
import { computed, onUnmounted, ref, useId, watch } from 'vue'
import { useProfile } from '../composables/useProfile'
import { useAvatarUpload } from '../composables/useAvatarUpload'
import { defaultMascotForUser } from '../lib/avatar'
import { MASCOTS, MASCOT_IDS } from '../lib/mascot-catalog'
import { inspectAvatarFile } from '../lib/avatar-upload'
import Avatar from './ui/Avatar.vue'
import MascotAvatar from './ui/MascotAvatar.vue'
import AppDialog from './ui/AppDialog.vue'
import AppButton from './ui/AppButton.vue'
const props=defineProps({profile:{type:Object,default:null},disabled:Boolean})
const emit=defineEmits(['saved'])
const {updateAvatar}=useProfile(),{replaceAvatar,cleanupPending,retryCleanup}=useAvatarUpload()
const open=ref(false),mode=ref('auto'),mascotId=ref('fox'),file=ref(null),previewUrl=ref(''),dimensions=ref(null)
const zoom=ref(1),horizontal=ref(50),vertical=ref(50),saving=ref(false),reading=ref(false),error=ref(''),saved=ref(false)
const inputId='avatar-file-'+useId()
let generation=0
const crop=computed(()=>{
  if(!dimensions.value)return null
  const {width,height}=dimensions.value,size=Math.min(width,height)/zoom.value
  return {x:(width-size)*horizontal.value/100,y:(height-size)*vertical.value/100,size}
})
const cropStyle=computed(()=>{
  if(!crop.value)return {}
  const {x,y,size}=crop.value
  return {width:`${dimensions.value.width/size*100}%`,height:`${dimensions.value.height/size*100}%`,left:`${-x/size*100}%`,top:`${-y/size*100}%`}
})
const draft=computed(()=>({...props.profile,avatar_mode:mode.value,mascot_id:mascotId.value}))
function releasePreview(){if(previewUrl.value)URL.revokeObjectURL(previewUrl.value);previewUrl.value='';file.value=null;dimensions.value=null}
function begin(){generation++;reading.value=false;releasePreview();mode.value=props.profile?.avatar_mode || 'auto';mascotId.value=props.profile?.mascot_id || defaultMascotForUser(props.profile?.id);error.value='';saved.value=false;open.value=true}
function cancel(){if(saving.value)return;generation++;reading.value=false;releasePreview();open.value=false;error.value=''}
function randomize(){const options=MASCOT_IDS.filter(id=>id!==mascotId.value);mascotId.value=options[crypto.getRandomValues(new Uint32Array(1))[0]%options.length];mode.value='mascot'}
async function chooseFile(event){
  const selected=event.target.files?.[0],current=++generation
  event.target.value='';releasePreview();error.value=''
  if(!selected)return
  reading.value=true
  try{
    const metadata=await inspectAvatarFile(selected)
    if(current!==generation)return
    file.value=selected;dimensions.value=metadata;previewUrl.value=URL.createObjectURL(selected);zoom.value=1;horizontal.value=50;vertical.value=50;mode.value='upload'
  }catch(failure){if(current===generation)error.value=failure.message || 'Không đọc được ảnh.'}
  finally{if(current===generation)reading.value=false}
}
async function save(){
  if(saving.value || reading.value)return
  const current=generation,uid=props.profile?.id
  saving.value=true;error.value=''
  try{
    const result=mode.value==='upload' && file.value ? await replaceAvatar(file.value,crop.value) : await updateAvatar({mode:mode.value,mascotId:mascotId.value})
    if(current!==generation || uid!==props.profile?.id)return
    if(result.error)throw result.error
    saved.value=true;open.value=false;releasePreview();emit('saved',result.data)
  }catch(failure){if(current===generation)error.value=failure.name==='AbortError'?'Thao tác đã hủy.':failure.message || 'Chưa lưu được ảnh đại diện. Thử lại.'}
  finally{if(current===generation)saving.value=false}
}
watch(()=>props.profile?.id,()=>{generation++;releasePreview();open.value=false;saving.value=false;reading.value=false})
onUnmounted(()=>{generation++;releasePreview()})
</script>
<template>
  <section class="avatar-settings">
    <div><h2>Ảnh đại diện</h2><p class="meta">Chọn một người bạn nhỏ, ảnh Google hoặc ảnh của bạn.</p></div>
    <div class="avatar-settings-actions"><AppButton variant="ghost" :disabled="disabled || !profile" @click="begin">Đổi ảnh đại diện</AppButton><span v-if="saved" role="status" class="meta">Đã lưu ảnh đại diện</span></div>
    <p v-if="cleanupPending" class="meta" role="status">Đã lưu ảnh mới. App chưa xóa xong ảnh cũ. <button type="button" class="avatar-text-button" @click="retryCleanup">Thử xóa ảnh cũ</button></p>
    <AppDialog :open="open" title="Ảnh đại diện của bạn" @close="cancel">
      <div class="avatar-picker-preview">
        <div v-if="mode==='upload' && previewUrl" class="avatar-crop avatar-crop--small"><img :src="previewUrl" alt="Xem trước ảnh đã cắt" :style="cropStyle" /></div>
        <MascotAvatar v-else-if="mode==='mascot'" :mascot-id="mascotId" :size="86" label="mascot xem trước" interactive />
        <Avatar v-else :profile="draft" :size="86" />
        <p class="meta">Lựa chọn chỉ thay đổi khi bạn bấm Lưu.</p>
      </div>
      <fieldset class="avatar-picker-fields" :disabled="saving || reading">
        <legend class="sr-only">Chọn loại ảnh đại diện</legend>
        <div class="avatar-mode-options" role="group" aria-label="Loại ảnh đại diện"><button v-for="option in [{id:'auto',label:'Tự động'},{id:'mascot',label:'Chọn mascot'},{id:'upload',label:'Tải ảnh'}]" :key="option.id" type="button" :aria-pressed="mode===option.id" @click="mode=option.id">{{ option.label }}</button></div>
        <p v-if="mode==='auto'" class="meta avatar-picker-help">Dùng ảnh Google nếu bạn có ảnh; nếu chưa có, mascot mặc định của bạn sẽ xuất hiện.</p>
        <template v-if="mode==='mascot'">
          <div class="mascot-options" role="group" aria-label="Mẫu mascot"><button v-for="mascot in MASCOTS" :key="mascot.id" type="button" :aria-pressed="mascotId===mascot.id" @click="mascotId=mascot.id"><MascotAvatar :mascot-id="mascot.id" :size="52" :label="mascot.label" /><span>{{ mascot.label }}</span></button></div>
          <AppButton variant="ghost" @click="randomize">Chọn ngẫu nhiên mẫu khác</AppButton>
        </template>
        <template v-if="mode==='upload'">
          <label class="field avatar-file-label" :for="inputId">Chọn ảnh JPG, PNG hoặc WebP<input :id="inputId" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseFile" /></label>
          <p class="meta">Tối đa 2 MB · 8192 px mỗi cạnh · 25 triệu pixel. App cắt ảnh vuông và bỏ dữ liệu đính kèm trước khi tải lên.</p>
          <div v-if="previewUrl" class="avatar-crop-controls">
            <div class="avatar-crop"><img :src="previewUrl" alt="Xem trước phần ảnh sau khi cắt" :style="cropStyle" /></div>
            <label>Phóng to<input v-model.number="zoom" type="range" min="1" max="3" step="0.01" /></label>
            <label>Vị trí ngang<input v-model.number="horizontal" type="range" min="0" max="100" step="1" /></label>
            <label>Vị trí dọc<input v-model.number="vertical" type="range" min="0" max="100" step="1" /></label>
          </div>
          <p v-else-if="profile?.uploaded_avatar_path" class="meta avatar-picker-help">App sẽ dùng lại ảnh bạn đã tải trước đó.</p>
        </template>
      </fieldset>
      <p v-if="reading" class="meta" role="status">Đang kiểm tra ảnh…</p><p v-if="error" class="alert" role="alert">{{ error }}</p>
      <template #footer><AppButton variant="ghost" :disabled="saving" @click="cancel">Hủy</AppButton><AppButton :loading="saving" :disabled="reading || (mode==='upload' && !file && !profile?.uploaded_avatar_path)" @click="save">Lưu ảnh đại diện</AppButton></template>
    </AppDialog>
  </section>
</template>
<style scoped>
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.avatar-settings{border-top:1px solid var(--line);margin-top:21px;padding-top:20px;display:grid;gap:14px}.avatar-settings h2{font-size:18px!important}.avatar-settings-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.avatar-picker-preview{display:flex;align-items:center;gap:20px;margin-bottom:20px}.avatar-picker-preview>.meta{max-width:260px}.avatar-picker-fields{border:0;padding:0;margin:0;min-width:0}.avatar-mode-options{display:flex;gap:8px;margin-bottom:20px}.avatar-mode-options button{flex:1;border:1px solid var(--line-strong);border-radius:10px;background:var(--card);padding:10px 8px;min-height:44px;cursor:pointer;font-size:14px}.avatar-mode-options button[aria-pressed=true],.mascot-options button[aria-pressed=true]{background:var(--primary-soft);border-color:var(--primary)}.mascot-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 18px}.mascot-options button{display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--line);border-radius:12px;padding:10px 4px;background:var(--card);font-size:12px;cursor:pointer;overflow-wrap:anywhere}.avatar-picker-help{margin:12px 0}.avatar-file-label{display:grid;gap:10px;margin:14px 0;font-size:14px;font-weight:600}.avatar-file-label input{max-width:100%;font-size:14px;min-height:44px}.avatar-crop{position:relative;overflow:hidden;width:min(240px,100%);aspect-ratio:1;background:var(--bg-tint);border:1px solid var(--line);border-radius:12px;margin:8px auto}.avatar-crop img{position:absolute;max-width:none;display:block}.avatar-crop--small{width:86px;flex-shrink:0;border-radius:50%;margin:0}.avatar-crop-controls{margin-top:18px;display:grid;gap:8px}.avatar-crop-controls label{display:grid;grid-template-columns:100px 1fr;align-items:center;gap:12px;font-size:14px}.avatar-crop-controls input{width:100%;min-height:44px;accent-color:var(--primary)}.avatar-text-button{border:0;background:none;text-decoration:underline;color:var(--primary);padding:8px;min-height:44px;cursor:pointer}@media(max-width:380px){.mascot-options{grid-template-columns:repeat(2,minmax(0,1fr))}.avatar-mode-options{gap:5px}.avatar-mode-options button{font-size:12px}}
</style>
