import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useCatalog() {
  const { user } = useUser()
  const sb = useSupabaseClient()
  const signedOut = () => ({ data: null, error: new Error('Vui lòng đăng nhập.') })

  async function listRestaurants() {
    if (!user.value?.id) return signedOut()
    return sb.from('restaurants').select('*').eq('is_active', true).order('name').order('branch')
  }

  async function createRestaurant({ name, branch = null }) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
    const cleanBranch = typeof branch === 'string' ? branch.trim() || null : null
    if (!cleanName || cleanName.length > 240 || (cleanBranch?.length ?? 0) > 120) {
      return { data: null, error: new Error('Tên quán hoặc chi nhánh quá dài.') }
    }
    return sb.from('restaurants').insert({ name: cleanName, branch: cleanBranch, created_by: uid }).select('*').single()
  }

  async function listDishes(restaurantId) {
    if (!user.value?.id) return signedOut()
    if (!restaurantId) return { data: [], error: null }
    return sb.from('restaurant_dish_stats').select('*').eq('restaurant_id', restaurantId)
      .eq('is_active', true).order('name').order('variant')
  }

  return { listRestaurants, createRestaurant, listDishes }
}
