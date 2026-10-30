import { it, expect, vi, afterEach } from 'vitest'
import { inspectAvatarFile, prepareAvatar, replaceAvatarFile } from '../../src/lib/avatar-upload'
afterEach(()=>vi.unstubAllGlobals())
function png(width=100,height=100) {
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12)
  const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height)
  const file=new Blob([bytes],{type:'image/png'});return file
}
it('rejects oversized, disguised, huge-pixel and undecodable image inputs',async()=>{
  await expect(inspectAvatarFile(new Blob([new Uint8Array(2097153)],{type:'image/png'}))).rejects.toThrow('2 MB')
  await expect(inspectAvatarFile(new Blob(['<svg/>'],{type:'image/png'}))).rejects.toThrow()
  await expect(inspectAvatarFile(png(9000,10))).rejects.toThrow('8192')
  await expect(inspectAvatarFile(png(6000,6000))).rejects.toThrow('25')
  vi.stubGlobal('createImageBitmap',async()=>{throw new Error('decode')})
  await expect(prepareAvatar(png())).rejects.toThrow('đọc')
})
it('uses orientation-aware decoding, validates crop and reencodes a 512px square',async()=>{
  const close=vi.fn(), draw=vi.fn();let canvas
  vi.stubGlobal('createImageBitmap',async(_file,options)=> {expect(options.imageOrientation).toBe('from-image');return {width:200,height:100,close}})
  vi.stubGlobal('document',{createElement:()=>canvas={getContext:()=>({drawImage:draw}),toBlob:cb=>cb(new Blob(['safe'],{type:'image/webp'}))}})
  await expect(prepareAvatar(png(),{x:180,y:0,size:100})).rejects.toThrow('Vùng cắt')
  const output=await prepareAvatar(png(),{x:50,y:0,size:100})
  expect(canvas.width).toBe(512);expect(canvas.height).toBe(512)
  expect(output.type).toBe('image/webp');expect(close).toHaveBeenCalledTimes(2)
  expect(draw.mock.calls[0].slice(1)).toEqual([50,0,100,100,0,0,512,512])
})
it('never deletes the previous image before save, cleans new files on failure and stops after account changes',async()=>{
  const events=[], storage={upload:async(path)=>{events.push('upload');return {data:{path},error:null}},remove:async(paths)=>{events.push('delete:'+paths[0]);return {error:null}}}
  const options={uid:'user_a',file:png(),storage,prepare:async()=>new Blob(['safe'],{type:'image/webp'}),isCurrent:()=>true,previousPath:'user_a/old.webp',saveAvatar:async()=>{events.push('save');return {data:{id:'user_a'},error:null}}}
  const result=await replaceAvatarFile(options)
  expect(result.error).toBe(null);expect(events).toEqual(['upload','save','delete:user_a/old.webp'])
  events.length=0
  const failed=await replaceAvatarFile({...options,saveAvatar:async()=>({error:new Error('save failed')})})
  expect(failed.error.message).toBe('save failed');expect(events[1]).toMatch(/^delete:user_a\//)
  let current=true;events.length=0
  const switched=await replaceAvatarFile({...options,isCurrent:()=>current,storage:{...storage,upload:async()=>{current=false;events.push('upload');return {error:null}}}})
  expect(switched.error.name).toBe('AbortError');expect(events).toEqual(['upload'])
  expect(switched.cleanupPath).toMatch(/^user_a\//)
})
it('keeps a successful replacement when old-image cleanup fails',async()=>{
  const result=await replaceAvatarFile({uid:'user_a',file:png(),prepare:async()=>new Blob(['safe'],{type:'image/webp'}),isCurrent:()=>true,previousPath:'user_a/old.webp',storage:{upload:async()=>({error:null}),remove:async()=>({error:new Error('offline')})},saveAvatar:async()=>({data:{id:'user_a'},error:null})})
  expect(result.error).toBe(null);expect(result.cleanupPath).toBe('user_a/old.webp')
})
