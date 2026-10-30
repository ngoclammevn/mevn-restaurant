import { it, expect, vi, afterEach } from 'vitest'
import { directionForPointer, registerMascotMotion } from '../../src/lib/mascot-motion'
afterEach(() => vi.unstubAllGlobals())
it('uses a dead zone, eight directions and hysteresis at boundaries', () => {
  const rect = {left:0,top:0,width:40,height:40}
  expect(directionForPointer(rect,{x:20,y:20}).direction).toBe('center')
  for (const [index,direction] of ['right','down-right','down','down-left','left','up-left','up','up-right'].entries()) {
    const angle = index * Math.PI/4
    expect(directionForPointer(rect,{x:20+100*Math.cos(angle),y:20+100*Math.sin(angle)}).direction).toBe(direction)
  }
  expect(directionForPointer(rect,{x:120,y:65},0).direction).toBe('right')
  expect(directionForPointer(rect,{x:120,y:90},0).direction).toBe('down-right')
})
it('shares one pointer listener and suspends offscreen, hidden, reduced motion, then disposes', () => {
  const win = new EventTarget(), doc = new EventTarget()
  doc.visibilityState='visible'
  const media = new Map()
  win.matchMedia = query => { if (!media.has(query)) { const m = new EventTarget(); m.matches=!query.includes('reduced'); media.set(query,m) } return media.get(query) }
  const frames = new Map(); let frame=0
  win.requestAnimationFrame = cb => { frames.set(++frame,cb); return frame }; win.cancelAnimationFrame = id => frames.delete(id)
  const add = vi.spyOn(win,'addEventListener'), remove=vi.spyOn(win,'removeEventListener')
  let observer
  class IO { constructor(cb) { this.cb=cb; observer=this } observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('window',win); vi.stubGlobal('document',doc); vi.stubGlobal('IntersectionObserver',IO)
  const a={getBoundingClientRect:()=>({left:0,top:0,width:40,height:40})}, b={...a}
  const disposeA=registerMascotMotion(a,vi.fn()), disposeB=registerMascotMotion(b,vi.fn())
  observer.cb([{target:a,isIntersecting:true},{target:b,isIntersecting:true}])
  expect(add.mock.calls.filter(([name])=>name==='pointermove')).toHaveLength(1)
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'))
  expect(remove.mock.calls.some(([name])=>name==='pointermove')).toBe(true)
  doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'))
  const reduced=media.get('(prefers-reduced-motion: reduce)');reduced.matches=true;reduced.dispatchEvent(new Event('change'))
  const calls=add.mock.calls.length
  observer.cb([{target:a,isIntersecting:false},{target:b,isIntersecting:false}])
  disposeA();disposeB()
  expect(frames.size).toBe(0)
  expect(add.mock.calls.length).toBe(calls)
})
