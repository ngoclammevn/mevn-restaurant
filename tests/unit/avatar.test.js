import { describe, it, expect, vi } from 'vitest'
import { defaultMascotForUser, resolveAvatar, providerProfileFields, isOwnAvatarPath } from '../../src/lib/avatar'

describe('avatar preferences', () => {
  it('assigns a stable per-user mascot and honors the member before the provider', () => {
    expect(defaultMascotForUser('user_b')).toBe(defaultMascotForUser('user_b'))
    expect(resolveAvatar({id:'user_b',avatar_mode:'mascot',mascot_id:'fox',avatar_url:'google.jpg'})).toEqual({kind:'mascot',mascotId:'fox'})
    expect(resolveAvatar({id:'user_b',avatar_mode:'auto',provider_has_image:false,avatar_url:'placeholder.jpg'}).kind).toBe('mascot')
    expect(resolveAvatar({id:'user_b',avatar_url:'legacy.jpg'})).toEqual({kind:'image',src:'legacy.jpg'})
  })
  it('falls back from failed images and invalid mascots without accepting another user upload path', () => {
    const profile = {id:'user_b', avatar_mode:'upload',uploaded_avatar_path:'user_b/photo.webp',mascot_id:'invalid'}
    expect(resolveAvatar(profile,{imageFailed:true})).toEqual({kind:'mascot',mascotId:defaultMascotForUser('user_b')})
    expect(isOwnAvatarPath('user_b', 'user_a/photo.webp')).toBe(false)
    expect(isOwnAvatarPath('user_b', 'user_b/../photo.webp')).toBe(false)
    expect(isOwnAvatarPath('user_b', 'user_b/photo.webp')).toBe(true)
    vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co')
    expect(resolveAvatar(profile)).toEqual({kind:'image',src:'https://project.supabase.co/storage/v1/object/public/avatars/user_b/photo.webp'})
    vi.unstubAllEnvs()
  })
  it('syncs only provider fields and preserves unknown hasImage', () => {
    expect(providerProfileFields({id:'user_b',fullName:'B',imageUrl:'b.jpg',hasImage:true,avatar_mode:'upload'})).toEqual({id:'user_b',full_name:'B',avatar_url:'b.jpg',provider_has_image:true})
    expect(providerProfileFields({id:'user_b'}).provider_has_image).toBe(null)
    expect(providerProfileFields(null)).toBe(null)
  })
})
