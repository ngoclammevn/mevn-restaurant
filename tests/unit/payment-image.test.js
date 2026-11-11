import { describe, it, expect } from 'vitest'
import { wrapText } from '../../src/lib/payment-image'

describe('wrapText', () => {
  const measure = text => text.length
  it('xuống dòng khi vượt chiều rộng', () => {
    expect(wrapText(measure, 'Lam Truong chuyen tien com 03/11', 12)).toEqual(['Lam Truong', 'chuyen tien', 'com 03/11'])
  })
  it('giữ nguyên từ dài hơn chiều rộng thay vì bỏ', () => {
    expect(wrapText(measure, '0123456789012345', 8)).toEqual(['0123456789012345'])
  })
  it('chuỗi rỗng không ra dòng nào', () => {
    expect(wrapText(measure, '  ', 8)).toEqual([])
  })
})
