const MENU_IMAGE_PATH = '/storage/v1/object/public/menus/'

export function validateMenuImageUrl(value, supabaseUrl = process.env.VITE_SUPABASE_URL) {
  if (typeof value !== 'string' || !value || !supabaseUrl) return null

  try {
    const imageUrl = new URL(value)
    const allowedOrigin = new URL(supabaseUrl).origin
    if (imageUrl.origin !== allowedOrigin) return null
    if (!imageUrl.pathname.startsWith(MENU_IMAGE_PATH)) return null
    return imageUrl.toString()
  } catch {
    return null
  }
}

export function buildOgImagePath(value, supabaseUrl = process.env.VITE_SUPABASE_URL) {
  const imageUrl = validateMenuImageUrl(value, supabaseUrl)
  return imageUrl
    ? `/api/og-image?image=${encodeURIComponent(imageUrl)}`
    : '/api/og-image'
}
