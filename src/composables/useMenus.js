import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useMenus() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createMenu({ title, menu_date = todayInVN(), note = null, imageFile = null, order_deadline = null }) {
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
      .insert({ poster_id: uid, title, menu_date, note, image_url, order_deadline })
      .select()
      .single()
  }

  async function listMenusByDate(date = todayInVN()) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*, user:profiles!orders_user_id_fkey(id,full_name,avatar_url))')
      .eq('menu_date', date)
      .order('created_at', { ascending: true })
  }

  async function getMenu(id) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*, user:profiles!orders_user_id_fkey(id,full_name,avatar_url))')
      .eq('id', id)
      .single()
  }

  // All menus the current user has posted, across every date, with each
  // order's item text + payment state so the owner editor can lock dishes
  // that have already been ordered while the page shows payment progress.
  async function listMyMenus() {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }
    return sb.from('menus')
      .select('*, orders(id, item_text, is_paid)')
      .eq('poster_id', uid)
      .order('menu_date', { ascending: false })
      .order('created_at', { ascending: false })
  }

  // RLS menus_update already limits title, note, and deadline edits to the poster.
  async function updateMenu(input) {
    const { id, title, note = null } = input
    const payload = { title, note }
    if (Object.hasOwn(input, 'order_deadline')) {
      payload.order_deadline = input.order_deadline
    }

    return sb.from('menus')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
  }

  async function deleteMenu(menuId, imageUrl = null) {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }

    const { error: dbError } = await sb.from('menus')
      .delete()
      .eq('id', menuId)
      .eq('poster_id', uid)

    if (dbError) return { error: dbError }

    if (imageUrl) {
      try {
        const bucketPathPrefix = '/storage/v1/object/public/menus/'
        const idx = imageUrl.indexOf(bucketPathPrefix)
        if (idx !== -1) {
          const path = imageUrl.substring(idx + bucketPathPrefix.length)
          await sb.storage.from('menus').remove([path])
        }
      } catch (err) {
        console.error('Failed to delete menu image from storage:', err)
      }
    }

    return { error: null }
  }

  return { createMenu, listMenusByDate, getMenu, listMyMenus, updateMenu, deleteMenu }
}
