import { MASCOT_IDS } from './mascot-catalog'

export const PROFILE_AVATAR_FIELDS = 'id,full_name,avatar_url,provider_has_image,avatar_mode,mascot_id,uploaded_avatar_path'
export function defaultMascotForUser(userId) {
  let hash = 2166136261
  for (const char of String(userId || '')) hash = Math.imul(hash ^ char.codePointAt(0), 16777619)
  return MASCOT_IDS[(hash >>> 0) % MASCOT_IDS.length]
}
export function isOwnAvatarPath(userId, path) {
  if (!userId || typeof path !== 'string') return false
  const parts = path.split('/')
  return parts.length === 2 && parts[0] === userId && /^[a-zA-Z0-9_-]+\.(webp|jpe?g|png)$/.test(parts[1])
}
export function avatarStorageUrl(userId, path) {
  if (!isOwnAvatarPath(userId, path)) return null
  const configured = import.meta.env.VITE_SUPABASE_URL
  if (!configured) return null
  try {
    const base = new URL(configured)
    if (!['https:', 'http:'].includes(base.protocol)) return null
    return `${base.origin}/storage/v1/object/public/avatars/${path.split('/').map(encodeURIComponent).join('/')}`
  } catch { return null }
}
export function resolveAvatar(profile = {}, { imageFailed = false } = {}) {
  profile ||= {}
  const mascotId = MASCOT_IDS.includes(profile.mascot_id) ? profile.mascot_id : defaultMascotForUser(profile.id)
  if (!imageFailed) {
    if (profile.avatar_mode === 'upload') {
      const src = avatarStorageUrl(profile.id, profile.uploaded_avatar_path)
      if (src) return { kind: 'image', src }
    } else if (profile.avatar_mode !== 'mascot' && profile.provider_has_image !== false && profile.avatar_url) {
      return { kind: 'image', src: profile.avatar_url }
    }
  }
  return { kind: 'mascot', mascotId }
}
export function providerProfileFields(user) {
  if (!user?.id) return null
  return { id: user.id, full_name: user.fullName ?? null, avatar_url: user.imageUrl ?? null,
    provider_has_image: typeof user.hasImage === 'boolean' ? user.hasImage : null }
}
