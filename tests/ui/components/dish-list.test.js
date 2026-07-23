// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DishList from '../../../src/components/menu/DishList.vue'
import StickyOrderBar from '../../../src/components/menu/StickyOrderBar.vue'
import OrderOptionsSheet from '../../../src/components/menu/OrderOptionsSheet.vue'

const dishes = [
  { name: 'Cơm gà', price: 45000, category: 'Món chính' },
  { name: 'Trà đá', price: 10000, category: 'Đồ uống' },
]

describe('DishList', () => {
  it('uses an accessible 44px checkbox and communicates selection with text and icon', () => {
    const wrapper = mount(DishList, {
      props: { dishes, selectedNames: ['Cơm gà'] },
    })

    const row = wrapper.get('[data-testid="dish-row-Cơm gà"]')
    const checkbox = row.get('input[type="checkbox"]')
    expect(checkbox.classes()).toContain('dish-row__control--44')
    expect(checkbox.element.checked).toBe(true)
    expect(row.text()).toContain('Đã chọn')
    expect(row.get('[aria-hidden="true"]').text()).toContain('✓')
  })

  it('emits the exact dish name without mutating selectedNames', async () => {
    const selectedNames = ['Cơm gà']
    const wrapper = mount(DishList, { props: { dishes, selectedNames } })

    await wrapper.get('[data-testid="dish-row-Trà đá"] input').trigger('change')

    expect(wrapper.emitted('toggle')).toEqual([['Trà đá']])
    expect(selectedNames).toEqual(['Cơm gà'])
  })
})

describe('StickyOrderBar', () => {
  it('renders the exact formatted total and enables its submit action when dishes are selected', () => {
    const wrapper = mount(StickyOrderBar, {
      props: { count: 2, total: 55000, disabled: false, submitting: false },
    })

    expect(wrapper.text()).toContain('2 món · 55.000đ')
    expect(wrapper.get('[data-testid="sticky-order-submit"]').text()).toContain('Đặt món')
    expect(wrapper.get('[data-testid="sticky-order-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('disables submit and explains the zero-selection state', () => {
    const wrapper = mount(StickyOrderBar, {
      props: { count: 0, total: null, disabled: true, submitting: false },
    })

    expect(wrapper.text()).toContain('0 món')
    expect(wrapper.text()).toContain('Chọn món để đặt')
    expect(wrapper.get('[data-testid="sticky-order-submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('OrderOptionsSheet', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('labels note and beneficiary controls, traps focus, closes on Escape, and restores its trigger focus', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Tuỳ chọn đơn'
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(OrderOptionsSheet, {
      attachTo: document.body,
      props: {
        open: true,
        note: 'Ít cơm',
        orderFor: 'user-2',
        profiles: [{ id: 'user-2', display_name: 'Minh' }],
      },
    })
    await flushPromises()

    expect(wrapper.get('label[for="order-note"]').text()).toBe('Ghi chú')
    expect(wrapper.get('label[for="order-for"]').text()).toBe('Đặt cho')
    expect(wrapper.get('#order-note').element.value).toBe('Ít cơm')
    expect(wrapper.get('#order-for').element.value).toBe('user-2')

    const closeButton = wrapper.get('[data-testid="order-options-close"]')
    closeButton.element.focus()
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(wrapper.get('#order-note').element)

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toEqual([[]])

    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(trigger)
  })
})
