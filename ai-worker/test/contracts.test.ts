import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'
import { fallbackLabels } from '../../shared/feedback.js'
import { authenticate, fetchPublicJwks } from '../src/auth.ts'
import { parseRequest } from '../src/body.ts'
import { boundedMetadata, loadOwnedDishes, vietnamToday, type Dish } from '../src/database.ts'
import { HttpError, readBoundedJson, readConfig, type Config } from '../src/http.ts'
import worker from '../src/index.ts'
import { cacheKey, generateSuggestions, parseModelResult, type SuggestionRuntime } from '../src/suggestions.ts'

const ORDER = '11111111-1111-4111-8111-111111111111'
const ITEM = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
const MENU = '44444444-4444-4444-8444-444444444444'
const ORIGIN = 'https://lunch.example.test'
const config: Config = { issuer: 'https://clerk.example.test', origins: [ORIGIN], supabaseUrl: 'https://project.example.test', publishableKey: 'sb_publishable_test' }
const body = { order_id: ORDER, order_item_ids: [ITEM], locale: 'vi' as const }
const keys = await generateKeyPair('RS256')
const publicJwk = await exportJWK(keys.publicKey)
const jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] })
const now = Math.floor(Date.now() / 1000)

function request(value: unknown = body): Request {
  return new Request('https://suggestions.example.test/v1/feedback-suggestions', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
}
function statusIs(status: number) {
  return (error: unknown) => error instanceof HttpError && error.status === status
}
async function signed(claims: JWTPayload = {}, signingKey = keys.privateKey): Promise<string> {
  return new SignJWT({ sub: 'user_owner', iss: config.issuer, exp: now + 600, nbf: now - 1, azp: ORIGIN, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(signingKey)
}
async function authRequest(claims: JWTPayload = {}, signingKey = keys.privateKey): Promise<Request> {
  const req = request()
  req.headers.set('Authorization', `Bearer ${await signed(claims, signingKey)}`)
  return req
}

test('body accepts a bounded UUID request and preserves item order', async () => {
  assert.deepEqual(await parseRequest(request({ ...body, order_item_ids: [OTHER, ITEM] })), { ...body, order_item_ids: [OTHER, ITEM] })
})

test('body rejects malformed JSON, foreign fields, invalid IDs, duplicates, locale and item counts', async () => {
  const invalid = [null, {}, { ...body, order_id: 'bad' }, { ...body, order_item_ids: [] }, { ...body, order_item_ids: [ITEM, ITEM] }, { ...body, order_item_ids: Array(21).fill(ITEM) }, { ...body, locale: 'en' }, { ...body, note: 'private' }]
  for (const value of invalid) await assert.rejects(parseRequest(request(value)), statusIs(400))
  await assert.rejects(parseRequest(new Request(request().url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })), statusIs(400))
})

test('oversized streaming and declared bodies return 413', async () => {
  await assert.rejects(parseRequest(new Request(request().url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(16385) })), statusIs(413))
  const req = request()
  req.headers.set('Content-Length', '16385')
  await assert.rejects(parseRequest(req), statusIs(413))
})

test('JWT accepts real RS256 signature, pinned issuer, time claims and azp', async () => {
  assert.equal((await authenticate(await authRequest(), config, jwks)).subject, 'user_owner')
})

test('JWT rejects absent token, bad signature, issuer/azp, expired or premature tokens and missing subject', async () => {
  await assert.rejects(authenticate(request(), config, jwks), statusIs(401))
  for (const claims of [{ iss: 'https://attacker.example.test' }, { azp: 'https://attacker.example.test' }, { exp: now - 60 }, { nbf: now + 60 }, { sub: '' }, { sts: 'pending' }]) {
    await assert.rejects(authenticate(await authRequest(claims), config, jwks), statusIs(401))
  }
  const foreign = await generateKeyPair('RS256')
  await assert.rejects(authenticate(await authRequest({}, foreign.privateKey), config, jwks), statusIs(401))
  const noNbf = new SignJWT({ sub: 'user_owner', iss: config.issuer, exp: now + 600, azp: ORIGIN }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
  const req = request()
  req.headers.set('Authorization', `Bearer ${await noNbf.sign(keys.privateKey)}`)
  await assert.rejects(authenticate(req, config, jwks), statusIs(401))
  req.headers.set('Authorization', `Bearer ${await new SignJWT({ sub: 'user_owner' }).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32))}`)
  await assert.rejects(authenticate(req, config, jwks), statusIs(401))
})

test('JWT azp must match the request origin even when both origins are allowed', async () => {
  const req = await authRequest()
  const preview = 'https://preview.example.test'
  req.headers.set('Origin', preview)
  await assert.rejects(authenticate(req, { ...config, origins: [ORIGIN, preview] }, jwks), statusIs(401))
})

test('public JWKS fetch is bounded, does not forward credentials and refuses redirect responses', async () => {
  for (const result of [Response.json({ keys: [] }), Response.json({ keys: Array(11).fill(publicJwk) }), new Response(' '.repeat(32769)), new Response(null, { status: 302, headers: { Location: 'https://attacker.example.test' } })]) {
    const fetchMock = mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      assert.equal(init?.redirect, 'error')
      assert.equal(new Headers(init?.headers).has('Authorization'), false)
      assert.equal(new Headers(init?.headers).has('Cookie'), false)
      return result
    })
    try {
      await assert.rejects(fetchPublicJwks(`${config.issuer}/.well-known/jwks.json`, { headers: { Authorization: 'never-forward' } }))
    } finally { fetchMock.mock.restore() }
  }
})

test('streamed JSON enforces an absolute deadline even below the byte limit', async () => {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{')) }, cancel() { cancelled = true } })
  await assert.rejects(readBoundedJson(new Response(stream), 1024, 413, 5), statusIs(408))
  assert.ok(cancelled)
})

test('configuration rejects secrets, credentials, paths, wildcard origins and unbounded origin lists', () => {
  const env = { CLERK_ISSUER: config.issuer, ALLOWED_ORIGINS: ORIGIN, SUPABASE_URL: config.supabaseUrl, SUPABASE_PUBLISHABLE_KEY: config.publishableKey }
  for (const override of [{ SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' }, { SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a\nb' }, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }, { SUPABASE_PUBLISHABLE_KEY: 'eyJ.legacy.jwt' }, { CLERK_ISSUER: 'https://user:pass@clerk.example.test' }, { SUPABASE_URL: 'https://project.example.test/path' }, { ALLOWED_ORIGINS: '*' }, { ALLOWED_ORIGINS: 'null' }, { ALLOWED_ORIGINS: 'http://lunch.example.test' }, { ALLOWED_ORIGINS: `${ORIGIN},${ORIGIN}` }, { ALLOWED_ORIGINS: Array.from({ length: 21 }, (_, i) => `https://app${i}.example.test`).join(',') }]) {
    assert.throws(() => readConfig({ ...env, ...override }), statusIs(503))
  }
  assert.deepEqual(readConfig({ ...env, ALLOWED_ORIGINS: 'http://localhost:5173' }).origins, ['http://localhost:5173'])
})

function dbMock(orderOverrides: Record<string, unknown> = {}, itemRows?: unknown[]): { fetcher: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push(url)
    assert.equal(init?.method, 'GET')
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('apikey'), config.publishableKey)
    assert.equal(headers.get('Authorization'), 'Bearer user-token')
    return Response.json(url.includes('/orders?') ? [{ id: ORDER, user_id: 'user_owner', menu_id: MENU, menus: { menu_date: '2026-10-03' }, ...orderOverrides }] :
      itemRows ?? [{ id: ITEM, order_id: ORDER, menu_id: MENU, name_snapshot: 'Gà nướng', menu_items: { category: 'Món chính' } }])
  }
  return { fetcher, calls }
}

test('read-only data calls enforce parent ownership and bounded item metadata', async () => {
  const db = dbMock()
  assert.deepEqual(await loadOwnedDishes(config, 'user-token', 'user_owner', body, db.fetcher, new Date('2026-10-03T05:00:00Z')), [{ id: ITEM, name: 'Gà nướng', category: 'Món chính' }])
  assert.equal(db.calls.length, 2)
  assert.ok(!db.calls.some(url => url.includes('note') || url.includes('restaurant')))
  assert.equal(boundedMetadata('a'.repeat(1000), 120).length, 120)
})

test('group-visible foreign orders fail before item lookup', async () => {
  const db = dbMock({ user_id: 'user_other' })
  await assert.rejects(loadOwnedDishes(config, 'user-token', 'user_owner', body, db.fetcher), statusIs(403))
  assert.equal(db.calls.length, 1)
})

test('delegated order belongs to the recipient; placing user cannot request suggestions', async () => {
  const db = dbMock({ user_id: 'user_recipient', placed_by: 'user_owner' })
  const date = new Date('2026-10-03T05:00:00Z')
  await assert.rejects(loadOwnedDishes(config, 'user-token', 'user_owner', body, db.fetcher, date), statusIs(403))
  assert.equal((await loadOwnedDishes(config, 'user-token', 'user_recipient', body, db.fetcher, date))[0].id, ITEM)
})

test('missing, foreign-order and foreign-menu item IDs share generic 403', async () => {
  for (const rows of [[], [{ id: OTHER, order_id: ORDER, menu_id: MENU, name_snapshot: 'Cá' }], [{ id: ITEM, order_id: OTHER, menu_id: MENU, name_snapshot: 'Cá' }], [{ id: ITEM, order_id: ORDER, menu_id: OTHER, name_snapshot: 'Cá' }]]) {
    await assert.rejects(loadOwnedDishes(config, 'user-token', 'user_owner', body, dbMock({}, rows).fetcher, new Date('2026-10-03T05:00:00Z')), statusIs(403))
  }
})

test('menu dates use Vietnam midnight and reject future/invalid dates', async () => {
  assert.equal(vietnamToday(new Date('2026-10-02T17:00:00Z')), '2026-10-03')
  for (const date of ['2026-10-04', '2026-02-31']) await assert.rejects(loadOwnedDishes(config, 'user-token', 'user_owner', body, dbMock({ menus: { menu_date: date } }).fetcher, new Date('2026-10-02T17:00:00Z')), statusIs(403))
})

function runtime(infer: SuggestionRuntime['infer']): { runtime: SuggestionRuntime; stored: Map<string, Response>; pending: Promise<unknown>[] } {
  const stored = new Map<string, Response>()
  const pending: Promise<unknown>[] = []
  return {
    runtime: {
      infer,
      cache: {
        match: async input => stored.get(input instanceof Request ? input.url : String(input))?.clone(),
        put: async (input, response) => { stored.set(input instanceof Request ? input.url : String(input), response.clone()) },
      },
      waitUntil: promise => { pending.push(promise) },
    }, stored, pending,
  }
}
const dishes: Dish[] = [{ id: ITEM, name: 'Gà nướng', category: 'Món chính' }, { id: OTHER, name: 'Canh rau', category: 'Canh' }]
function modelResult(count = 2): unknown {
  return { response: JSON.stringify({ suggestions: Array.from({ length: count }, (_, index) => { const labels = fallbackLabels(dishes[index % dishes.length].name); return { index, positive: labels.filter((_, i) => i % 2 === 0), negative: labels.filter((_, i) => i % 2 === 1) } }) }) }
}

test('provider quota, invalid output and timeout preserve fallback mapping', async () => {
  for (const infer of [async () => { throw new Error('quota') }, async () => ({ response: '{bad json' }), async () => ({ response: JSON.stringify({ suggestions: [{ index: 99, positive: ['A', 'B'], negative: ['C', 'D'] }] }) })]) {
    const { runtime: rt } = runtime(infer)
    assert.deepEqual(await generateSuggestions(dishes, 'https://service.example.test', rt), dishes.map(dish => ({ order_item_id: dish.id, labels: fallbackLabels(dish.name), source: 'fallback' })))
  }
  let aborted = false
  const { runtime: rt } = runtime((_dishes, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) })))
  assert.equal((await generateSuggestions(dishes, 'https://service.example.test', rt, 1))[0].source, 'fallback')
  assert.ok(aborted)
})

test('valid balanced labels cache via waitUntil; cache is independent of item IDs', async () => {
  let calls = 0
  const { runtime: rt, stored, pending } = runtime(async metadata => { calls++; assert.deepEqual(Object.keys(metadata[0]).sort(), ['category', 'name']); return modelResult(metadata.length) })
  const output = await generateSuggestions(dishes, 'https://service.example.test', rt)
  assert.deepEqual(output[0], { order_item_id: ITEM, labels: fallbackLabels(dishes[0].name), source: 'ai' })
  await Promise.all(pending)
  assert.equal(stored.size, 2)
  for (const key of stored.keys()) assert.match(key, /^https:\/\/service\.example\.test\/\.feedback-cache\/[a-f0-9]{64}$/)
  assert.equal((await generateSuggestions([{ ...dishes[0], id: OTHER }], 'https://service.example.test', rt))[0].order_item_id, OTHER)
  assert.equal(calls, 1)
  assert.equal(await cacheKey(dishes[0]), await cacheKey({ name: ' GÀ   NƯỚNG ', category: 'MÓN CHÍNH' }))
})

test('strict output rejects duplicate labels, missing indexes, long labels and markup', () => {
  for (const value of ['<img>', 'a'.repeat(49), 'Hơi mặn\n', 'Thịt mềm']) {
    const valid = JSON.parse((modelResult(1) as { response: string }).response); valid.suggestions[0].negative[0] = value
    assert.throws(() => parseModelResult({ response: JSON.stringify(valid) }, 1))
  }
  assert.throws(() => parseModelResult(modelResult(1), 2))
})

test('health, unconfigured service, CORS and missing bearer have explicit statuses', async () => {
  const env = { CLERK_ISSUER: config.issuer, ALLOWED_ORIGINS: ORIGIN, SUPABASE_URL: config.supabaseUrl, SUPABASE_PUBLISHABLE_KEY: config.publishableKey } as Env
  const ctx = {} as ExecutionContext
  assert.equal((await worker.fetch(new Request('https://service.example.test/health'), env, ctx)).status, 200)
  assert.equal((await worker.fetch(request(), env, ctx)).status, 401)
  assert.throws(() => readConfig({ ...env, CLERK_ISSUER: '' }), statusIs(503))
  assert.throws(() => readConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }), statusIs(503))
  const foreign = request()
  foreign.headers.set('Origin', 'https://attacker.example.test')
  const response = await worker.fetch(foreign, env, ctx)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
  const preflight = new Request(request().url, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } })
  assert.equal((await worker.fetch(preflight, env, ctx)).status, 204)
})

test('endpoint verifies the pinned public JWKS then rejects user/service rate limits before data or inference', async () => {
  for (const denied of ['user', 'service']) {
    let reads = 0
    const fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      reads++
      assert.equal(String(input), `${config.issuer}/.well-known/jwks.json`)
      return Response.json({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] })
    })
    try {
      let userKey = ''
      let serviceCalls = 0
      const env = {
        CLERK_ISSUER: config.issuer, ALLOWED_ORIGINS: ORIGIN,
        SUPABASE_URL: config.supabaseUrl, SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
        USER_RATE_LIMITER: { limit: async ({ key }: { key: string }) => { userKey = key; return { success: denied !== 'user' } } },
        SERVICE_RATE_LIMITER: { limit: async () => { serviceCalls++; return { success: false } } },
      } as unknown as Env
      const response = await worker.fetch(await authRequest(), env, {} as ExecutionContext)
      assert.equal(response.status, 429)
      assert.equal(response.headers.get('Retry-After'), '60')
      assert.match(userKey, /^[a-f0-9]{64}$/)
      assert.equal(serviceCalls, denied === 'user' ? 0 : 1)
      assert.equal(reads, 1)
    } finally { fetchMock.mock.restore() }
  }
})
