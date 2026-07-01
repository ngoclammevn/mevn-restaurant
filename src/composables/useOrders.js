import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useOrders() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  // user_id optional: pass another person's id to order on their behalf.
  // RLS orders_insert is relaxed to allow this (trusted group <25).
  async function createOrder({ menu_id, item_text, note = null, user_id = null }) {
    if (!user.value?.id) return { error: new Error('not signed in') }
    const uid = user_id ?? user.value.id
    return sb.from('orders')
      .insert({ menu_id, user_id: uid, item_text, note })
      .select()
      .single()
  }

  async function listProfiles() {
    return sb.from('profiles').select('id, full_name, avatar_url').order('full_name')
  }

  // Only the order owner can update is_paid (enforced by RLS orders_update).
  async function togglePaid(orderId, isPaid) {
    return sb.from('orders')
      .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
      .eq('id', orderId)
      .select()
      .single()
  }

  async function updateOrder({ id, item_text, note = null }) {
    return sb.from('orders')
      .update({ item_text, note })
      .eq('id', id)
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

  return { createOrder, updateOrder, togglePaid, listMyOrders, listProfiles }
}
