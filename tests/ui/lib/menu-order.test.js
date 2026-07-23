import { describe, expect, it } from 'vitest'
import {
  calculateSelection,
  canSelfPay,
  exactDishMatches,
  parseStructuredMenu,
} from '../../../src/lib/menuOrder'

const dishes = [
  { name: 'Cơm gà', price: 45000 },
  { name: 'Rau thêm', price: 10000 },
]

describe('menu order rules', () => {
  it('accepts only a valid dishes array', () => {
    expect(parseStructuredMenu(JSON.stringify({ dishes }))).toEqual(dishes)
    expect(parseStructuredMenu('Menu hôm nay')).toBeNull()
    expect(parseStructuredMenu('{"dishes":"invalid"}')).toBeNull()
  })

  it('calculates count and total only when every price is numeric', () => {
    expect(calculateSelection(dishes)).toEqual({ count: 2, total: 55000 })
    expect(calculateSelection([{ name: 'Giá liên hệ' }])).toEqual({ count: 1, total: null })
  })

  it('matches structured order lines exactly', () => {
    expect(exactDishMatches('Cơm gà\nRau thêm', dishes)).toEqual(dishes)
    expect(exactDishMatches('cơm gà', dishes)).toEqual([])
  })

  it('allows payment only for the order owner', () => {
    expect(canSelfPay('user-a', { user_id: 'user-a' })).toBe(true)
    expect(canSelfPay('user-b', { user_id: 'user-a' })).toBe(false)
    expect(canSelfPay('', { user_id: 'user-a' })).toBe(false)
    expect(canSelfPay(' ', { user_id: ' ' })).toBe(false)
  })
})
