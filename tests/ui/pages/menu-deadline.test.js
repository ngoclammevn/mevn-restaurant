// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import MenuPage from '../../../src/pages/MenuPage.vue'
import TodayPage from '../../../src/pages/TodayPage.vue'
import DeadlineStatus from '../../../src/components/ui/DeadlineStatus.vue'
import { draftKey } from '../../../src/lib/orderDraft'

const state = vi.hoisted(() => ({
  user: { id: 'user_1', fullName: 'Minh', imageUrl: '' },
  isLoaded: true,
  routeId: 'menu_1',
  presenceReady: false,
}))
const getMenu = vi.fn()
const listMenusByDate = vi.fn()
const listProfiles = vi.fn()
const createOrder = vi.fn()
const updateOrder = vi.fn()
const togglePaid = vi.fn()
const setMyPicks = vi.fn()

vi.mock('@clerk/vue', () => ({
  useUser: () => ({
    user: ref(state.user),
    isLoaded: ref(state.isLoaded),
    isSignedIn: ref(Boolean(state.user)),
  }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: state.routeId } }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('../../../src/composables/useMenus', () => ({
  useMenus: () => ({ getMenu, listMenusByDate, deleteMenu: vi.fn() }),
}))
vi.mock('../../../src/composables/useOrders', () => ({
  isDeadlineError: (error) => error?.message === 'ORDER_DEADLINE_PASSED',
  useOrders: () => ({ createOrder, updateOrder, togglePaid, listProfiles }),
}))
vi.mock('../../../src/composables/usePresence', () => ({
  getPersonColor: () => '#000',
  usePresence: () => ({
    viewers: ref([]), setActiveDish: vi.fn(), setMyPicks,
    selfRemotePicks: ref([]), myPresenceKey: ref('presence_1'),
    onCartUpdated: vi.fn(), isPresenceReady: ref(state.presenceReady),
  }),
}))

function makeMenu(overrides = {}) {
  return {
    id: 'menu_1',
    title: 'Cơm trưa',
    menu_date: '2026-07-23',
    note: 'Cơm gà',
    order_deadline: '2026-07-23T02:59:00.000Z',
    poster_id: 'poster_1',
    poster: { full_name: 'Người đăng', payment_info: 'STK: 123' },
    orders: [{ id: 'order_1', user_id: 'user_1', item_text: 'Cơm gà', note: null, is_paid: false }],
    ...overrides,
  }
}

const global = {
  stubs: {
    RouterLink: { template: '<a><slot /></a>' },
    SignInModal: true,
    PaymentQRModal: true,
    ConfettiBurst: true,
  },
}

describe('menu deadline UX', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T03:00:00.000Z'))
    getMenu.mockReset().mockResolvedValue({ data: makeMenu(), error: null })
    listMenusByDate.mockReset().mockResolvedValue({ data: [makeMenu()], error: null })
    listProfiles.mockReset().mockResolvedValue({ data: [], error: null })
    createOrder.mockReset().mockResolvedValue({ data: null, error: null })
    updateOrder.mockReset().mockResolvedValue({ data: null, error: null })
    togglePaid.mockReset().mockResolvedValue({ data: { is_paid: true }, error: null })
    setMyPicks.mockReset()
    state.presenceReady = false
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders unlimited, open, closing and closed deadline states and cleans up its timer', async () => {
    const unlimited = mount(DeadlineStatus, { props: { deadline: null } })
    const open = mount(DeadlineStatus, { props: { deadline: '2026-07-23T04:00:00.000Z' } })
    const closing = mount(DeadlineStatus, { props: { deadline: '2026-07-23T03:20:00.000Z' } })
    const closed = mount(DeadlineStatus, { props: { deadline: '2026-07-23T02:59:00.000Z' } })
    expect(unlimited.text()).toContain('không giới hạn')
    expect(open.text()).toContain('Nhận đơn đến')
    expect(closing.text()).toContain('Sắp chốt · Còn 20 phút')
    expect(closing.text()).not.toContain('Sắp chốt · Sắp chốt')
    expect(closed.text()).toContain('Đã chốt đơn')
    unlimited.unmount()
    open.unmount()
    closing.unmount()
    closed.unmount()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('locks new order and order edit after deadline but leaves payment toggle enabled', async () => {
    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    expect(wrapper.get('[data-testid="order-closed-state"]').text()).toContain('Menu đã chốt đơn')
    expect(wrapper.find('[data-testid="order-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="edit-order-order_1"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="paid-toggle"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('maps database deadline rejection, refetches, and retains the order draft', async () => {
    getMenu
      .mockResolvedValueOnce({ data: makeMenu({ order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }), error: null })
      .mockResolvedValueOnce({ data: makeMenu(), error: null })
    createOrder.mockResolvedValue({ data: null, error: { message: 'ORDER_DEADLINE_PASSED' } })
    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    await wrapper.get('textarea').setValue('Cơm gà')
    await wrapper.get('[data-testid="order-form"]').trigger('submit')
    await wrapper.get('[data-testid="confirm-order"]').trigger('click')
    await flushPromises()

    expect(getMenu).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="order-closed-state"]').text()).toContain('Bạn vẫn có thể xem đơn và cập nhật thanh toán')
    expect(wrapper.vm.draft.item_text).toBe('Cơm gà')
    expect(wrapper.vm.phase).toBe('viewing')
    wrapper.unmount()
  })

  it('requires an explicit confirmation before creating an order', async () => {
    getMenu.mockResolvedValue({
      data: makeMenu({ order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }),
      error: null,
    })
    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    await wrapper.get('textarea').setValue('Cơm gà')
    await wrapper.get('[data-testid="order-form"]').trigger('submit')

    expect(createOrder).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="confirm-order"]').text()).toContain('Xác nhận đặt món')

    await wrapper.get('[data-testid="confirm-order"]').trigger('click')
    await flushPromises()

    expect(createOrder).toHaveBeenCalledOnce()
    expect(localStorage.getItem(draftKey('menu_1'))).toBeNull()
    wrapper.unmount()
  })

  it('keeps the complete structured order draft when stale presence picks reconcile during a deadline refetch', async () => {
    state.presenceReady = true
    const structuredNote = JSON.stringify({
      dishes: [{ name: 'Cơm gà', price: 35000 }],
    })
    getMenu
      .mockResolvedValueOnce({ data: makeMenu({ note: structuredNote, order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }), error: null })
      .mockResolvedValueOnce({ data: makeMenu({ note: structuredNote, orders: [] }), error: null })
    createOrder.mockResolvedValue({ data: null, error: { message: 'ORDER_DEADLINE_PASSED' } })
    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    wrapper.vm.toggleDish({ name: 'Cơm gà', price: 35000 })
    wrapper.vm.draft.note = 'Ít cơm'
    wrapper.vm.draft.orderFor = 'user_2'
    await wrapper.get('[data-testid="order-form"]').trigger('submit')
    await wrapper.get('[data-testid="confirm-order"]').trigger('click')
    await flushPromises()

    expect(wrapper.vm.draft.item_text).toBe('Cơm gà')
    expect(wrapper.vm.draft.note).toBe('Ít cơm')
    expect(wrapper.vm.draft.orderFor).toBe('user_2')
    expect(Object.keys(wrapper.vm.picks)).toEqual(['Cơm gà'])
    wrapper.unmount()
  })

  it('keeps restored picks when a stale empty presence event arrives after a deadline refetch', async () => {
    state.presenceReady = true
    const structuredNote = JSON.stringify({
      dishes: [{ name: 'Cơm gà', price: 35000 }],
    })
    getMenu
      .mockResolvedValueOnce({ data: makeMenu({ note: structuredNote, order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }), error: null })
      .mockResolvedValueOnce({ data: makeMenu({ note: structuredNote, orders: [] }), error: null })
    createOrder.mockResolvedValue({ data: null, error: { message: 'ORDER_DEADLINE_PASSED' } })
    const wrapper = mount(MenuPage, { global })
    try {
      await flushPromises()

      wrapper.vm.toggleDish({ name: 'Cơm gà', price: 35000 })
      await wrapper.get('[data-testid="order-form"]').trigger('submit')
      await wrapper.get('[data-testid="confirm-order"]').trigger('click')
      await flushPromises()
      wrapper.vm.applyRemotePicks([])
      await flushPromises()

      expect(wrapper.vm.draft.item_text).toBe('Cơm gà')
      expect(Object.keys(wrapper.vm.picks)).toEqual(['Cơm gà'])
      expect(setMyPicks).toHaveBeenLastCalledWith(['Cơm gà'])
    } finally {
      wrapper.unmount()
    }
  })

  it('refetches the menu when the tab regains focus', async () => {
    const wrapper = mount(MenuPage, { global })
    await flushPromises()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(getMenu).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(getMenu).toHaveBeenCalledTimes(2)
  })

  it('removes stale structured picks when a focus refetch changes the menu', async () => {
    const firstNote = JSON.stringify({ dishes: [{ name: 'Cơm gà', price: 35000 }] })
    const refreshedNote = JSON.stringify({ dishes: [{ name: 'Bún bò', price: 40000 }] })
    getMenu
      .mockResolvedValueOnce({ data: makeMenu({ note: firstNote, order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }), error: null })
      .mockResolvedValueOnce({ data: makeMenu({ note: refreshedNote, order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }), error: null })
    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    wrapper.vm.toggleDish({ name: 'Cơm gà', price: 35000 })
    window.dispatchEvent(new Event('focus'))
    await flushPromises()

    expect(Object.keys(wrapper.vm.picks)).toEqual([])
    expect(wrapper.vm.draft.item_text).toBe('')
    expect(wrapper.text()).toContain('Món không còn trong menu: Cơm gà')
    wrapper.unmount()
  })

  it('keeps valid legacy note data when legacy picks JSON is not an array', async () => {
    getMenu.mockResolvedValue({
      data: makeMenu({ order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }),
      error: null,
    })
    localStorage.setItem('picks_menu_menu_1', JSON.stringify({ invalid: true }))
    sessionStorage.setItem('draft_note_menu_menu_1', 'Không hành')

    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    expect(wrapper.vm.draft.note).toBe('Không hành')
    expect(localStorage.getItem('picks_menu_menu_1')).toBeNull()
    expect(sessionStorage.getItem('draft_note_menu_menu_1')).toBeNull()
    wrapper.unmount()
  })

  it('keeps valid legacy note data when legacy picks JSON is invalid', async () => {
    getMenu.mockResolvedValue({
      data: makeMenu({ order_deadline: '2026-07-23T04:00:00.000Z', orders: [] }),
      error: null,
    })
    localStorage.setItem('picks_menu_menu_1', '{invalid-json')
    sessionStorage.setItem('draft_note_menu_menu_1', 'Ít cơm')

    const wrapper = mount(MenuPage, { global })
    await flushPromises()

    expect(wrapper.vm.draft.note).toBe('Ít cơm')
    expect(localStorage.getItem('picks_menu_menu_1')).toBeNull()
    expect(sessionStorage.getItem('draft_note_menu_menu_1')).toBeNull()
    wrapper.unmount()
  })

  it('shows a deadline and keeps payment available while hiding Today order editing after close', async () => {
    const wrapper = mount(TodayPage, { global })
    await flushPromises()

    expect(wrapper.text()).toContain('Đã chốt đơn')
    expect(wrapper.find('[data-testid="today-edit-order-order_1"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="today-paid-toggle"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('closes the active Today order editor when its deadline passes', async () => {
    listMenusByDate.mockResolvedValue({
      data: [makeMenu({ order_deadline: '2026-07-23T03:00:10.000Z' })],
      error: null,
    })
    const wrapper = mount(TodayPage, { global })
    await flushPromises()

    await wrapper.get('[data-testid="today-edit-order-order_1"]').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('[data-testid="today-edit-order-order_1"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the active Today editor when a focus refetch returns a closed deadline', async () => {
    listMenusByDate
      .mockResolvedValueOnce({ data: [makeMenu({ order_deadline: '2026-07-23T04:00:00.000Z' })], error: null })
      .mockResolvedValueOnce({ data: [makeMenu({ order_deadline: '2026-07-23T02:59:00.000Z' })], error: null })
    const wrapper = mount(TodayPage, { global })
    await flushPromises()

    await wrapper.get('[data-testid="today-edit-order-order_1"]').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)

    window.dispatchEvent(new Event('focus'))
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('[data-testid="today-edit-order-order_1"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
