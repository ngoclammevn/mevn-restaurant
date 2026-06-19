import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useProfile() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  // Client-side provisioning on first login. NO webhook (would need a backend).
  async function ensureProfile() {
    const u = user.value
    if (!u) return { error: new Error('not signed in') }
    const { error } = await sb.from('profiles').upsert(
      { id: u.id, full_name: u.fullName, avatar_url: u.imageUrl },
      { onConflict: 'id' }, // does not overwrite payment_info
    )
    return { error }
  }

  async function getProfile(id) {
    return sb.from('profiles').select('*').eq('id', id).single()
  }

  async function updateProfile({ full_name, payment_info }) {
    const u = user.value
    return sb.from('profiles')
      .update({ full_name, payment_info })
      .eq('id', u.id)
      .select()
      .single()
  }

  return { ensureProfile, getProfile, updateProfile }
}
