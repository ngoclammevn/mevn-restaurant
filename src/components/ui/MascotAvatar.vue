<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DIRECTIONS, REACTIONS, mascotAssets, spritePosition } from '../../lib/mascot-catalog'
import { registerMascotMotion } from '../../lib/mascot-motion'
const props = defineProps({ mascotId: {type:String,default:'fox'}, size:{type:[Number,String],default:40}, label:{type:String,default:'Mascot'}, interactive:{type:Boolean,default:false} })
const element=ref(null), squash=ref(null), direction=ref('center'), reaction=ref(null)
const assets=computed(()=>mascotAssets(props.mascotId))
let dispose=()=>{}, active=false, animation, timer
function stop() { clearTimeout(timer); timer=undefined; animation?.cancel(); animation=undefined; reaction.value=null }
function boop() {
  if (!props.interactive || !active) return
  stop(); reaction.value='heart'
  animation=squash.value?.animate?.([
    {transform:'scale(1,1)'},{transform:'scale(1.1,.86)',offset:.18},
    {transform:'scale(.95,1.08)',offset:.45},{transform:'scale(1.03,.97)',offset:.72},{transform:'scale(1,1)'},
  ],{duration:420,easing:'linear'})
  timer=setTimeout(stop,560)
}
onMounted(()=> { dispose=registerMascotMotion(element.value,value=>direction.value=value,{onActivity:value=>{active=value;if(!value)stop()}}) })
onUnmounted(()=>{dispose();stop()})
</script>
<template>
  <component :is="interactive ? 'button' : 'span'" ref="element" :type="interactive ? 'button' : undefined" :role="interactive ? undefined : 'img'" :aria-label="interactive ? `Chạm ${label}` : label" class="avatar mascot-avatar" :class="{'mascot-avatar--interactive':interactive}" :style="{width:`${size}px`,height:`${size}px`}" @click="boop">
    <span ref="squash" class="mascot-squash"><span class="mascot-layer" :style="{backgroundImage:`url(${reaction ? assets.reactions : assets.directions})`,backgroundPosition:spritePosition(reaction ? REACTIONS.indexOf(reaction) : DIRECTIONS.indexOf(direction))}" /></span>
  </component>
</template>
<style scoped>
.mascot-avatar{position:relative;display:inline-block;flex-shrink:0;padding:0;border:0;border-radius:50%;background:var(--bg-tint,#f1f2ed);overflow:hidden;vertical-align:middle;user-select:none}.mascot-avatar--interactive{cursor:pointer}.mascot-squash{position:absolute;inset:5%;display:block;transform-origin:50% 78%}.mascot-layer{position:absolute;inset:0;background-size:300% 300%;background-repeat:no-repeat}
</style>
