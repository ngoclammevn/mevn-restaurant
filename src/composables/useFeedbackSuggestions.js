import { onUnmounted, watch } from 'vue'
import { useSession } from '@clerk/vue'
import { fallbackLabels, relevantFeedbackLabels, validateSuggestionLabels } from '../../shared/feedback'

export function useFeedbackSuggestions() {
  const { session } = useSession()
  let controller
  function cancel() { controller?.abort() }
  watch(() => session.value?.id, cancel)
  onUnmounted(cancel)
  async function suggest(order, items) {
    cancel()
    const fallback = items.map(item => ({ order_item_id: item.id, labels: fallbackLabels(item.name_snapshot), source: 'local' }))
    let base
    try {
      base = new URL(import.meta.env.VITE_AI_API_BASE_URL)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash || base.pathname !== '/') return fallback
    } catch { return fallback }
    const sessionId = session.value?.id
    const request = new AbortController()
    controller = request
    // Leave time for JWKS and Supabase reads before the Worker's inference deadline.
    const timeout = setTimeout(() => request.abort(), 15000)
    try {
      const token = await Promise.race([session.value?.getToken(), new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))])
      if (!token || request.signal.aborted || session.value?.id !== sessionId) return fallback
      const response = await fetch(`${base.origin}/v1/feedback-suggestions`, {
        method: 'POST', signal: request.signal,
        credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: order.id, order_item_ids: items.map(item => item.id), locale: 'vi' }),
      })
      if (!response.ok) return fallback
      const result = await response.json()
      if (request.signal.aborted || controller !== request || session.value?.id !== sessionId) return fallback
      if (result.version !== '1' || !Array.isArray(result.suggestions)) return fallback
      return fallback.map((local, index) => {
        const match = result.suggestions.find(value => value.order_item_id === local.order_item_id)
        const labels = relevantFeedbackLabels(match?.labels, items[index].name_snapshot)
        return labels.length >= 8 ? { ...local, labels: validateSuggestionLabels([...labels, ...local.labels]), source: match.source === 'ai' ? 'ai' : 'fallback' } : local
      })
    } catch { return fallback }
    finally { clearTimeout(timeout) }
  }
  return { suggest, cancel }
}
