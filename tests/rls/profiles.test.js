import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { asUser, admin } from '../helpers/client.js'
import { cleanAll } from '../helpers/seed.js'

const USER_A = 'user_test_A'
const USER_B = 'user_test_B'

beforeEach(async () => {
  await cleanAll()
  // Seed hai profile qua service role
  await admin.from('profiles').insert([
    { id: USER_A, full_name: 'User A' },
    { id: USER_B, full_name: 'User B', payment_info: 'Momo 09000' },
  ])
})

afterAll(() => cleanAll())

describe('profiles — select', () => {
  it('user đăng nhập đọc được tất cả profile', async () => {
    const { data, error } = await asUser(USER_A).from('profiles').select('id')
    expect(error).toBeNull()
    const ids = data.map((r) => r.id)
    expect(ids).toContain(USER_A)
    expect(ids).toContain(USER_B)
  })
})

describe('profiles — insert', () => {
  it('chỉ tạo được profile của chính mình', async () => {
    await cleanAll()
    const { error } = await asUser(USER_A).from('profiles').insert({ id: USER_A, full_name: 'A' })
    expect(error).toBeNull()
  })

  it('không tạo được profile của người khác', async () => {
    await cleanAll()
    const { error } = await asUser(USER_A).from('profiles').insert({ id: USER_B, full_name: 'Giả' })
    expect(error).not.toBeNull()
  })
})

describe('profiles — update', () => {
  it('chỉ sửa được profile của chính mình', async () => {
    const { error } = await asUser(USER_A)
      .from('profiles')
      .update({ full_name: 'A đã đổi' })
      .eq('id', USER_A)
    expect(error).toBeNull()

    const { data } = await asUser(USER_A).from('profiles').select('full_name').eq('id', USER_A).single()
    expect(data.full_name).toBe('A đã đổi')
  })

  it('không sửa được profile của người khác (RLS lọc — không có lỗi, chỉ 0 dòng bị sửa)', async () => {
    const { error } = await asUser(USER_A)
      .from('profiles')
      .update({ payment_info: 'Giả mạo' })
      .eq('id', USER_B)
    expect(error).toBeNull() // RLS không throw, chỉ trả về 0 dòng

    // Verify payment_info của B không thay đổi
    const { data } = await asUser(USER_A).from('profiles').select('payment_info').eq('id', USER_B).single()
    expect(data.payment_info).toBe('Momo 09000')
  })
})
