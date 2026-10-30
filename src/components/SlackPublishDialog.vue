<script setup>
import SlackDeliveryStatus from './SlackDeliveryStatus.vue'
import { AppDialog, AppButton } from './ui'
defineProps({menu:{type:Object,required:true},state:{type:Object,default:()=>({status:'pending'})}})
defineEmits(['publish','close','retry','resolve'])
</script>
<template><AppDialog open title="Đăng menu lên kênh chung" @close="$emit('close')"><div class="stack"><p>Mọi người trong kênh sẽ thấy ảnh và đường dẫn đặt món.</p><img v-if="menu.image_url" :src="menu.image_url" alt="Ảnh menu sẽ chia sẻ" class="post-image" style="max-height:280px;object-fit:contain" /><strong>{{ menu.title }}</strong><a :href="'/menu/'+menu.id" target="_blank" rel="noopener">Xem menu ↗</a><SlackDeliveryStatus :state="state" @retry="$emit('retry')" @resolve="$emit('resolve',$event)" /></div><template #footer><AppButton variant="ghost" @click="$emit('close')">Đóng</AppButton><AppButton :disabled="['sending','sent','unknown'].includes(state.status)" @click="$emit('publish')">{{ state.status==='sent'?'Đã đăng':'Đăng kênh chung' }}</AppButton></template></AppDialog></template>
