// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TextField from '../../../src/components/ui/TextField.vue'
import TextArea from '../../../src/components/ui/TextArea.vue'
import DateField from '../../../src/components/ui/DateField.vue'
import Spinner from '../../../src/components/ui/Spinner.vue'
import AppButton from '../../../src/components/ui/AppButton.vue'

describe('form primitives', () => {
  it.each([
    [TextField, 'input'],
    [TextArea, 'textarea'],
  ])('connects label, hint and error for %s', (component, selector) => {
    const wrapper = mount(component, {
      props: {
        label: 'Ghi chú',
        hint: 'Không bắt buộc',
        error: 'Không hợp lệ',
      },
    })
    const control = wrapper.get(selector)
    const id = control.attributes('id')

    expect(id).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(id)
    expect(control.attributes('aria-describedby')).toContain(`${id}-hint`)
    expect(control.attributes('aria-describedby')).toContain(`${id}-error`)
    expect(control.attributes('aria-invalid')).toBe('true')
  })

  it('connects the date label to its control', () => {
    const wrapper = mount(DateField, { props: { label: 'Ngày đặt cơm' } })
    const control = wrapper.get('input')
    const id = control.attributes('id')
    expect(id).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(id)
  })
})

describe('loading semantics', () => {
  it('announces spinner status', () => {
    const wrapper = mount(Spinner, { props: { label: 'Đang tải menu…' } })
    expect(wrapper.get('[role="status"]').text()).toContain('Đang tải menu')
  })

  it('marks loading buttons busy', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Đặt món' },
      global: { stubs: { RouterLink: true } },
    })
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
  })
})
