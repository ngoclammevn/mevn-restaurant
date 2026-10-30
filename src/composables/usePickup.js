import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { normalizePickupPhone } from '../../shared/pickup.js'

export function usePickup() {
  const { user } = useUser()
  const sb = useSupabaseClient()
  const signedOut = () => ({ data: null, error: new Error('Vui lòng đăng nhập.') })

  async function getPreferences(date) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    const [contact, availability] = await Promise.all([
      sb.from('pickup_contacts').select('phone_e164,updated_at').eq('user_id', uid).maybeSingle(),
      sb.from('pickup_availability').select('available,menu_date,updated_at').eq('user_id', uid).eq('menu_date', date).maybeSingle(),
    ])
    const error = contact.error ?? availability.error
    return { data: error ? null : { contact: contact.data, availability: availability.data }, error }
  }

  async function savePreferences({ date, available, phone }) {
    if (!user.value?.id) return signedOut()
    let normalized = null
    try { if (phone?.trim()) normalized = normalizePickupPhone(phone) }
    catch (error) { return { data: null, error } }
    return sb.rpc('save_pickup_preferences', { p_date: date, p_available: available, p_phone: normalized })
  }

  async function updatePhone(phone) {
    if (!user.value?.id) return signedOut()
    try { return await sb.rpc('update_pickup_phone', { p_phone: normalizePickupPhone(phone) }) }
    catch (error) { return { data: null, error } }
  }

  async function listCandidates(menuId) {
    if (!user.value?.id) return signedOut()
    return sb.rpc('list_pickup_candidates', { p_menu_id: menuId })
  }

  async function getPickup(menuId) {
    if (!user.value?.id) return signedOut()
    const menu = await sb.from('menus').select('current_closure_id').eq('id', menuId).single()
    if (menu.error || !menu.data?.current_closure_id) return { data: null, error: menu.error }
    return sb.from('menu_pickups').select(`*,primary:profiles!menu_pickups_primary_user_id_fkey(id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path),backup:profiles!menu_pickups_backup_user_id_fkey(id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path),contacts:menu_pickup_contacts(user_id,phone_e164)`)
      .eq('closure_id', menu.data.current_closure_id).maybeSingle()
  }

  async function activateBackup(id, version) {
    if (!user.value?.id) return signedOut()
    return sb.rpc('activate_pickup_backup', { p_pickup_id: id, p_expected_version: version })
  }

  async function markReceived(id) {
    if (!user.value?.id) return signedOut()
    return sb.rpc('mark_lunch_received', { p_pickup_id: id })
  }

  return { getPreferences, savePreferences, updatePhone, listCandidates, getPickup, activateBackup, markReceived,
    listPickupCandidates: listCandidates, activatePickupBackup: activateBackup, markLunchReceived: markReceived }
}
