import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useDashboard() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function unpaidByPersonForMyMenus(date = todayInVN(), menuId = null) {
    const uid = user.value?.id
    if (!uid) return { data: null, error: new Error('Vui lòng đăng nhập.') }
    // all my menus on this date, with their unpaid orders + orderer profile
    let query = sb.from('menus')
      .select('id,title,restaurant:restaurants!menus_restaurant_id_fkey(name),orders:orders!orders_menu_id_fkey(id,item_text,is_paid,user_id,user:profiles!orders_user_id_fkey(full_name))')
      .eq('poster_id', uid)
      .eq('menu_date', date)
    if (menuId) query = query.eq('id', menuId)
    const { data, error } = await query
    if (error) return { error }

    // group unpaid orders across all my menus by person
    const byPerson = new Map()
    for (const menu of data ?? []) {
      for (const o of menu.orders ?? []) {
        if (o.is_paid) continue
        const entry = byPerson.get(o.user_id) ?? {
          user_id: o.user_id, full_name: o.user?.full_name, items: [],
        }
        entry.items.push({ menu_id: menu.id, menu_title: menu.title, restaurant_name: menu.restaurant?.name ?? null, item_text: o.item_text, order_id: o.id })
        byPerson.set(o.user_id, entry)
      }
    }
    return { data: [...byPerson.values()], error: null }
  }

  return { unpaidByPersonForMyMenus }
}
