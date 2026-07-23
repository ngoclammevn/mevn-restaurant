// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderDeadlineField from '../../../src/components/ui/OrderDeadlineField.vue'

const fixedNow = new Date('2026-07-23T03:00:00.000Z')

describe('OrderDeadlineField', () => {
  it('shows quick deadline actions and emits an ISO value', async () => {
    const wrapper = mount(OrderDeadlineField, {
      props: { modelValue: null, now: fixedNow },
    })

    await wrapper.get('[data-testid="deadline-plus-30m"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-07-23T03:30:00.000Z'])
  })

  it('keeps an unchanged persisted past deadline valid', async () => {
    const expired = '2026-07-23T09:00:00+07:00'
    const wrapper = mount(OrderDeadlineField, {
      props: { modelValue: expired, originalValue: expired, now: fixedNow },
    })

    expect(wrapper.find('[data-testid="deadline-error"]').exists()).toBe(false)
    await wrapper.get('[data-testid="deadline-input"]').setValue('2026-07-23T08:00')
    expect(wrapper.get('[data-testid="deadline-error"]').text()).toContain('phải ở tương lai')
  })

  it('keeps a persisted past deadline with seconds and milliseconds valid', () => {
    const expired = '2026-07-23T02:00:30.123Z'
    const wrapper = mount(OrderDeadlineField, {
      props: { modelValue: expired, originalValue: expired, now: fixedNow },
    })

    expect(wrapper.get('[data-testid="deadline-input"]').element.value).toBe('2026-07-23T09:00')
    expect(wrapper.find('[data-testid="deadline-error"]').exists()).toBe(false)
  })
})
