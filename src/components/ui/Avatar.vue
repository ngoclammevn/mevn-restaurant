<script setup>
import { computed, ref, watch } from 'vue'
import { resolveAvatar } from '../../lib/avatar'
import MascotAvatar from './MascotAvatar.vue'
const props = defineProps({ profile:{type:Object,default:null}, src:{type:String,default:''}, name:{type:String,default:''}, size:{type:[Number,String],default:40} })
const failed=ref(false)
const identity=computed(()=>props.profile || {id:props.name,full_name:props.name,avatar_url:props.src})
const resolved=computed(()=>resolveAvatar(identity.value,{imageFailed:failed.value}))
const label=computed(()=>props.name || identity.value.full_name || 'Thành viên')
watch(()=>[props.profile?.id,props.profile?.avatar_mode,props.profile?.uploaded_avatar_path,props.profile?.avatar_url,props.src],()=>{failed.value=false})
</script>
<template>
  <img v-if="resolved.kind==='image'" :src="resolved.src" :alt="label" class="avatar" :style="{width:`${size}px`,height:`${size}px`}" @error="failed=true" />
  <MascotAvatar v-else :mascot-id="resolved.mascotId" :size="size" :label="label" />
</template>
