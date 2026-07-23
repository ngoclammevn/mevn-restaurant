import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { asUser, admin } from '../helpers/client.js'
import { cleanAll } from '../helpers/seed.js'

const USER_A = 'user_test_A'
const USER_B = 'user_test_B'

let menuByA

beforeEach(async () => {
  await cleanAll()
  await admin.from('profiles').insert([
    { id: USER_A, full_name: 'User A' },
    { id: USER_B, full_name: 'User B' },
  ])
  const { data } = await admin
    .from('menus')
    .insert({ poster_id: USER_A, menu_date: '2026-06-23', title: 'Menu của A' })
    .select()
    .single()
  menuByA = data
})

afterAll(() => cleanAll())

describe('menus — select', () => {
  it('tất cả người dùng xem được menu', async () => {
    const { data, error } = await asUser(USER_B).from('menus').select('id')
    expect(error).toBeNull()
    expect(data.map((r) => r.id)).toContain(menuByA.id)
  })
})

describe('menus — insert', () => {
  it('đăng menu với poster_id = chính mình', async () => {
    const { error } = await asUser(USER_B)
      .from('menus')
      .insert({ poster_id: USER_B, menu_date: '2026-06-23', title: 'Menu của B' })
    expect(error).toBeNull()
  })

  it('không đăng menu với poster_id là người khác', async () => {
    const { error } = await asUser(USER_B)
      .from('menus')
      .insert({ poster_id: USER_A, menu_date: '2026-06-23', title: 'Giả mạo' })
    expect(error).not.toBeNull()
  })
})

describe('menus — update / delete', () => {
  it('chủ menu sửa được menu của mình', async () => {
    const { error } = await asUser(USER_A)
      .from('menus')
      .update({ title: 'Menu A đã sửa' })
      .eq('id', menuByA.id)
    expect(error).toBeNull()
  })

  it('chủ menu đặt rồi bỏ hạn chót của menu mình', async () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { error: setError } = await asUser(USER_A)
      .from('menus')
      .update({ order_deadline: deadline })
      .eq('id', menuByA.id)
    expect(setError).toBeNull()

    const { data: withDeadline } = await asUser(USER_A)
      .from('menus')
      .select('order_deadline')
      .eq('id', menuByA.id)
      .single()
    expect(withDeadline.order_deadline).not.toBeNull()

    const { error: clearError } = await asUser(USER_A)
      .from('menus')
      .update({ order_deadline: null })
      .eq('id', menuByA.id)
    expect(clearError).toBeNull()

    const { data: cleared } = await asUser(USER_A)
      .from('menus')
      .select('order_deadline')
      .eq('id', menuByA.id)
      .single()
    expect(cleared.order_deadline).toBeNull()
  })

  it('người khác không sửa được menu của A (0 dòng, không lỗi)', async () => {
    await asUser(USER_B).from('menus').update({ title: 'Cướp menu' }).eq('id', menuByA.id)

    const { data } = await asUser(USER_A).from('menus').select('title').eq('id', menuByA.id).single()
    expect(data.title).toBe('Menu của A')
  })

  it('chủ menu xoá được menu của mình', async () => {
    const { error } = await asUser(USER_A).from('menus').delete().eq('id', menuByA.id)
    expect(error).toBeNull()
  })

  it('người khác không xoá được menu của A', async () => {
    await asUser(USER_B).from('menus').delete().eq('id', menuByA.id)

    const { data } = await asUser(USER_A).from('menus').select('id').eq('id', menuByA.id)
    expect(data.length).toBe(1)
  })
})
