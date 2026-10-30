import { isOwnAvatarPath } from './avatar'
export const MAX_AVATAR_BYTES = 2097152
const abortError = () => new DOMException('Tài khoản đã thay đổi hoặc đã hủy thao tác.', 'AbortError')
function checkSignal(signal) { if (signal?.aborted) throw abortError() }
function checkDimensions(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('Không đọc được kích thước ảnh.')
  if (width > 8192 || height > 8192) throw new Error('Mỗi cạnh ảnh tối đa 8192 px.')
  if (width * height > 25000000) throw new Error('Ảnh tối đa 25 triệu pixel.')
}
function jpegMetadata(bytes, view) {
  let offset=2, width=0, height=0, orientation=1
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) break
    const marker=bytes[offset++]
    if (marker === 217 || marker === 218) break
    if (marker === 255 || marker === 0 || (marker >= 208 && marker <= 215)) continue
    const length=view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length) break
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 7) {
      height=view.getUint16(offset+3);width=view.getUint16(offset+5)
    }
    // EXIF orientation only; browser decoding applies it and reencoding strips metadata.
    if (marker === 225 && length >= 16 && String.fromCharCode(...bytes.slice(offset+2,offset+8)) === 'Exif\0\0') {
      const tiff=offset+8, little=view.getUint16(tiff)===0x4949
      if (view.getUint16(tiff+2,little)===42) {
        const ifd=tiff+view.getUint32(tiff+4,little), end=offset+length
        if (ifd>=tiff && ifd+2<=end) {
          const count=view.getUint16(ifd,little)
          for (let i=0;i<count;i++) {
            const entry=ifd+2+i*12
            if (entry+12>end) break
            if(view.getUint16(entry,little)===274 && view.getUint16(entry+2,little)===3 && view.getUint32(entry+4,little)===1) orientation=view.getUint16(entry+8,little)
          }
        }
      }
    }
    offset+=length
  }
  return orientation>=5 && orientation<=8 ? {width:height,height:width,orientation} : {width,height,orientation}
}
export async function inspectAvatarFile(file, {signal} = {}) {
  checkSignal(signal)
  if (!file || file.size > MAX_AVATAR_BYTES) throw new Error('Ảnh tối đa 2 MB.')
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Chỉ chọn ảnh JPG, PNG hoặc WebP.')
  const buffer=await file.arrayBuffer();checkSignal(signal)
  const bytes=new Uint8Array(buffer), view=new DataView(buffer)
  let type, width=0, height=0, orientation=1
  if (bytes.length>=24 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) && String.fromCharCode(...bytes.slice(12,16))==='IHDR') {
    type='image/png';width=view.getUint32(16);height=view.getUint32(20)
  } else if(bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) {
    type='image/jpeg';({width,height,orientation}=jpegMetadata(bytes,view))
  } else if(bytes.length>=30 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') {
    type='image/webp'
    const tag=String.fromCharCode(...bytes.slice(12,16))
    if(tag==='VP8X') {width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)}
    else if(tag==='VP8L' && bytes[20]===47) {width=1+bytes[21]+((bytes[22]&63)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)}
    else if(tag==='VP8 ' && bytes[23]===157 && bytes[24]===1 && bytes[25]===42) {width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383}
  }
  if(type!==file.type) throw new Error('Nội dung tệp không khớp định dạng ảnh. Hãy chọn JPG, PNG hoặc WebP thật.')
  checkDimensions(width,height)
  return {type,width,height,orientation}
}
async function decodeImage(file, signal) {
  if(typeof createImageBitmap==='function') {
    const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})
    if(signal?.aborted) {bitmap.close();throw abortError()}
    return bitmap
  }
  const url=URL.createObjectURL(file), image=new Image()
  try {
    await new Promise((resolve,reject)=>{
      const abort=()=>{image.src='';reject(abortError())}
      signal?.addEventListener('abort',abort,{once:true})
      image.onload=()=>{signal?.removeEventListener('abort',abort);resolve()}
      image.onerror=()=>{signal?.removeEventListener('abort',abort);reject(new Error('decode'))}
      image.src=url
    })
    return image
  } finally {URL.revokeObjectURL(url)}
}
export async function prepareAvatar(file, crop, {signal} = {}) {
  await inspectAvatarFile(file,{signal})
  let image
  try {image=await decodeImage(file,signal)} catch(error) {if(error.name==='AbortError')throw error;throw new Error('Không đọc được ảnh. Hãy thử ảnh khác.')}
  try {
    checkSignal(signal)
    const width=image.naturalWidth || image.width, height=image.naturalHeight || image.height
    checkDimensions(width,height)
    const size=Math.min(width,height), chosen=crop ?? {x:(width-size)/2,y:(height-size)/2,size}
    const {x,y,size:edge}=chosen
    if(![x,y,edge].every(Number.isFinite) || x<0 || y<0 || edge<=0 || x+edge>width || y+edge>height) throw new Error('Vùng cắt nằm ngoài ảnh.')
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512
    const context=canvas.getContext('2d')
    if(!context) throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh.')
    context.drawImage(image,x,y,edge,edge,0,0,512,512)
    const encode=type=>new Promise(resolve=>canvas.toBlob(resolve,type,.88))
    let blob=await encode('image/webp')
    if(!blob || blob.type!=='image/webp') blob=await encode('image/jpeg')
    checkSignal(signal)
    if(!blob || !['image/webp','image/jpeg'].includes(blob.type) || blob.size>MAX_AVATAR_BYTES) throw new Error('Chưa xử lý được ảnh dưới 2 MB. Hãy chọn ảnh khác.')
    return blob
  } finally {image.close?.()}
}
// Dependency boundary keeps account-switch and cleanup ordering directly testable.
export async function replaceAvatarFile({uid,file,crop,storage,saveAvatar,isCurrent,previousPath,signal,prepare=prepareAvatar}) {
  let path, saved=false
  try {
    if(!uid || !isCurrent()) throw abortError()
    const blob=await prepare(file,crop,{signal})
    if(!isCurrent()) throw abortError()
    path=`${uid}/${crypto.randomUUID()}.${blob.type==='image/jpeg'?'jpg':'webp'}`
    const upload=await storage.upload(path,blob,{contentType:blob.type,upsert:false,cacheControl:'3600'})
    if(upload.error) throw upload.error
    if(!isCurrent()) throw abortError()
    const result=await saveAvatar({mode:'upload',uploadedPath:path})
    if(result.error) throw result.error
    saved=true
    if(!isCurrent()) return {...result,cleanupPath:previousPath,cleanupError:abortError()}
    if(previousPath && previousPath!==path && isOwnAvatarPath(uid,previousPath)) {
      try {const cleanup=await storage.remove([previousPath]);if(cleanup.error) return {...result,cleanupPath:previousPath,cleanupError:cleanup.error}}
      catch(cleanupError) {return {...result,cleanupPath:previousPath,cleanupError}}
    }
    return {...result,error:null}
  } catch(error) {
    let cleanupPath,cleanupError
    if(path && !saved) {
      if(isCurrent()) {try {const cleanup=await storage.remove([path]);if(cleanup.error){cleanupPath=path;cleanupError=cleanup.error}}catch(failure){cleanupPath=path;cleanupError=failure}}
      else {cleanupPath=path;cleanupError=abortError()}
    }
    return {data:null,error,cleanupPath,cleanupError}
  }
}
