import { describe, it, expect } from 'vitest'
import { isNavActive } from '../../src/lib/navigation'

describe('isNavActive', () => {
  it('khớp đúng đường dẫn, kể cả có dấu / cuối', () => {
    expect(isNavActive('/manage', '/manage')).toBe(true)
    expect(isNavActive('/manage', '/manage/')).toBe(true)
    expect(isNavActive('/history', '/history//')).toBe(true)
  })
  it('trang gốc chỉ active với / và /menu/:id', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/', '/menu/abc')).toBe(true)
    expect(isNavActive('/', '/history')).toBe(false)
  })
  it('gộp route phụ vào tab cha', () => {
    expect(isNavActive('/manage', '/dashboard/')).toBe(true)
    expect(isNavActive('/profile', '/taste')).toBe(true)
  })
  it('không nhầm tab khác', () => {
    expect(isNavActive('/manage', '/history')).toBe(false)
    expect(isNavActive('/history', '/manage/')).toBe(false)
  })
})
