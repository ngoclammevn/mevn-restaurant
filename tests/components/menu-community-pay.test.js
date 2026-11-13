import { afterEach, expect, test, vi } from 'vitest'
import { mountHost, hostFind, hostText } from '../helpers/vue-host.js'
const toggled = []
vi.mock('@clerk/vue', async () => { const { ref } = await import('vue'); return { useUser: () => ({ user: ref({ id: 'me' }) }) } })
vi.mock('../../src/composables/usePickup', () => ({ usePickup: () => ({ getPickup: async () => ({ data: null }) }) }))
vi.mock('../../src/composables/useSlackNotifications', () => ({ useSlackNotifications: () => ({}) }))
vi.mock('../../src/composables/useOrders', () => ({ useOrders: () => ({ togglePaid: async (id, value) => { toggled.push([id, value]); return { data: { is_paid: true } } } }) }))
vi.mock('../../src/components/ui/Avatar.vue', async () => { const { h } = await import('vue'); return { default: () => h('span') } })
vi.mock('../../src/components/ui', async () => {
  const { h } = await import('vue')
  return {
    AppButton: (_props, { slots, attrs }) => h('button', attrs, slots.default?.()),
    PaidStamp: () => h('span'),
    PaymentQRModal: { props: ['order'], emits: ['paid'], setup: (props, { emit }) => () => h('button', { id: 'pay', order: props.order.id, onClick: () => emit('paid') }, 'Tôi đã chuyển tiền') },
  }
})
import MenuCommunity from '../../src/components/MenuCommunity.vue'
const order = (id, user_id, is_paid = false) => ({ id, user_id, is_paid, item_text: 'Cơm gà', user: { full_name: user_id } })
let host, changed = 0
afterEach(() => { host?.unmount(); toggled.length = 0; changed = 0 })
const mount = (orders, payment_mode = 'split') => { host = mountHost(MenuCommunity, { menu: { id: 'm', menu_date: '2026-11-13', payment_mode, orders }, onChanged: () => changed++ }) }
const buttons = () => { const found = []; hostFind(host.root, node => { if (node.tag === 'button' && hostText(node) === 'Chuyển khoản') found.push(node); return false }); return found }
const flush = () => new Promise(resolve => setTimeout(resolve))

test('chỉ đơn chưa trả của chính mình có nút Chuyển khoản; trả xong đánh dấu đúng đơn', async () => {
  mount([order('a', 'other'), order('b', 'me', true), order('c', 'me')])
  expect(buttons().length).toBe(1)
  buttons()[0].props.onClick(); await flush()
  const pay = hostFind(host.root, node => node.props?.id === 'pay')
  expect(pay.props.order).toBe('c')
  pay.props.onClick(); await flush()
  expect(toggled).toEqual([['c', true]])
  expect(changed).toBe(1)
  expect(hostFind(host.root, node => node.props?.id === 'pay')).toBeFalsy()
})

test('bữa được mời thì không có nút Chuyển khoản', () => {
  mount([order('c', 'me')], 'sponsored')
  expect(buttons().length).toBe(0)
})
