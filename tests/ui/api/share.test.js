import { afterEach, describe, expect, it } from 'vitest'
import handler from '../../../api/share'

const originalUrl = process.env.VITE_SUPABASE_URL
const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const image =
  'https://project.supabase.co/storage/v1/object/public/menus/user/menu.png'

afterEach(() => {
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = originalUrl
  if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey
})

function makeResponse() {
  return {
    body: '',
    headers: {},
    location: null,
    statusCode: null,
    redirect(statusCode, location) {
      this.statusCode = statusCode
      this.location = location
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    send(body) {
      this.body = body
      return this
    },
  }
}

async function renderShare(query) {
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const response = makeResponse()
  await handler(
    {
      query,
      headers: {
        host: 'lunch.example',
        'x-forwarded-proto': 'https',
      },
    },
    response,
  )
  return response
}

describe('share metadata without anonymous table access', () => {
  it('serves generic metadata with the allowlisted original image', async () => {
    process.env.VITE_SUPABASE_URL = 'https://project.supabase.co'
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    const response = makeResponse()
    await handler(
      {
        query: { id: 'menu-1', image },
        headers: {
          host: 'lunch.example',
          'x-forwarded-proto': 'https',
        },
      },
      response,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('<title>🍱 Menu cơm trưa</title>')
    expect(response.body).toContain(
      'content="https://lunch.example/api/og-image?image=https%3A%2F%2Fproject.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmenus%2Fuser%2Fmenu.png"',
    )
    expect(response.body).toContain(
      'content="https://lunch.example/menu/menu-1"',
    )
  })

  it('uses the branded endpoint for a legacy link without an image', async () => {
    const response = await renderShare({ id: 'menu-2' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain(
      'content="https://lunch.example/api/og-image"',
    )
  })
})
