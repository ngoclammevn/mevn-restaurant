import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useMenus() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createMenu({ title, menu_date = todayInVN(), note = null, imageFile = null }) {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }

    let image_url = null
    if (imageFile) {
      const path = `${uid}/${Date.now()}-${imageFile.name}`
      const up = await sb.storage.from('menus').upload(path, imageFile)
      if (up.error) return { error: up.error }
      image_url = sb.storage.from('menus').getPublicUrl(path).data.publicUrl
    }

    return sb.from('menus')
      .insert({ poster_id: uid, title, menu_date, note, image_url })
      .select()
      .single()
  }

  async function listMenusByDate(date = todayInVN()) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*)')
      .eq('menu_date', date)
      .order('created_at', { ascending: true })
  }

  async function getMenu(id) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*)')
      .eq('id', id)
      .single()
  }

  return { createMenu, listMenusByDate, getMenu }
}
