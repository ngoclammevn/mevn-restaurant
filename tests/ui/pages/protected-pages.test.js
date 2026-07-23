// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MyMenusPage from '../../../src/pages/MyMenusPage.vue'
import DashboardPage from '../../../src/pages/DashboardPage.vue'

const listMyMenus = vi.fn().mockResolvedValue({ data: [], error: null })
const unpaidByPersonForMyMenus = vi.fn().mockResolvedValue({ data: [], error: null })

vi.mock('@clerk/vue', async () => {
  const { ref } = await import('vue')
  return {
    useUser: () => ({
      user: ref(null),
      isLoaded: ref(true),
      isSignedIn: ref(false),
    }),
  }
})

vi.mock('../../../src/composables/useMenus', () => ({
  useMenus: () => ({
    listMyMenus,
    updateMenu: vi.fn(),
    deleteMenu: vi.fn(),
  }),
}))

vi.mock('../../../src/composables/useDashboard', () => ({
  useDashboard: () => ({ unpaidByPersonForMyMenus }),
}))

const global = {
  stubs: {
    RouterLink: { template: '<a><slot /></a>' },
    SignInModal: true,
  },
}

describe('protected pages while signed out', () => {
  it('does not request My Menus data', async () => {
    mount(MyMenusPage, { global })
    await flushPromises()
    expect(listMyMenus).not.toHaveBeenCalled()
  })

  it('does not request Dashboard data', async () => {
    mount(DashboardPage, { global })
    await flushPromises()
    expect(unpaidByPersonForMyMenus).not.toHaveBeenCalled()
  })
})
