// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@clerk/vue', () => {
  const UserButton = {
    template: '<div data-test="user-button"><slot /></div>',
  }

  UserButton.MenuItems = {
    template: '<div data-test="menu-items"><slot /></div>',
  }
  UserButton.Link = {
    props: ['href', 'label'],
    template: '<a :href="href">{{ label }}<slot name="labelIcon" /></a>',
  }
  UserButton.Action = {
    props: ['label', 'onClick'],
    template: '<button type="button" @click="onClick">{{ label }}<slot name="labelIcon" /></button>',
  }

  return { UserButton }
})

import AccountMenu from '../../../src/components/navigation/AccountMenu.vue'

describe('AccountMenu', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(AccountMenu)
  })

  it('adds profile and changelog entries to the Clerk menu', () => {
    expect(wrapper.get('a').attributes('href')).toBe('/profile')
    expect(wrapper.get('a').text()).toContain('Hồ sơ')
    expect(wrapper.get('button').text()).toContain('Có gì mới')
  })

  it('asks the app to open the changelog', async () => {
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('show-changelog')).toHaveLength(1)
  })
})
