import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  client: null,
  user: { value: { id: 'user_1' } },
}))

vi.mock('@clerk/vue', () => ({
  useUser: () => ({ user: state.user }),
}))

vi.mock('../../../src/lib/supabase', () => ({
  useSupabaseClient: () => state.client,
}))

vi.mock('../../../src/lib/date', () => ({
  todayInVN: () => '2026-07-23',
}))

import { useMenus } from '../../../src/composables/useMenus'

function createMenusClient() {
  const single = vi.fn().mockResolvedValue({ data: { id: 'menu_1' }, error: null })
  const mutationSelect = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: mutationSelect }))
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({ select: mutationSelect })),
  }))
  const finalOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const firstOrder = vi.fn(() => ({ order: finalOrder }))
  const listSelect = vi.fn(() => ({
    eq: vi.fn(() => ({ order: firstOrder })),
  }))
  const from = vi.fn(() => ({ insert, update, select: listSelect }))

  return { client: { from }, insert, update, listSelect }
}

describe('useMenus deadline payloads', () => {
  let api

  beforeEach(() => {
    api = createMenusClient()
    state.client = api.client
  })

  it('includes an explicit deadline when creating a menu', async () => {
    await useMenus().createMenu({
      title: 'Cơm trưa',
      menu_date: '2026-07-23',
      note: 'Hôm nay có cơm gà',
      order_deadline: '2026-07-23T04:00:00.000Z',
    })

    expect(api.insert).toHaveBeenCalledWith(expect.objectContaining({
      poster_id: 'user_1',
      order_deadline: '2026-07-23T04:00:00.000Z',
    }))
  })

  it('clears the deadline when updating a menu', async () => {
    await useMenus().updateMenu({
      id: 'menu_1',
      title: 'Cơm trưa',
      note: 'Đã chỉnh sửa',
      order_deadline: null,
    })

    expect(api.update).toHaveBeenCalledWith({
      title: 'Cơm trưa',
      note: 'Đã chỉnh sửa',
      order_deadline: null,
    })
  })

  it('loads ordered item text for the menu editor usage locks', async () => {
    await useMenus().listMyMenus()

    expect(api.listSelect).toHaveBeenCalledWith(expect.stringContaining('orders(id, item_text, is_paid)'))
  })
})
