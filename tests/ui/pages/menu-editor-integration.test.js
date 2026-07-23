// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import PostMenuPage from '../../../src/pages/PostMenuPage.vue'
import MyMenusPage from '../../../src/pages/MyMenusPage.vue'

const state = vi.hoisted(() => ({
  isSignedIn: true,
  user: { id: 'poster_1' },
}))

const createMenu = vi.fn()
const listMyMenus = vi.fn()
const updateMenu = vi.fn()
const deleteMenu = vi.fn()

vi.mock('@clerk/vue', () => ({
  useUser: () => ({
    user: ref(state.user),
    isLoaded: ref(true),
    isSignedIn: ref(state.isSignedIn),
  }),
}))

vi.mock('../../../src/composables/useMenus', () => ({
  useMenus: () => ({ createMenu, listMyMenus, updateMenu, deleteMenu }),
}))

vi.mock('../../../src/composables/useSettings', () => ({
  useSettings: () => ({ showCalories: ref(false), setShowCalories: vi.fn() }),
}))

const global = {
  stubs: {
    RouterLink: { template: '<a><slot /></a>' },
    SignInModal: true,
    MenuEditorDialog: {
      props: ['menu', 'orders', 'open', 'saving', 'error'],
      emits: ['close', 'save'],
      template: `
        <div v-if="open" data-testid="menu-editor-dialog">
          <span data-testid="dialog-menu-id">{{ menu.id }}</span>
          <span data-testid="dialog-order-count">{{ orders.length }}</span>
          <button data-testid="dialog-save" @click="$emit('save', { id: menu.id, title: 'Cơm gà đã sửa', note: 'Đã cập nhật', order_deadline: '2026-07-23T04:00:00.000Z' })">save</button>
        </div>
      `,
    },
  },
}

describe('menu editor and deadline page integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T03:00:00.000Z'))
    state.isSignedIn = true
    state.user = { id: 'poster_1' }
    createMenu.mockReset().mockResolvedValue({ data: { id: 'created-menu' }, error: null })
    listMyMenus.mockReset().mockResolvedValue({ data: [], error: null })
    updateMenu.mockReset().mockResolvedValue({ data: null, error: null })
    deleteMenu.mockReset().mockResolvedValue({ error: null })
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('submits an optional order deadline when posting a menu', async () => {
    const wrapper = mount(PostMenuPage, { global })

    await wrapper.get('textarea').setValue('Cơm gà')
    await wrapper.get('[data-testid="deadline-input"]').setValue('2026-07-23T11:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createMenu).toHaveBeenCalledWith(expect.objectContaining({
      order_deadline: '2026-07-23T04:00:00.000Z',
    }))
  })

  it('keeps the draft and blocks posting when a newly selected deadline is already past', async () => {
    const wrapper = mount(PostMenuPage, { global })

    await wrapper.get('textarea').setValue('Cơm gà')
    await wrapper.get('[data-testid="deadline-input"]').setValue('2026-07-23T09:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createMenu).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Hạn chót đặt món phải ở tương lai.')
    expect(wrapper.get('textarea').element.value).toBe('Cơm gà')
    expect(wrapper.get('[data-testid="deadline-input"]').element.value).toBe('2026-07-23T09:00')
  })

  it('opens the owner dialog and merges its saved menu fields without refetching', async () => {
    const menu = {
      id: 'menu_1',
      poster_id: 'poster_1',
      menu_date: '2026-07-23',
      title: 'Cơm gà',
      note: 'Ghi chú cũ',
      order_deadline: null,
      orders: [{ id: 'order_1', item_text: 'Cơm gà', is_paid: false }],
    }
    listMyMenus.mockResolvedValue({ data: [menu], error: null })
    updateMenu.mockResolvedValue({
      data: {
        id: 'menu_1',
        title: 'Cơm gà đã sửa',
        note: 'Đã cập nhật',
        order_deadline: '2026-07-23T04:00:00.000Z',
      },
      error: null,
    })
    const wrapper = mount(MyMenusPage, { global })
    await flushPromises()

    await wrapper.get('[data-testid="edit-menu-menu_1"]').trigger('click')
    expect(wrapper.get('[data-testid="dialog-menu-id"]').text()).toBe('menu_1')
    expect(wrapper.get('[data-testid="dialog-order-count"]').text()).toBe('1')

    await wrapper.get('[data-testid="dialog-save"]').trigger('click')
    await flushPromises()

    expect(updateMenu).toHaveBeenCalledWith({
      id: 'menu_1',
      title: 'Cơm gà đã sửa',
      note: 'Đã cập nhật',
      order_deadline: '2026-07-23T04:00:00.000Z',
    })
    expect(listMyMenus).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Cơm gà đã sửa')
    expect(wrapper.text()).toContain('1 đơn')
    expect(wrapper.find('[data-testid="menu-editor-dialog"]').exists()).toBe(false)
  })
})
