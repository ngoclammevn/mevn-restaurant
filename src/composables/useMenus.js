import { PROFILE_AVATAR_FIELDS } from '../lib/avatar'
import { MENU_CLOSURE_SELECT } from '../lib/menu-select'
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'
import { normalizeMenu } from '../lib/menu'

const MENU_SELECT = '*,restaurant:restaurants!menus_restaurant_id_fkey(id,name,branch),poster:profiles!menus_poster_id_fkey('+PROFILE_AVATAR_FIELDS+',payment_info),'+MENU_CLOSURE_SELECT+',menu_items:menu_items!menu_items_menu_id_fkey(*,dish:restaurant_dishes!menu_items_restaurant_dish_id_fkey(id,restaurant_id,name,variant)),orders:orders!orders_menu_id_fkey(*,user:profiles!orders_user_id_fkey('+PROFILE_AVATAR_FIELDS+'),order_items:order_items!order_items_order_id_menu_id_fkey(*,review:dish_reviews!dish_reviews_order_item_id_fkey(*)))'

function menuResult(result) {
  if (result.error) return result
  const data = Array.isArray(result.data) ? result.data.map(normalizeMenu) : normalizeMenu(result.data)
  return { ...result, data }
}

function savedMenuResult(result) {
  if (result.error) return result
  const data = Array.isArray(result.data) ? result.data[0] : result.data
  return data ? { ...result, data: normalizeMenu(data) }
    : { data: null, error: new Error('Chưa lưu được menu.') }
}

const signedOut = () => ({ data: null, error: new Error('Vui lòng đăng nhập.') })

export function useMenus() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createMenu({ title, menu_date = todayInVN(), note = null, imageFile = null, restaurant_id = null, payment_mode = 'self', sponsor_reason = null }) {
    const uid = user.value?.id
    if (!uid) return signedOut()

    let image_url = null
    let uploadedPath = null
    if (imageFile) {
      const filename = imageFile.name.split(/[\\/]/).at(-1) || 'menu.jpg'
      const path = `${uid}/${crypto.randomUUID()}-${filename}`
      const up = await sb.storage.from('menus').upload(path, imageFile)
      if (up.error) return { data: null, error: up.error }
      uploadedPath = path
      image_url = sb.storage.from('menus').getPublicUrl(path).data.publicUrl
    }

    let result
    try {
      if (user.value?.id !== uid) throw new Error('Tài khoản đã thay đổi. Vui lòng đăng lại menu.')
      // The RPC synchronizes the menu, canonical dishes and menu items atomically.
      result = await sb.rpc('save_lunch_menu_v2', {
        p_title: title, p_menu_date: menu_date, p_note: note,
        p_restaurant_id: restaurant_id || null, p_image_url: image_url, p_payment_mode: payment_mode, p_sponsor_reason: sponsor_reason,
      })
    } catch (error) { result = { data: null, error } }
    if (result.error && uploadedPath) {
      try { await sb.storage.from('menus').remove([uploadedPath]) } catch { /* Keep the original save error. */ }
    }
    return savedMenuResult(result)
  }

  async function listMenusByDate(date = todayInVN()) {
    return menuResult(await sb.from('menus')
      .select(MENU_SELECT)
      .eq('menu_date', date)
      .is('archived_at', null)
      .order('created_at', { ascending: true }))
  }

  async function getMenu(id) {
    return menuResult(await sb.from('menus')
      .select(MENU_SELECT)
      .eq('id', id)
      .single())
  }

  // All menus the current user has posted, across every date, with each
  // order's id + is_paid so the page can show "X đơn · đã trả Y/X".
  async function listMyMenus() {
    const uid = user.value?.id
    if (!uid) return signedOut()
    return menuResult(await sb.from('menus')
      .select(MENU_SELECT)
      .eq('poster_id', uid)
      .order('menu_date', { ascending: false })
      .order('created_at', { ascending: false }))
  }

  async function listPostedMenus({ from, to, status = 'all', offset = 0, limit = 50, includeArchived = false } = {}) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    let query = sb.from('menus').select(MENU_SELECT, { count: 'exact' }).eq('poster_id', uid)
    if (!includeArchived) query = query.is('archived_at', null)
    if (from) query = query.gte('menu_date', from)
    if (to) query = query.lte('menu_date', to)
    if (status !== 'all') query = query.eq('is_closed', status === 'closed')
    const result = await query.order('menu_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + Math.min(limit, 100) - 1)
    return user.value?.id === uid ? menuResult(result) : signedOut()
  }

  async function listPostedUnpaidOrders({ from, to, offset = 0, limit = 100 } = {}) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    let query = sb.from('orders').select('*,user:profiles!orders_user_id_fkey('+PROFILE_AVATAR_FIELDS+'),menu:menus!orders_menu_id_fkey!inner(*,restaurant:restaurants!menus_restaurant_id_fkey(id,name,branch),menu_items:menu_items!menu_items_menu_id_fkey(id,name,price),'+MENU_CLOSURE_SELECT+'),order_items:order_items!order_items_order_id_menu_id_fkey(*)', {count:'exact'}).eq('menu.poster_id',uid).eq('menu.payment_mode','self').eq('is_paid',false)
    if (from) query = query.gte('menu.menu_date', from)
    if (to) query = query.lte('menu.menu_date', to)
    const result = await query.order('id', { ascending: true }).range(offset, offset + Math.min(limit, 100) - 1)
    return user.value?.id === uid ? { ...result, data: result.data?.map(order => ({ ...order, menu: normalizeMenu(order.menu) })) } : signedOut()
  }

  // Edit a menu's title/note. RLS menus_update already limits this to the poster.
  async function updateMenu(changes) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    // An omitted property retains its value, including the date on an older menu.
    const previous = await sb.from('menus').select('title,menu_date,note,restaurant_id,image_url,payment_mode,sponsor_reason')
      .eq('id', changes.id).eq('poster_id', uid).single()
    if (previous.error) return previous
    if (user.value?.id !== uid) return signedOut()
    const value = key => Object.hasOwn(changes, key) ? changes[key] : previous.data[key]
    return savedMenuResult(await sb.rpc('save_lunch_menu_v2', {
      p_id: changes.id, p_title: value('title'), p_menu_date: value('menu_date'),
      p_note: value('note'), p_restaurant_id: value('restaurant_id') || null,
      p_image_url: value('image_url'), p_payment_mode: value('payment_mode'), p_sponsor_reason: value('sponsor_reason'),
    }))
  }

  // Chốt/mở lại nhận đơn. RLS menus_update giới hạn chỉ poster gọi được.
  async function setMenuClosed(id, is_closed, selection = {}) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    const previous = await getMenu(id)
    if (previous.error) return previous
    if (user.value?.id !== uid || previous.data.poster_id !== uid) return signedOut()
    if (!!previous.data.is_closed === !!is_closed) return previous
    const revision = selection.expectedRevision ?? previous.data.current_closure?.revision ?? 0
    const result = is_closed
      ? await sb.rpc('close_lunch_menu', {p_menu_id:id,p_expected_revision:revision,p_primary_user_id:selection.primaryUserId || null,p_backup_user_id:selection.backupUserId || null,p_allow_unassigned:selection.allowUnassigned===true})
      : await sb.rpc('reopen_lunch_menu', {p_menu_id:id,p_expected_revision:revision})
    if (result.error) return result
    if (user.value?.id !== uid) return signedOut()
    const committed = { committed: true, closureResult: is_closed ? result.data : {menu_id:id,revision} }
    try {
      const refreshed = await getMenu(id)
      if (user.value?.id !== uid) return signedOut()
      if (refreshed.error || !refreshed.data) return { ...committed, data:null, error:null, refreshError:refreshed.error || new Error('Chưa tải được menu đã lưu.') }
      return { ...refreshed, ...committed }
    } catch (refreshError) {
      return user.value?.id === uid ? { ...committed, data:null, error:null, refreshError } : signedOut()
    }
  }

  async function deleteMenu(menuId, imageUrl = null) {
    const uid = user.value?.id
    if (!uid) return signedOut()

    const existing = await getMenu(menuId)
    if (existing.error) return existing
    if (user.value?.id !== uid || existing.data?.poster_id !== uid) return signedOut()
    // Closure snapshots reference the menu without cascade, so a once-closed menu is archived too.
    if (existing.data.orders?.length || existing.data.current_closure_id) {
      const archived = await sb.rpc('archive_lunch_menu', {p_menu_id:menuId})
      return {...archived,archived:true}
    }
    const { data, error: dbError } = await sb.from('menus')
      .delete()
      .eq('id', menuId)
      .eq('poster_id', uid)
      .select('id')
      .single()

    if (dbError) return { data: null, error: dbError }

    if (imageUrl) {
      try {
        const bucketPathPrefix = '/storage/v1/object/public/menus/'
        const pathname = new URL(imageUrl).pathname
        const idx = pathname.indexOf(bucketPathPrefix)
        if (idx !== -1) {
          const path = decodeURIComponent(pathname.substring(idx + bucketPathPrefix.length))
          if (!path.startsWith(`${uid}/`)) return { data, error: null }
          await sb.storage.from('menus').remove([path])
        }
      } catch (err) {
        console.error('Failed to delete menu image from storage:', err)
      }
    }

    return { data, error: null }
  }

  return { createMenu, listMenusByDate, getMenu, listMyMenus, listPostedMenus, listPostedUnpaidOrders, updateMenu, setMenuClosed, deleteMenu }
}
