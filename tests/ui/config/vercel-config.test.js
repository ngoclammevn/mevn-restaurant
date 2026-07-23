import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const vercelConfig = JSON.parse(
  readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'),
)

describe('Vercel local development', () => {
  it('forwards the dynamic Vercel port to Vite', () => {
    expect(vercelConfig.devCommand).toBe('vite --port $PORT')
  })

  it('does not rewrite API calls or Vite assets to the SPA shell', () => {
    const spaRewrite = vercelConfig.rewrites.at(-1)

    expect(spaRewrite).toEqual({
      source: '/((?!api/|@|src/|node_modules/|.*\\.[^/]+$).*)',
      destination: '/index.html',
    })
  })
})
