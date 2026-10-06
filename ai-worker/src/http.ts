export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Count bytes while streaming; Content-Length alone is not trustworthy.
export async function readBoundedJson(message: Request | Response, limit: number, oversizedStatus = 413, timeoutMs = 4000): Promise<unknown> {
  const declared = message.headers.get('content-length')
  if (declared && Number(declared) > limit) throw new HttpError(oversizedStatus, 'body_too_large')
  if (!message.body) throw new HttpError(400, 'invalid_body')
  const reader = message.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(408, 'body_timeout'))
      void reader.cancel().catch(() => undefined)
    }, timeoutMs)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      length += value.byteLength
      if (length > limit) {
        void reader.cancel().catch(() => undefined)
        throw new HttpError(oversizedStatus, 'body_too_large')
      }
      chunks.push(value)
    }
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
  } catch {
    throw new HttpError(400, 'invalid_body')
  }
}

export interface Config {
  issuer: string
  origins: string[]
  supabaseUrl: string
  publishableKey: string
}

function secureOrigin(value: string, localAllowed = false): string {
  if (value.length > 2048) throw new Error('invalid_setting')
  const url = new URL(value)
  const isLocal = localAllowed && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((!isLocal && url.protocol !== 'https:') || url.username || url.password || value !== url.origin) throw new Error('invalid_setting')
  return url.origin
}

export function readConfig(env: Pick<Env, 'CLERK_ISSUER' | 'ALLOWED_ORIGINS' | 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>): Config {
  try {
    const issuer = secureOrigin(env.CLERK_ISSUER)
    if (env.ALLOWED_ORIGINS.length > 8192) throw new Error('invalid_setting')
    const origins = env.ALLOWED_ORIGINS.split(',').map(value => secureOrigin(value.trim(), true))
    if (origins.length > 20 || new Set(origins).size !== origins.length) throw new Error('invalid_setting')
    const supabaseUrl = secureOrigin(env.SUPABASE_URL)
    // This service accepts modern public keys only, never legacy JWT service-role keys.
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY) || env.SUPABASE_PUBLISHABLE_KEY.length > 512) throw new Error('invalid_setting')
    return { issuer, origins, supabaseUrl, publishableKey: env.SUPABASE_PUBLISHABLE_KEY }
  } catch {
    throw new HttpError(503, 'service_not_configured')
  }
}

export function jsonResponse(body: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' })
  if (origin) headers.set('Access-Control-Allow-Origin', origin)
  if (status === 429) headers.set('Retry-After', '60')
  return new Response(JSON.stringify(body), { status, headers })
}
