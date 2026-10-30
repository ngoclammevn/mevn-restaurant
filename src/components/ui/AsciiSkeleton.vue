<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { createSkeletonMarkup, ensureSkeletonStyles, mountSkeletonAnimation } from '../../lib/ascii-skeleton'
const props=defineProps({kind:{type:String,default:'text'},lines:{type:Number,default:3},width:Number,height:Number,animate:{type:Boolean,default:true},label:{type:String,default:'Đang tải…'}})
const element=ref(null),markup=computed(()=>createSkeletonMarkup(props))
const style=computed(()=>({width:Number.isFinite(props.width)&&props.width>0?Math.min(props.width,2000)+'px':undefined,minHeight:Number.isFinite(props.height)&&props.height>0?Math.min(props.height,1200)+'px':props.kind==='calendar'?'360px':props.kind==='menu-card'?'205px':props.kind==='order-row'?'94px':undefined}))
let observer,media,stop,visible=true,mounted=false
function update(){stop?.();stop=null;if(mounted && element.value && visible && props.animate && !media?.matches && document.visibilityState!=='hidden')stop=mountSkeletonAnimation(element.value)}
onMounted(()=>{
  mounted=true;ensureSkeletonStyles();media=window.matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',update);document.addEventListener('visibilitychange',update)
  if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting ?? false;update()});observer.observe(element.value)}
  update()
})
watch(markup,async()=>{stop?.();await nextTick();update()})
onUnmounted(()=>{mounted=false;stop?.();observer?.disconnect();media?.removeEventListener('change',update);document.removeEventListener('visibilitychange',update)})
</script>
<template><div ref="element" class="lunch-ascii-skeleton" :class="'lunch-ascii-skeleton--'+kind" :style="style" aria-busy="true"><span class="skeleton-status" role="status">{{ label }}</span><div aria-hidden="true" v-html="markup" /></div></template>
<style scoped>.lunch-ascii-skeleton{padding:18px;border:1px solid var(--line);border-radius:13px;min-width:0;overflow:hidden;color:var(--muted)}.skeleton-status{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.lunch-ascii-skeleton--menu-card{padding:24px}.lunch-ascii-skeleton--calendar{display:grid;align-content:space-between}.lunch-ascii-skeleton :deep(.ars){--ascii-accent:var(--primary);width:100%}</style>
