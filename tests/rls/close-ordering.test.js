import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { asUser, admin } from '../helpers/client.js'
import { cleanAll } from '../helpers/seed.js'

const USER_A = 'user_test_A' // poster
const USER_B = 'user_test_B' // member

let menu
let orderByB

beforeEach(async () => {
  await cleanAll()
  await admin.from('profiles').insert([
    { id: USER_A, full_name: 'User A' },
    { id: USER_B, full_name: 'User B' },
  ])
  const { data: m } = await admin
    .from('menus')
    .insert({ poster_id: USER_A, menu_date: '2026-06-23', title: 'Test menu', is_closed: true })
    .select()
    .single()
  menu = m

  const { data: o } = await admin
    .from('orders')
    .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Cơm gà' })
    .select()
    .single()
  orderByB = o
})

afterAll(() => cleanAll())

describe('orders — insert khi menu đã chốt (is_closed = true)', () => {
  it('member không đặt món mới được', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Bún bò' })
    expect(error).not.toBeNull()
  })

  it('đặt hộ người khác cũng bị chặn khi đã chốt', async () => {
    const { error } = await asUser(USER_A)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Đặt hộ' })
    expect(error).not.toBeNull()
  })
})

describe('orders — update/delete khi menu đã chốt', () => {
  it('chủ đơn không sửa được đơn của mình', async () => {
    await asUser(USER_B).from('orders').update({ item_text: 'Sửa rồi' }).eq('id', orderByB.id)

    const { data } = await admin.from('orders').select('item_text').eq('id', orderByB.id).single()
    expect(data.item_text).toBe('Cơm gà')
  })

  it('chủ đơn không xoá được đơn của mình', async () => {
    await asUser(USER_B).from('orders').delete().eq('id', orderByB.id)

    const { data } = await admin.from('orders').select('id').eq('id', orderByB.id)
    expect(data.length).toBe(1)
  })

  it('chủ đơn vẫn tick is_paid được dù đơn đã chốt (thanh toán diễn ra sau khi chốt)', async () => {
    const { error } = await asUser(USER_B)
      .from('orders')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', orderByB.id)
    expect(error).toBeNull()

    const { data } = await admin.from('orders').select('is_paid').eq('id', orderByB.id).single()
    expect(data.is_paid).toBe(true)
  })
})

describe('orders — insert khi menu chưa chốt (đối chứng)', () => {
  it('vẫn đặt món / đặt hộ bình thường khi is_closed = false', async () => {
    await admin.from('menus').update({ is_closed: false }).eq('id', menu.id)

    const { error } = await asUser(USER_A)
      .from('orders')
      .insert({ menu_id: menu.id, user_id: USER_B, item_text: 'Đặt hộ vẫn ok' })
    expect(error).toBeNull()
  })
})

describe('menus — is_closed chỉ poster đổi được', () => {
  it('poster chốt/mở lại đơn của mình', async () => {
    const { error } = await asUser(USER_A).from('menus').update({ is_closed: false }).eq('id', menu.id)
    expect(error).toBeNull()

    const { data } = await asUser(USER_A).from('menus').select('is_closed').eq('id', menu.id).single()
    expect(data.is_closed).toBe(false)
  })

  it('người khác không đổi is_closed của menu người khác', async () => {
    await asUser(USER_B).from('menus').update({ is_closed: false }).eq('id', menu.id)

    const { data } = await admin.from('menus').select('is_closed').eq('id', menu.id).single()
    expect(data.is_closed).toBe(true)
  })
})
