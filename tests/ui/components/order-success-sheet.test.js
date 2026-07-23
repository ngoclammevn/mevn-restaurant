// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderSuccessSheet from '../../../src/components/menu/OrderSuccessSheet.vue'
import PaymentQRModal from '../../../src/components/ui/PaymentQRModal.vue'

const order = {
  id: 'order_1',
  user_id: 'user_1',
  item_text: 'Cơm gà',
  user: { full_name: 'Minh' },
}

describe('OrderSuccessSheet', () => {
  it('offers immediate payment or later for the order owner', async () => {
    const wrapper = mount(OrderSuccessSheet, {
      props: { order, orderedForName: 'Minh', canPay: true, hasPaymentInfo: true },
    })

    expect(wrapper.text()).toContain('Thanh toán ngay')
    expect(wrapper.text()).toContain('Để sau')

    await wrapper.get('[data-testid="success-pay"]').trigger('click')
    await wrapper.get('[data-testid="success-later"]').trigger('click')

    expect(wrapper.emitted('pay')).toHaveLength(1)
    expect(wrapper.emitted('later')).toHaveLength(1)
  })

  it('shows a delegated outcome with a copy-link action and no payment action', async () => {
    const wrapper = mount(OrderSuccessSheet, {
      props: { order: { ...order, user_id: 'user_an' }, orderedForName: 'An', canPay: false, hasPaymentInfo: true },
    })

    expect(wrapper.text()).toContain('Đã đặt giúp An')
    expect(wrapper.text()).not.toContain('Thanh toán ngay')
    expect(wrapper.find('[data-testid="success-later"]').exists()).toBe(false)

    await wrapper.get('[data-testid="success-copy-link"]').trigger('click')
    expect(wrapper.emitted('copy-link')).toHaveLength(1)
  })
})

describe('PaymentQRModal', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('does not emit paid when the QR dialog is closed', async () => {
    const wrapper = mount(PaymentQRModal, {
      props: {
        order,
        poster: { payment_info: 'STK: 123456\nNH: VCB\nCTK: Nguyen Van A' },
        menuDate: '2026-07-23',
        menu: { note: JSON.stringify({ dishes: [{ name: 'Cơm gà', price: 30000 }] }) },
      },
    })

    await wrapper.get('.btn-close').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('paid')).toBeUndefined()
  })

  it('emits paid only after the explicit transfer confirmation', async () => {
    const wrapper = mount(PaymentQRModal, {
      props: {
        order,
        poster: { payment_info: 'STK: 123456\nNH: VCB\nCTK: Nguyen Van A' },
        menuDate: '2026-07-23',
        menu: { note: JSON.stringify({ dishes: [{ name: 'Cơm gà', price: 30000 }] }) },
      },
    })

    await wrapper.get('[data-testid="confirm-paid"]').trigger('click')

    expect(wrapper.emitted('paid')).toHaveLength(1)
  })

  it('shows raw payment details and copy controls when structured QR data is missing', async () => {
    const wrapper = mount(PaymentQRModal, {
      props: {
        order,
        poster: { payment_info: 'Ví ZaloPay: 0909 123 456' },
        menuDate: '2026-07-23',
        menu: { note: 'Cơm gà' },
      },
    })

    expect(wrapper.text()).toContain('Ví ZaloPay: 0909 123 456')
    await wrapper.get('[data-testid="copy-payment-info"]').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Ví ZaloPay: 0909 123 456')
  })
})
