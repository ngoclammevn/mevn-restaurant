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
    expect(state.sb.rpc).toHaveBeenCalledWith('save_lunch_menu_v2', expect.objectContaining({ p_menu_date: '2026-08-01', p_title: 'Sửa', p_note: 'Món mới' }))
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
  it.each([true, false])('keeps committed=%s close/reopen success when the follow-up refresh rejects', async isClosed => {
    const previous = {id:'menu',poster_id:'user_a',is_closed:!isClosed,current_closure:{revision:1}}
    const refreshError = new Error('refresh interrupted')
    const single = vi.fn().mockResolvedValueOnce({data:previous,error:null}).mockRejectedValueOnce(refreshError)
    const chain = {select:()=>chain,eq:()=>chain,single}
    const committed = isClosed ? {menu_id:'menu',closure_id:'closure-2',revision:2} : {...previous,is_closed:false}
    state.sb = {from:()=>chain,rpc:vi.fn(async()=>({data:committed,error:null}))}
    const result = await useMenus().setMenuClosed('menu',isClosed,{primaryUserId:'user_a'})
    expect(result).toMatchObject({committed:true,data:null,error:null,refreshError})
    expect(result.closureResult).toEqual(isClosed ? committed : {menu_id:'menu',revision:1})
    expect(state.sb.rpc).toHaveBeenCalledOnce()
  })
  it('keeps an acknowledged close separate from a returned refresh error without inventing prices', async () => {
    const refreshError = new Error('refresh unavailable')
    const single=vi.fn().mockResolvedValueOnce({data:{id:'menu',poster_id:'user_a',is_closed:false},error:null})
      .mockResolvedValueOnce({data:null,error:refreshError})
    const chain={select:()=>chain,eq:()=>chain,single}
    state.sb={from:()=>chain,rpc:vi.fn(async()=>({data:{menu_id:'menu',closure_id:'closure-1',revision:1},error:null}))}
    expect(await useMenus().setMenuClosed('menu',true,{allowUnassigned:true})).toMatchObject({committed:true,data:null,error:null,refreshError})
  })
})
