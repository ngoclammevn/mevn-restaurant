import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { validateLabels } from '../../shared/feedback'

export function useReviews() {
  const { user } = useUser()
  const sb = useSupabaseClient()
  const signedOut = () => ({ data: null, error: new Error('Vui lòng đăng nhập.') })

  async function saveReview({ order_item_id, rating, labels = [], note = '' }) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    if (!order_item_id || !Number.isInteger(rating) || rating < 1 || rating > 5 || (note != null && typeof note !== 'string') || (note?.length ?? 0) > 1000) {
      return { data: null, error: new Error('Chọn từ 1 đến 5 sao và ghi chú tối đa 1.000 ký tự.') }
    }
    const result = await sb.from('dish_reviews').upsert({
      order_item_id, user_id: uid, rating, labels: validateLabels(labels), note: note?.trim() ?? '',
    }, { onConflict: 'order_item_id' }).select('*').single()
    return user.value?.id === uid ? result : signedOut()
  }

  async function deleteReview(id) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    const result = await sb.from('dish_reviews').delete().eq('id', id).eq('user_id', uid).select('id').single()
    return user.value?.id === uid ? result : signedOut()
  }

  async function listRestaurantReviews(restaurantId) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    if (!restaurantId) return { data: [], error: null }
    const result = await sb.from('restaurant_feedback').select('*').eq('restaurant_id', restaurantId)
      .order('updated_at', { ascending: false }).limit(30)
    return user.value?.id === uid ? result : signedOut()
  }

  async function listDishReviews(restaurantId, restaurantDishId, { limit = 20 } = {}) {
    const uid = user.value?.id
    if (!uid) return signedOut()
    if (!restaurantId || !restaurantDishId) return { data: [], error: null }
    const result = await sb.from('restaurant_feedback').select('*')
      .eq('restaurant_id', restaurantId).eq('restaurant_dish_id', restaurantDishId)
      .order('updated_at', { ascending: false }).limit(Math.min(50, Math.max(1, Number(limit) || 20)))
    return user.value?.id === uid ? result : signedOut()
  }

  return { saveReview, deleteReview, listRestaurantReviews, listDishReviews }
}
