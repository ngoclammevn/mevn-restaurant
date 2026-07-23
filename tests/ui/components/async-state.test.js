// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncState from '../../../src/components/ui/AsyncState.vue'
import SignedOutState from '../../../src/components/ui/SignedOutState.vue'

describe('AsyncState', () => {
  it('shows retry for an error', async () => {
    const wrapper = mount(AsyncState, {
      props: { error: 'Không tải được dữ liệu.' },
      global: { stubs: { RouterLink: true } },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('Không tải được dữ liệu.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders content when no state blocks it', () => {
    const wrapper = mount(AsyncState, {
      slots: { default: '<p>Dữ liệu đã tải</p>' },
    })
    expect(wrapper.text()).toContain('Dữ liệu đã tải')
  })
})

describe('SignedOutState', () => {
  it('uses one shared login action', async () => {
    const wrapper = mount(SignedOutState, {
      global: { stubs: { RouterLink: true } },
    })

    expect(wrapper.text()).toContain('Chưa đăng nhập')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('sign-in')).toHaveLength(1)
  })
})
