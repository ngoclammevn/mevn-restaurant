import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { asUser, admin } from '../helpers/client.js'
import { cleanAll } from '../helpers/seed.js'

const USER_A = 'user_test_A'
const USER_B = 'user_test_B'

let menu
let orderByA

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

  it('không đặt món với user_id là người khác (KHÔNG đặt hộ theo RLS hiện tại)', async () => {
    // Nếu spec muốn cho phép đặt hộ thì policy orders_insert cần nới thành with check (true)
    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_A, item_text: 'Giả mạo' })
    expect(error).not.toBeNull()
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
