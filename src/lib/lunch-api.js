import { useSession } from '@clerk/vue'

export class LunchApiError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status }
}

// Create once inside setup, so every call reads the current Clerk session.
export function useLunchApi() {
  const { session } = useSession()
  async function callLunchApi(path, body, { signal } = {}) {
    const current = session.value
    if (!current) throw new LunchApiError('unauthenticated', 401)
    let base
    try {
      base = new URL(import.meta.env.VITE_AI_API_BASE_URL)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) || base.origin !== import.meta.env.VITE_AI_API_BASE_URL || base.username || base.password) throw Error()
    } catch { throw new LunchApiError('service_not_configured') }
    if (!/^\/v1\/slack\/[a-z-]+$/.test(path)) throw new LunchApiError('invalid_path')
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, 25000)
    try {
      if (controller.signal.aborted) throw new LunchApiError('request_interrupted')
      const token = await Promise.race([current.getToken(), new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new LunchApiError('request_interrupted')), { once: true }))])
      if (!token || session.value?.id !== current.id) throw new LunchApiError('session_changed', 401)
      const response = await fetch(`${base.origin}${path}`, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      const result = await response.json()
      if (session.value?.id !== current.id) throw new LunchApiError('session_changed', 401)
      if (!response.ok) throw new LunchApiError(result.error || 'request_failed', response.status)
      return result
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
  }
  return { callLunchApi }
}
