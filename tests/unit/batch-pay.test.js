import { describe, it, expect, vi } from 'vitest'
vi.mock('../../src/lib/manage-summary', () => ({ managedOrderAmount: (_menu, order) => order.price ?? null }))
import { batchGroups, batchSummary } from '../../src/lib/batch-pay'

const order = (id, poster, date, price) => ({ id, price, menu: { poster_id: poster, poster: { full_name: poster }, menu_date: date } })

describe('batchGroups', () => {
  it('tách nhóm theo người đăng menu, xếp đơn từ cũ tới mới', () => {
    const groups = batchGroups([order(1, 'a', '2026-11-05', 40000), order(2, 'b', '2026-11-04', 35000), order(3, 'a', '2026-11-03', 45000)])
    expect(groups.map(g => g.posterId)).toEqual(['a', 'b'])
    expect(groups[0].priced.map(e => e.order.id)).toEqual([3, 1])
  })
  it('đơn chưa có giá không được gom', () => {
    const [group] = batchGroups([order(1, 'a', '2026-11-03', 45000), order(2, 'a', '2026-11-04', null)])
    expect(group.priced.map(e => e.order.id)).toEqual([1])
    expect(group.unpriced.map(o => o.id)).toEqual([2])
  })
  it('giá 0 vẫn tính là có giá', () => {
    expect(batchGroups([order(1, 'a', '2026-11-03', 0)])[0].priced).toHaveLength(1)
  })
})

describe('batchSummary', () => {
  it('cộng tổng, lấy khoảng ngày và từng ngày (không lặp)', () => {
    const [group] = batchGroups([order(1, 'a', '2026-11-11', 40000), order(2, 'a', '2026-11-03', 45000), order(3, 'a', '2026-11-09', 30000), order(4, 'a', '2026-11-09', 10000)])
    expect(batchSummary(group.priced)).toEqual({ total: 125000, count: 4, from: '2026-11-03', to: '2026-11-11', dates: ['2026-11-03', '2026-11-09', '2026-11-11'] })
  })
})
