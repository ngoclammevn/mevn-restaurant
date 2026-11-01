<script setup>
import { ref, onMounted, onUpdated, onBeforeUnmount, useAttrs, normalizeClass } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassMenu } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'
defineOptions({ inheritAttrs:false })
const props=defineProps({label:{type:String,required:true},items:{type:Array,required:true},disabled:Boolean})
const attrs=useAttrs(),host=ref(null)
let root,observer,pendingEdge=null,closingTrigger=false
const trigger=()=>host.value?.querySelector('[aria-haspopup="menu"]')
const buttons=()=>Array.from(host.value?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])
function close(restore=true){
  const button=trigger()
  if(button?.getAttribute('aria-expanded')==='true'){closingTrigger=true;button.click();closingTrigger=false}
  if(restore)button?.focus({preventScroll:true})
}
function place(){
  const button=trigger(),surface=host.value?.querySelector('.lg-menu-surface'),content=host.value?.querySelector('[role="menu"]')
  if(!button || !surface || !content)return
  const box=button.getBoundingClientRect(),width=Math.min(parseFloat(surface.style.width)||260,window.innerWidth-16)
  const height=Math.min(content.offsetHeight,window.innerHeight-16)
  Object.assign(surface.style,{position:'fixed',inset:'auto',left:Math.max(8,Math.min(box.right-width,window.innerWidth-width-8))+'px',top:Math.max(8,Math.min(box.top,window.innerHeight-height-8))+'px',width:width+'px',height:height+'px',margin:'0',padding:'0',border:'0',background:'transparent',overflow:'visible'})
  content.style.maxHeight=Math.max(48,window.innerHeight-16)+'px'
  content.style.overflowY='auto'
  if(surface.showPopover && !surface.matches(':popover-open')){surface.setAttribute('popover','manual');surface.showPopover()}
}
function sync(){
  const button=trigger()
  if(button){
    if(props.disabled && button.getAttribute('aria-expanded')==='true')close(false)
    button.disabled=props.disabled
  }
  place()
  if(pendingEdge){const enabled=buttons();if(enabled.length){(pendingEdge==='last'?enabled.at(-1):enabled[0]).focus({preventScroll:true});pendingEdge=null}}
}
function render(){
  const {class:_class,...menuAttrs}=attrs
  root?.render(createElement(GlassMenu,{...menuAttrs,className:normalizeClass(['glass-action-menu',attrs.class]),'aria-label':props.label,icon:createElement('span',{'aria-hidden':true},'•••'),align:'end',width:260,size:'md',items:props.items.map(item=>({label:item.label,disabled:props.disabled || !!item.disabled,destructive:item.destructive,onSelect:()=>{if(!props.disabled && !item.disabled){item.onSelect?.();trigger()?.focus({preventScroll:true})}}}))}))
}
function keydown(event){
  if(props.disabled)return
  const button=trigger(),open=button?.getAttribute('aria-expanded')==='true'
  if(!open){if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();pendingEdge=event.key==='ArrowUp'?'last':'first';button?.click()}return}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
  if(event.key==='Tab'){close();return}
  const enabled=buttons(),current=enabled.indexOf(document.activeElement)
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();event.stopPropagation()
    if(!enabled.length)return
    const index=event.key==='Home'?0:event.key==='End'?enabled.length-1:(current+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length
    enabled[index].focus({preventScroll:true})
  }else if(['Enter',' '].includes(event.key) && document.activeElement?.getAttribute('role')==='menuitem'){
    event.preventDefault();event.stopPropagation();document.activeElement.click()
  }
}
function blockDisabled(event){if(props.disabled && !closingTrigger){event.preventDefault();event.stopImmediatePropagation()}}
onMounted(()=>{
  root=createRoot(host.value)
  observer=new MutationObserver(sync);observer.observe(host.value,{childList:true,subtree:true})
  host.value.addEventListener('keydown',keydown,true)
  host.value.addEventListener('click',blockDisabled,true)
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
  render()
})
onUpdated(()=>{render();sync()})
onBeforeUnmount(()=>{
  observer?.disconnect();host.value?.removeEventListener('keydown',keydown,true);host.value?.removeEventListener('click',blockDisabled,true)
  window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)
  root?.unmount()
})
</script>
<template><span ref="host" class="glass-action-menu-host" data-theme="light" :data-disabled="disabled" /></template>
<style>
.glass-action-menu-host{display:inline-flex;flex:none;max-width:100%;--lg-font:inherit}.glass-action-menu-host .lg-button{min-height:48px;min-width:48px;font:inherit}.glass-action-menu-host .lg-menu__item{min-height:48px;font-family:inherit;font-size:16px;padding:10px 14px;border-radius:16px;line-height:1.4}.glass-action-menu-host .lg-menu__label{white-space:normal;overflow-wrap:anywhere}.glass-action-menu-host .lg-menu__item[data-destructive]{border-top:1px solid var(--line);border-radius:0 0 16px 16px;margin-top:4px;padding-top:14px;color:var(--unpaid-ink,#b42332)}.glass-action-menu-host .lg-menu__item:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}.glass-action-menu-host .lg-menu-surface{z-index:1000}
</style>
