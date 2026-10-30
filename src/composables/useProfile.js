import { ref, watch } from 'vue'
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { defaultMascotForUser, isOwnAvatarPath, providerProfileFields } from '../lib/avatar'
import { MASCOT_IDS } from '../lib/mascot-catalog'

// Shared so header and presence update immediately after an avatar save.
const currentProfile = ref(null)
export function useProfile() {
  const { user } = useUser()
  const sb = useSupabaseClient()
  watch(() => user.value?.id, id => {
    if (currentProfile.value?.id !== id) currentProfile.value = null
  }, { immediate: true })

  async function ensureProfile() {
    const u = user.value, fields = providerProfileFields(u)
    if (!fields) return { error: new Error('not signed in') }
    const { error } = await sb.from('profiles').upsert(fields, { onConflict: 'id' })
    if (error || user.value?.id !== u.id) return { error }
    // An atomic invoker RPC fills only a missing default, never an existing choice.
    const preference = await sb.rpc('ensure_avatar_preferences', { p_default_mascot_id: defaultMascotForUser(u.id) })
    if (preference.error) return { error: preference.error }
    return getProfile(u.id)
  }
  async function getProfile(id) {
    const result = await sb.from('profiles').select('*').eq('id', id).single()
    if (!result.error && id === user.value?.id) currentProfile.value = result.data
    return result
  }
  async function updateProfile({ full_name, payment_info }) {
    const uid = user.value?.id
    if (!uid) return { data: null, error: new Error('not signed in') }
    const result = await sb.from('profiles').update({ full_name, payment_info }).eq('id', uid).select().single()
    if (!result.error && uid === user.value?.id) currentProfile.value = result.data
    return result
  }
  async function updateAvatar({ mode, mascotId, uploadedPath } = {}) {
    const uid = user.value?.id
    if (!uid) return { data: null, error: new Error('not signed in') }
    if (!['auto', 'mascot', 'upload'].includes(mode) || (mascotId != null && !MASCOT_IDS.includes(mascotId))) {
      return { data: null, error: new Error('Lựa chọn ảnh đại diện không hợp lệ.') }
    }
    const patch = { avatar_mode: mode }
    if (mascotId != null) patch.mascot_id = mascotId
    if (uploadedPath !== undefined) {
      if (uploadedPath !== null && !isOwnAvatarPath(uid, uploadedPath)) return { data: null, error: new Error('Đường dẫn ảnh không hợp lệ.') }
      patch.uploaded_avatar_path = uploadedPath
    }
    const result = await sb.from('profiles').update(patch).eq('id', uid).select().single()
    if (!result.error && uid === user.value?.id) currentProfile.value = result.data
    return result
  }
  return { currentProfile, ensureProfile, getProfile, updateProfile, updateAvatar }
}
