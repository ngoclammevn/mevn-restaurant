import { describe, expect, it } from 'vitest'
import { viVN } from '@clerk/localizations'
import { clerkLocalization } from '../../../src/lib/clerkLocalization'

describe('clerkLocalization', () => {
  it('keeps the Vietnamese locale and gives the sign-in screen the product name', () => {
    expect(clerkLocalization.locale).toBe(viVN.locale)
    expect(clerkLocalization.signIn.start).toMatchObject({
      title: 'Đăng nhập vào Cơm Trưa',
      subtitle: 'Đăng nhập bằng tài khoản Google của bạn để tiếp tục',
    })
  })

  it('preserves the remaining Vietnamese sign-in translations', () => {
    expect(clerkLocalization.signIn.password.title).toBe(viVN.signIn.password.title)
    expect(clerkLocalization.signIn.start.actionText).toBe(viVN.signIn.start.actionText)
  })
})
