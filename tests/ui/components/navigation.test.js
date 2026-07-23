// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBottomNav from '../../../src/components/navigation/AppBottomNav.vue'
import ManageTabs from '../../../src/components/navigation/ManageTabs.vue'
import router from '../../../src/router.js'

const RouterLink = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

describe('AppBottomNav', () => {
  it('contains exactly four primary destinations', () => {
    const wrapper = mount(AppBottomNav, {
      global: { stubs: { RouterLink } },
    })

    expect(wrapper.findAll('.bottom-nav__label').map((label) => label.text())).toEqual([
      'Hôm nay',
      'Đăng menu',
      'Đơn của tôi',
      'Quản lý',
    ])
  })

  it.each(['/manage/menus', '/manage/payments'])(
    'keeps Quản lý active at %s',
    async (path) => {
      await router.push(path)
      await router.isReady()
      const wrapper = mount(AppBottomNav, {
        global: { plugins: [router] },
      })

      expect(wrapper.get('a[href="/manage"]').classes()).toContain('router-link-active')
    },
  )
})

describe('ManageTabs', () => {
  it('contains menu and payment views', () => {
    const wrapper = mount(ManageTabs, {
      global: { stubs: { RouterLink } },
    })

    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Menu của tôi',
      'Thu tiền',
    ])
  })
})

describe('route compatibility', () => {
  it.each([
    ['/my-menus', '/manage/menus'],
    ['/dashboard', '/manage/payments'],
  ])('redirects %s to %s', async (from, to) => {
    await router.push(from)
    await router.isReady()
    expect(router.currentRoute.value.path).toBe(to)
  })

  it('marks the menu detail route as focused and wide', () => {
    const resolved = router.resolve('/menu/menu-1')
    expect(resolved.meta).toMatchObject({ focused: true, layout: 'wide' })
  })
})
