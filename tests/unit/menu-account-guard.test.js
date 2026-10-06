import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ user: { value: { id: 'user_a' } }, sb: null }))
vi.mock('@clerk/vue', () => ({ useUser: () => ({ user: state.user }) }))
vi.mock('../../src/lib/supabase.js', () => ({ useSupabaseClient: () => state.sb }))
import { useMenus } from '../../src/composables/useMenus.js'

beforeEach(() => { state.user.value = { id: 'user_a' } })
describe('menu writes use the initiating account', () => {
  it('does not post the first account’s draft after an account switch during image upload', async () => {
    const bucket = {
      upload: vi.fn(async () => { state.user.value = { id: 'user_b' }; return { error: null } }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/menu.jpg' } }),
      remove: vi.fn(async () => ({ error: null })),
    }
    state.sb = { storage: { from: () => bucket }, rpc: vi.fn() }
    const result = await useMenus().createMenu({ title: 'Nháp của A', imageFile: { name: 'menu.jpg' } })
    expect(result.error).toBeTruthy()
    expect(state.sb.rpc).not.toHaveBeenCalled()
    expect(bucket.remove).toHaveBeenCalledOnce()
  })
  it('preserves an old menu’s date when only title/note are edited', async () => {
    const previous = { title: 'Cũ', menu_date: '2026-08-01', note: 'Món cũ', restaurant_id: null, image_url: null }
    const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: previous, error: null }) }
    state.sb = { from: () => chain, rpc: vi.fn(async () => ({ data: { id: 'menu' }, error: null })) }
    await useMenus().updateMenu({ id: 'menu', title: 'Sửa', note: 'Món mới' })
    expect(state.sb.rpc).toHaveBeenCalledWith('save_lunch_menu', expect.objectContaining({ p_menu_date: '2026-08-01', p_title: 'Sửa', p_note: 'Món mới' }))
  })
  it('does not issue an update RPC under a different account after reading the old menu', async () => {
    const chain = { select: () => chain, eq: () => chain, single: async () => {
      state.user.value = { id: 'user_b' }; return { data: {}, error: null }
    } }
    state.sb = { from: () => chain, rpc: vi.fn() }
    const result = await useMenus().updateMenu({ id: 'menu', title: 'Sửa' })
    expect(result.error).toBeTruthy()
    expect(state.sb.rpc).not.toHaveBeenCalled()
  })
})
