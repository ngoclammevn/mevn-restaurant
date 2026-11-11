import { afterEach, expect, test, vi } from 'vitest'
import { mountHost, hostFind } from '../helpers/vue-host.js'
const toggled = [], failIds = new Set()
vi.mock('../../src/composables/useOrders', () => ({ useOrders: () => ({ togglePaid: async (id, value) => { toggled.push([id, value]); return failIds.has(id) ? { error: new Error('rls') } : { data: { is_paid: true } } } }) }))
vi.mock('../../src/composables/useAppPresence', () => ({ useAppPresence: () => ({ notifyOrderChanged: () => {} }) }))
vi.mock('../../src/components/ui', async () => {
  const { h } = await import('vue')
  return {
    AppDialog: (props, { slots }) => h('dialog', { open: props.open }, slots.default?.()),
    PaymentQRModal: { props: ['batch', 'error'], emits: ['paid'], setup: (props, { emit }) => () => h('button', { id: 'pay', total: props.batch.total, error: props.error, onClick: () => emit('paid') }, 'Tôi đã chuyển tiền') },
  }
})
import BatchPayDialog from '../../src/components/BatchPayDialog.vue'
const entry = (id, date, amount) => ({ order: { id, user_id: 'me', item_text: 'Cơm gà', menu: { id: 'm' + id, menu_date: date } }, amount })
const group = () => ({ posterId: 'p', poster: { full_name: 'Cầm' }, priced: [entry('a', '2026-11-03', 45000), entry('b', '2026-11-04', 40000)], unpriced: [] })
let host
const events = { changed: [], close: 0 }
afterEach(() => { host?.unmount(); toggled.length = 0; failIds.clear(); events.changed.length = 0; events.close = 0 })
const mount = g => { host = mountHost(BatchPayDialog, { group: g, onChanged: order => events.changed.push(order.id), onClose: () => events.close++ }) }
const pay = () => hostFind(host.root, node => node.props?.id === 'pay')
const flush = () => new Promise(resolve => setTimeout(resolve))

test('mặc định gom mọi đơn có giá, trả xong đánh dấu cả nhóm và đóng popup', async () => {
  mount(group())
  expect(pay().props.total).toBe(85000)
  pay().props.onClick(); await flush()
  expect(toggled).toEqual([['a', true], ['b', true]])
  expect(events.changed).toEqual(['a', 'b'])
  expect(events.close).toBe(1)
})

test('bỏ tick một đơn thì tổng và lượt đánh dấu chỉ còn đơn được chọn', async () => {
  mount(group())
  hostFind(host.root, node => node.tag === 'input').props.onChange(); await flush()
  expect(pay().props.total).toBe(40000)
  pay().props.onClick(); await flush()
  expect(toggled).toEqual([['b', true]])
})

test('một đơn lỗi thì giữ popup, báo số đơn đã cập nhật', async () => {
  failIds.add('b'); mount(group())
  pay().props.onClick(); await flush()
  expect(events.changed).toEqual(['a'])
  expect(events.close).toBe(0)
  expect(pay().props.error).toBe('Đã cập nhật 1/2 đơn. Bấm lại để thử các đơn còn lại.')
})
