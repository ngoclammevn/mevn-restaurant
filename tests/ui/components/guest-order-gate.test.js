// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GuestOrderGate from '../../../src/components/menu/GuestOrderGate.vue'

const SignInModal = {
  emits: ['close'],
  template: '<button data-testid="sign-in-modal" @click="$emit(\'close\')">Đăng nhập</button>',
}

function mountGate(props) {
  return mount(GuestOrderGate, {
    props,
    global: { stubs: { SignInModal } },
  })
}

describe('GuestOrderGate', () => {
  it('renders the sign-in modal for an open guest gate', () => {
    const wrapper = mountGate({ open: true, isSignedIn: false })

    expect(wrapper.get('[data-testid="sign-in-modal"]').isVisible()).toBe(true)
  })

  it('emits authenticated once when sign-in completes', async () => {
    const wrapper = mountGate({ open: true, isSignedIn: false })

    await wrapper.setProps({ isSignedIn: true })
    await wrapper.setProps({ isSignedIn: true })

    expect(wrapper.emitted('authenticated')).toHaveLength(1)
  })

  it('emits cancel when the modal closes before sign-in', async () => {
    const wrapper = mountGate({ open: true, isSignedIn: false })

    await wrapper.get('[data-testid="sign-in-modal"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
