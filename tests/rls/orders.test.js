import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { asUser, admin } from '../helpers/client.js'
import { cleanAll } from '../helpers/seed.js'

const USER_A = 'user_test_A'
const USER_B = 'user_test_B'

let menu
let orderByA
let expiredMenu
let expiredOrderByA

beforeEach(async () => {
  await cleanAll()
  await admin.from('profiles').insert([
    { id: USER_A, full_name: 'User A' },
    { id: USER_B, full_name: 'User B' },
  ])
  const { data: m } = await admin
    .from('menus')
    .insert({ poster_id: USER_A, menu_date: '2026-06-23', title: 'Test menu' })
    .select()
    .single()
  menu = m

  const { data: o } = await admin
    .from('orders')
    .insert({ menu_id: menu.id, user_id: USER_A, item_text: 'Cơm gà' })
    .select()
    .single()
  orderByA = o

  const { data: openMenu } = await admin
    .from('menus')
    .insert({ poster_id: USER_A, menu_date: '2026-06-23', title: 'Menu sẽ chốt' })
    .select()
    .single()

  const { data: openOrder } = await admin
    .from('orders')
    .insert({ menu_id: openMenu.id, user_id: USER_A, item_text: 'Cơm gà' })
    .select()
    .single()

  const { data: closedMenu } = await admin
    .from('menus')
    .update({ order_deadline: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
    .eq('id', openMenu.id)
    .select()
    .single()

  expiredMenu = closedMenu
  expiredOrderByA = openOrder
})

afterAll(() => cleanAll())

describe('orders — select', () => {
  it('tất cả người dùng xem được orders', async () => {
    const { data, error } = await asUser(USER_B).from('orders').select('id')
    expect(error).toBeNull()
    expect(data.map((r) => r.id)).toContain(orderByA.id)
  })
})

describe('orders — insert', () => {
  it('đặt món với user_id = chính mình', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Bún bò' })
    expect(error).toBeNull()
  })

  it('cho phép đặt hộ người khác nhưng đơn thuộc về người được đặt hộ', async () => {
    const { data, error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_A, item_text: 'Đặt giúp A' })
      .select('user_id')
      .single()

    expect(error).toBeNull()
    expect(data.user_id).toBe(USER_A)
  })

  it('vẫn cho tạo đơn khi menu không đặt hạn chót', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Bún chả' })

    expect(error).toBeNull()
  })

  it('cho phép tạo đơn trước deadline', async () => {
    const { data: futureMenu } = await admin
      .from('menus')
      .insert({
        poster_id: USER_A,
        menu_date: '2026-06-23',
        title: 'Menu còn mở',
        order_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: futureMenu.id, user_id: USER_B, item_text: 'Bún bò' })

    expect(error).toBeNull()
  })

  it('chặn tạo đơn sau deadline với lỗi ổn định', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: expiredMenu.id, user_id: USER_B, item_text: 'Bún bò' })

    expect(error?.message).toContain('ORDER_DEADLINE_PASSED')
  })
})

describe('orders — is_paid (hợp đồng quan trọng nhất)', () => {
  it('chủ đơn tự tick is_paid = true', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', orderByA.id)
    expect(error).toBeNull()

    const { data } = await asUser(USER_A).from('orders').select('is_paid').eq('id', orderByA.id).single()
    expect(data.is_paid).toBe(true)
  })

  it('người khác KHÔNG tick is_paid đơn của A (RLS chặn)', async () => {
    await asUser(USER_B)
      .from('orders')
      .update({ is_paid: true })
      .eq('id', orderByA.id)

    // Verify is_paid vẫn là false
    const { data } = await admin.from('orders').select('is_paid').eq('id', orderByA.id).single()
    expect(data.is_paid).toBe(false)
  })

  it('người khác KHÔNG xoá đơn của A', async () => {
    await asUser(USER_B).from('orders').delete().eq('id', orderByA.id)

    const { data } = await admin.from('orders').select('id').eq('id', orderByA.id)
    expect(data.length).toBe(1)
  })
})

describe('orders — deadline', () => {
  it('cho phép chủ đơn self-tick thanh toán sau deadline', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', expiredOrderByA.id)

    expect(error).toBeNull()
  })

  it('cho phép cập nhật timestamp metadata sau deadline', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', expiredOrderByA.id)

    expect(error).toBeNull()
  })

  it('chặn sửa món sau deadline với lỗi ổn định', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .update({ item_text: 'Món khác' })
      .eq('id', expiredOrderByA.id)

    expect(error?.message).toContain('ORDER_DEADLINE_PASSED')
  })

  it('chặn sửa ghi chú sau deadline với lỗi ổn định', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .update({ note: 'Ít cay' })
      .eq('id', expiredOrderByA.id)

    expect(error?.message).toContain('ORDER_DEADLINE_PASSED')
  })

  it('chặn xoá đơn sau deadline với lỗi ổn định', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .delete()
      .eq('id', expiredOrderByA.id)

    expect(error?.message).toContain('ORDER_DEADLINE_PASSED')
  })

  it('người khác vẫn không thể self-tick đơn được đặt hộ sau deadline', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', expiredOrderByA.id)

    expect(error).toBeNull()

    const { data } = await admin
      .from('orders')
      .select('is_paid')
      .eq('id', expiredOrderByA.id)
      .single()
    expect(data.is_paid).toBe(false)
  })

  it('không cho đổi menu hoặc chủ đơn qua update', async () => {
    const { error } = await admin
      .from('orders')
      .update({ user_id: USER_B })
      .eq('id', expiredOrderByA.id)

    expect(error?.message).toContain('ORDER_FIELDS_IMMUTABLE')
  })
})
