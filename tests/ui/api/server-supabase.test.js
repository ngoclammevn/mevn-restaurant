import ws from 'ws'
import { afterEach, describe, expect, it } from 'vitest'

const originalUrl = process.env.VITE_SUPABASE_URL
const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

afterEach(() => {
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = originalUrl

  if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey
})

describe('server-side Supabase client', () => {
  it('uses an explicit WebSocket transport compatible with Node 20', async () => {
    process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-key'

    const { createServerSupabaseClient } = await import('../../../api/_supabase.js')
    const client = createServerSupabaseClient()

    expect(client.realtime.transport).toBe(ws)
  })

  it('lets the share handler reject a missing id before reading Supabase env', async () => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    const { default: handler } = await import('../../../api/share.js')
    const response = {
      statusCode: null,
      location: null,
      redirect(statusCode, location) {
        this.statusCode = statusCode
        this.location = location
      },
    }

    await handler({ query: {} }, response)

    expect(response).toMatchObject({ statusCode: 307, location: '/' })
  })

  it('fails safely when share metadata cannot access Supabase', async () => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    const { default: handler } = await import('../../../api/share.js')
    const response = {
      statusCode: null,
      location: null,
      redirect(statusCode, location) {
        this.statusCode = statusCode
        this.location = location
      },
    }

    await handler({ query: { id: 'menu-id' } }, response)

    expect(response).toMatchObject({ statusCode: 307, location: '/' })
  })

})
