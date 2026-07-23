import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import handler from '../../../api/og-image'
import {
  buildOgImagePath,
  validateMenuImageUrl,
} from '../../../api/_og-image'

const supabaseUrl = 'https://project.supabase.co'
const originalImage =
  'https://project.supabase.co/storage/v1/object/public/menus/user/menu.png'
const originalSupabaseUrl = process.env.VITE_SUPABASE_URL

function makeResponse() {
  return {
    statusCode: null,
    location: null,
    redirect(statusCode, location) {
      this.statusCode = statusCode
      this.location = location
    },
  }
}

describe('validateMenuImageUrl', () => {
  it('accepts an image from the configured public menus bucket', () => {
    expect(validateMenuImageUrl(originalImage, supabaseUrl)).toBe(originalImage)
  })

  it.each([
    'https://evil.example/storage/v1/object/public/menus/menu.png',
    'https://project.supabase.co/storage/v1/object/public/avatars/user.png',
    'http://project.supabase.co/storage/v1/object/public/menus/user/menu.png',
    'not-a-url',
  ])('rejects a foreign or malformed image: %s', (image) => {
    expect(validateMenuImageUrl(image, supabaseUrl)).toBeNull()
  })
})

describe('buildOgImagePath', () => {
  it('encodes a valid original image', () => {
    expect(buildOgImagePath(originalImage, supabaseUrl))
      .toBe(`/api/og-image?image=${encodeURIComponent(originalImage)}`)
  })

  it('uses the static fallback for an invalid image', () => {
    expect(buildOgImagePath('https://evil.example/menu.png', supabaseUrl))
      .toBe('/api/og-image')
  })
})

describe('OG image handler', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = supabaseUrl
  })

  afterEach(() => {
    if (originalSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = originalSupabaseUrl
  })

  it('redirects to the original menu image', () => {
    const response = makeResponse()
    handler({ query: { image: originalImage } }, response)
    expect(response).toMatchObject({ statusCode: 307, location: originalImage })
  })

  it('redirects to the branded fallback without an image', () => {
    const response = makeResponse()
    handler({ query: {} }, response)
    expect(response).toMatchObject({ statusCode: 307, location: '/og-default.png' })
  })
})
