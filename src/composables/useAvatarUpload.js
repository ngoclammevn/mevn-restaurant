import { ref, watch, onScopeDispose } from 'vue'
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { useProfile } from './useProfile'
import { isOwnAvatarPath } from '../lib/avatar'
import { replaceAvatarFile } from '../lib/avatar-upload'
const pendingCleanup = new Map()
export function useAvatarUpload() {
  const {user}=useUser(), sb=useSupabaseClient(), {currentProfile,updateAvatar}=useProfile()
  const uploading=ref(false),cleanupPending=ref(false)
  let generation=0,controller
  watch(()=>user.value?.id,()=>{generation++;controller?.abort();uploading.value=false;cleanupPending.value=!!pendingCleanup.get(user.value?.id)?.size},{immediate:true})
  onScopeDispose(()=>{generation++;controller?.abort()})
  async function retryCleanup() {
    const uid=user.value?.id, paths=pendingCleanup.get(uid)
    if(!uid || !paths?.size)return
    for(const path of [...paths]) {
      if(uid!==user.value?.id)return
      if(!isOwnAvatarPath(uid,path) || path===currentProfile.value?.uploaded_avatar_path) {paths.delete(path);continue}
      try {const result=await sb.storage.from('avatars').remove([path]);if(!result.error)paths.delete(path)}catch{/* Retain for an explicit safe retry. */}
    }
    cleanupPending.value=!!paths.size
  }
  async function replaceAvatar(file,crop) {
    if(uploading.value)return {data:null,error:new Error('Ảnh đang được tải lên.')}
    const uid=user.value?.id,current=++generation
    controller?.abort();controller=new AbortController()
    uploading.value=true
    try {
      const result=await replaceAvatarFile({uid,file,crop,storage:sb.storage.from('avatars'),saveAvatar:updateAvatar,
        isCurrent:()=>uid===user.value?.id && current===generation,previousPath:currentProfile.value?.uploaded_avatar_path,signal:controller.signal})
      if(result.cleanupPath) {
        if(!pendingCleanup.has(uid))pendingCleanup.set(uid,new Set())
        pendingCleanup.get(uid).add(result.cleanupPath)
      }
      if(current===generation)cleanupPending.value=!!pendingCleanup.get(uid)?.size
      return result
    } finally {if(current===generation)uploading.value=false}
  }
  return {replaceAvatar,uploading,cleanupPending,retryCleanup}
}
