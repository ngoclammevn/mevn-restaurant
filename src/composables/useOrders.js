import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useOrders() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createOrder({ menu_id, item_text, note = null }) {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }
    return sb.from('orders')
      .insert({ menu_id, user_id: uid, item_text, note })
      .select()
      .single()
  }

  // Only the order owner can update is_paid (enforced by RLS orders_update).
  async function togglePaid(orderId, isPaid) {
    return sb.from('orders')
      .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
      .eq('id', orderId)
      .select()
      .single()
  }

  async function listMyOrders() {
    const uid = user.value?.id
    return sb.from('orders')
      .select('*, menu:menus(id,title,menu_date)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
  }

  return { createOrder, togglePaid, listMyOrders }
}
