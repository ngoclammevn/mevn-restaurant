// @vitest-environment happy-dom
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@clerk/vue', () => ({
  useUser: () => ({
    isSignedIn: ref(false),
    user: ref(null),
  }),
  UserButton: { template: '<div />' },
}))

vi.mock('../../../src/composables/useProfile', () => ({
  useProfile: () => ({ ensureProfile: vi.fn() }),
}))

import App from '../../../src/App.vue'

const EmptyPage = { template: '<div />' }

describe('desktop app navigation', () => {
  it('keeps Quản lý active on its child routes', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/post', component: EmptyPage },
        { path: '/history', component: EmptyPage },
        {
          path: '/manage',
          component: { template: '<router-view />' },
          children: [{ path: 'payments', component: EmptyPage }],
        },
      ],
    })
    await router.push('/manage/payments')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.get('.app-nav a[href="/manage"]').classes()).toContain(
      'router-link-active',
    )
  })
})
