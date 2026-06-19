import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useDashboard() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function unpaidByPersonForMyMenus(date = todayInVN()) {
    const uid = user.value?.id
    // all my menus on this date, with their unpaid orders + orderer profile
    const { data, error } = await sb.from('menus')
      .select('id,title,orders(id,item_text,is_paid,user_id,user:profiles!orders_user_id_fkey(full_name))')
      .eq('poster_id', uid)
      .eq('menu_date', date)
    if (error) return { error }

    // group unpaid orders across all my menus by person
    const byPerson = new Map()
    for (const menu of data) {
      for (const o of menu.orders) {
        if (o.is_paid) continue
        const entry = byPerson.get(o.user_id) ?? {
          user_id: o.user_id, full_name: o.user?.full_name, items: [],
        }
        entry.items.push({ menu_title: menu.title, item_text: o.item_text, order_id: o.id })
        byPerson.set(o.user_id, entry)
      }
    }
    return { data: [...byPerson.values()] }
  }

  return { unpaidByPersonForMyMenus }
}
