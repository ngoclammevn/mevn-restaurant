// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MenuEditorDialog from '../../../src/components/ui/MenuEditorDialog.vue'
import MenuBoard from '../../../src/components/ui/MenuBoard.vue'

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
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

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

  it('shows accessible reasons next to locked dish actions', () => {
    const wrapper = mount(MenuEditorDialog, {
      props: {
        menu: structuredMenu,
        orders: [{ item_text: 'Cơm gà', is_paid: true }],
        open: true,
      }, global,
    })

    expect(wrapper.get('#dish-name-lock-0').text()).toContain('đã có người đặt')
    expect(wrapper.get('#dish-price-lock-0').text()).toContain('đã có đơn thanh toán')
    expect(wrapper.get('[data-testid="dish-name-0"]').attributes('aria-describedby')).toBe('dish-name-lock-0')
    expect(wrapper.get('[data-testid="dish-remove-0"]').attributes('aria-describedby')).toBe('dish-name-lock-0')
    expect(wrapper.get('[data-testid="dish-price-0"]').attributes('aria-describedby')).toBe('dish-price-lock-0')
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

  it('saves an unchanged persisted past deadline after its displayed minute re-emits', async () => {
    const wrapper = mount(MenuEditorDialog, {
      props: {
        menu: {
          ...structuredMenu,
          order_deadline: '2026-07-23T02:00:30.123Z',
        },
        orders: [],
        open: true,
        now: new Date('2026-07-23T03:00:00.000Z'),
      },
      global,
    })

    await wrapper.get('[data-testid="deadline-input"]').setValue('2026-07-23T09:00')
    await wrapper.get('#menu-editor-title').setValue('Cơm trưa mới')

    expect(wrapper.get('[data-testid="menu-editor-save"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Hạn chót mới phải ở tương lai')

    await wrapper.get('[data-testid="menu-editor-save"]').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]?.order_deadline).toBe('2026-07-23T02:00:00.000Z')
  })

  it('preserves the draft when fresh order locks arrive while the dialog is open', async () => {
    const wrapper = mount(MenuEditorDialog, {
      props: { menu: structuredMenu, orders: [], open: true }, global,
    })

    await wrapper.get('#menu-editor-title').setValue('Bản nháp đang sửa')
    await wrapper.setProps({ orders: [{ item_text: 'Cơm gà', is_paid: true }] })

    expect(wrapper.get('#menu-editor-title').element.value).toBe('Bản nháp đang sửa')
    expect(wrapper.get('[data-testid="dish-name-0"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="dish-price-0"]').attributes('disabled')).toBeDefined()
  })

  it('uses the dirty close confirmation when Escape is pressed', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(MenuEditorDialog, {
      props: { menu: structuredMenu, orders: [], open: true }, global,
    })

    await wrapper.get('#menu-editor-title').setValue('Bản nháp')
    await wrapper.get('.menu-editor-overlay').trigger('keydown', { key: 'Escape' })

    expect(confirm).toHaveBeenCalledWith('Bạn có thay đổi chưa lưu. Bỏ thay đổi?')
    expect(wrapper.emitted('close')).toBeUndefined()

    confirm.mockReturnValue(true)
    await wrapper.get('.menu-editor-overlay').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('focuses the title, traps keyboard focus, and restores the trigger on unmount', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Mở editor'
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(MenuEditorDialog, {
      attachTo: document.body,
      props: { menu: structuredMenu, orders: [], open: true }, global,
    })
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('#menu-editor-title').element)
    await wrapper.get('#menu-editor-title').setValue('Cơm trưa mới')

    const closeButton = wrapper.get('.menu-editor-dialog__close')
    const saveButton = wrapper.get('[data-testid="menu-editor-save"]')
    saveButton.element.focus()
    await wrapper.get('.menu-editor-overlay').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton.element)

    closeButton.element.focus()
    await wrapper.get('.menu-editor-overlay').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(saveButton.element)

    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('MenuBoard category editing', () => {
  it('renames the displayed Khác group for null, undefined, and empty categories', async () => {
    const dishes = [
      { name: 'Cơm gà', price: 45000, category: null },
      { name: 'Bún bò', price: 50000 },
      { name: 'Trà đá', price: 5000, category: '' },
    ]
    const wrapper = mount(MenuBoard, {
      props: { mode: 'edit', dishes },
    })

    await wrapper.get('.mb-group-name').trigger('click')
    await wrapper.get('.mb-group-input').setValue('Món Việt')
    await wrapper.get('.mb-group-input').trigger('blur')

    expect(wrapper.emitted('update:dishes')?.at(-1)?.[0]).toEqual(
      dishes.map(dish => ({ ...dish, category: 'Món Việt' })),
    )
  })
})
