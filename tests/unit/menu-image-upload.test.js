import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ user: { value: { id: 'user_a' } }, sb: null }))
vi.mock('@clerk/vue', () => ({ useUser: () => ({ user: state.user }) }))
vi.mock('../../src/lib/supabase.js', () => ({ useSupabaseClient: () => state.sb }))
import { useMenus } from '../../src/composables/useMenus.js'

beforeEach(() => { state.user.value = { id: 'user_a' } })
describe('upload ảnh menu có tên tiếng Việt', () => {
  it.each([
    'Ảnh màn hình 2026-10-30 lúc 08.45.01.png',
    'Ảnh màn hình.png'.normalize('NFD'),
    'Cơm gà 🍚 #1%.png',
  ])('đăng thành công ảnh tên %s', async name => {
    const imageFile = new File(['menu image'], name, { type: 'image/png' })
    let uploadedFile
    const bucket = {
      upload: async (path, file) => {
        uploadedFile = file
        return /[^\x00-\x7F]/.test(path)
          ? { data: null, error: { statusCode: '400', error: 'InvalidKey', message: 'Invalid key' } }
          : { data: { path }, error: null }
      },
      getPublicUrl: path => ({ data: { publicUrl: 'https://example.test/storage/v1/object/public/menus/' + path } }),
      remove: async () => ({ data: [], error: null }),
    }
    state.sb = {
      storage: { from: () => bucket },
      rpc: async (name, payload) => ({ data: { id: 'menu-new', title: payload.p_title, image_url: payload.p_image_url, orders: [], menu_items: [] }, error: null }),
    }
    const result = await useMenus().createMenu({ title: 'Menu có ảnh', imageFile })
    expect(result.error).toBeNull()
    expect(result.data.id).toBe('menu-new')
    expect(result.data.image_url).toMatch(/^https:\/\/example\.test\/storage\/v1\/object\/public\/menus\/user_a\/[A-Za-z0-9._-]+$/)
    expect(uploadedFile).toBe(imageFile)
    expect(uploadedFile.type).toBe('image/png')
  })
})
