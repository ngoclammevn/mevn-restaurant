// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuEditorDialog from '../../../src/components/ui/MenuEditorDialog.vue'

const structuredMenu = {
  id: 'menu-1',
  title: 'Cơm trưa',
  order_deadline: null,
  image_url: 'https://example.com/menu.jpg',
  note: JSON.stringify({
    notes: 'Ít cay',
    dishes: [{ name: 'Cơm gà', price: 45000, category: 'Món chính' }],
  }),
}

const global = { stubs: { RouterLink: true } }

describe('MenuEditorDialog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('locks rename/delete for ordered dishes and locks paid price', () => {
    const wrapper = mount(MenuEditorDialog, {
      props: {
        menu: structuredMenu,
        orders: [{ item_text: 'Cơm gà', is_paid: true }],
        open: true,
      }, global,
    })

    expect(wrapper.get('[data-testid="dish-name-0"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="dish-remove-0"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="dish-price-0"]').attributes('disabled')).toBeDefined()
  })

  it('keeps plain text menus in TextArea mode', () => {
    const wrapper = mount(MenuEditorDialog, {
      props: {
        menu: { id: 'menu-2', title: 'Cơm', note: 'Cơm tấm - 40k' },
        orders: [],
        open: true,
      }, global,
    })

    expect(wrapper.find('[data-testid="menu-editor-plain-note"]').exists()).toBe(true)
    expect(wrapper.find('.menu-board').exists()).toBe(false)
  })

  it('emits a serialized structured draft only after a change', async () => {
    const wrapper = mount(MenuEditorDialog, {
      props: { menu: structuredMenu, orders: [], open: true }, global,
    })

    expect(wrapper.get('[data-testid="menu-editor-save"]').attributes('disabled')).toBeDefined()
    await wrapper.get('#menu-editor-title').setValue('Cơm trưa mới')
    await wrapper.get('[data-testid="menu-editor-save"]').trigger('click')

    expect(wrapper.emitted('save')?.[0]).toEqual([{
      id: 'menu-1',
      title: 'Cơm trưa mới',
      note: structuredMenu.note,
      order_deadline: null,
    }])
  })

  it('confirms with the exact unpaid order count before changing an ordered price', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(MenuEditorDialog, {
      props: {
        menu: structuredMenu,
        orders: [{ item_text: 'Cơm gà', is_paid: false }, { item_text: 'Cơm gà\nTrà đá', is_paid: false }],
        open: true,
      }, global,
    })

    await wrapper.get('[data-testid="dish-price-0"]').trigger('click')
    await wrapper.get('#mb-price-0').setValue('50000')
    await wrapper.get('#mb-price-0').trigger('blur')

    expect(confirm).toHaveBeenCalledWith('Giá mới sẽ cập nhật số tiền của 2 đơn chưa thanh toán')
    expect(wrapper.get('[data-testid="menu-editor-save"]').attributes('disabled')).toBeDefined()
  })

  it('does not save a newly selected past deadline', async () => {
    const wrapper = mount(MenuEditorDialog, {
      props: { menu: structuredMenu, orders: [], open: true, now: new Date('2026-07-23T03:00:00.000Z') }, global,
    })

    await wrapper.get('[data-testid="deadline-input"]').setValue('2026-07-23T08:00')

    expect(wrapper.get('[data-testid="menu-editor-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Hạn chót mới phải ở tương lai')
  })
})
