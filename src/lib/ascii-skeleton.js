import { asciiSkeletonHTML, animateSkeletons, SKELETON_CSS } from 'ascii-reveal/core'
export function createSkeletonMarkup({kind='text',lines=3,animate=true}={}){
  const count=Number.isFinite(Number(lines))?Math.max(1,Math.min(12,Math.floor(Number(lines)))):3
  return asciiSkeletonHTML({variant:'dither',lines:kind==='calendar'?12:count,widths:kind==='text'?undefined:['100%','82%','62%'],css:false,animate})
}
export function ensureSkeletonStyles(){
  if(document.getElementById('lunch-ascii-skeleton-css'))return
  const style=document.createElement('style');style.id='lunch-ascii-skeleton-css';style.textContent=SKELETON_CSS;document.head.appendChild(style)
}
export function mountSkeletonAnimation(element){return animateSkeletons(element)}
