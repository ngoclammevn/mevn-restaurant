import { FEEDBACK_VERSION } from '../../shared/feedback.js'
import { authenticate } from './auth.ts'
import { parseRequest } from './body.ts'
import { loadOwnedDishes } from './database.ts'
import { HttpError, jsonResponse, readConfig } from './http.ts'
import { generateSuggestions, hashText, inferWithBinding } from './suggestions.ts'

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let allowedOrigin: string | undefined
    try {
      const url = new URL(request.url)
      if (url.pathname === '/health' && request.method === 'GET') return jsonResponse({ version: FEEDBACK_VERSION })
      if (url.pathname !== '/v1/feedback-suggestions' || url.search) return jsonResponse({ error: 'not_found' }, 404)
      const config = readConfig(env)
      const origin = request.headers.get('origin')
      if (!origin || !config.origins.includes(origin)) throw new HttpError(403, 'forbidden')
      allowedOrigin = origin
      if (request.method === 'OPTIONS') {
        const requestedHeaders = (request.headers.get('access-control-request-headers') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
        if (request.headers.get('access-control-request-method') !== 'POST' || requestedHeaders.some(value => !['authorization', 'content-type'].includes(value))) throw new HttpError(403, 'forbidden')
        return new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin',
        } })
      }
      if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, allowedOrigin)
      const { token, subject } = await authenticate(request, config)
      const userKey = await hashText(subject)
      // Location-scoped limits bound all authenticated requests, including cache hits.
      const userLimit = await env.USER_RATE_LIMITER.limit({ key: userKey })
      if (!userLimit.success) throw new HttpError(429, 'rate_limited')
      const serviceLimit = await env.SERVICE_RATE_LIMITER.limit({ key: 'feedback-suggestions-v1' })
      if (!serviceLimit.success) throw new HttpError(429, 'rate_limited')
      const body = await parseRequest(request)
      const dishes = await loadOwnedDishes(config, token, subject, body)
      const suggestions = await generateSuggestions(dishes, url.origin, {
        infer: (metadata, signal) => inferWithBinding(env, metadata, signal),
        cache: caches.default,
        waitUntil: promise => ctx.waitUntil(promise),
        observe: event => console.log(JSON.stringify({ event: 'feedback_generation', reason: event.reason, count: event.count })),
      })
      // Only fixed event fields are logged. Never log requests, errors, prompts or tokens.
      console.log(JSON.stringify({ event: 'feedback_suggestions', version: FEEDBACK_VERSION, ai: suggestions.filter(item => item.source === 'ai').length, fallback: suggestions.filter(item => item.source === 'fallback').length }))
      return jsonResponse({ version: FEEDBACK_VERSION, suggestions }, 200, allowedOrigin)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503
      const code = error instanceof HttpError ? error.code : 'service_unavailable'
      console.log(JSON.stringify({ event: 'feedback_rejected', version: FEEDBACK_VERSION, status }))
      return jsonResponse({ error: code }, status, allowedOrigin)
    }
  },
} satisfies ExportedHandler<Env>

export default worker
