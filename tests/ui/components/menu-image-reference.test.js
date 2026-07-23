// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuImageReference from '../../../src/components/menu/MenuImageReference.vue'

describe('MenuImageReference', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the original image without forcing its natural dimensions', () => {
    const wrapper = mount(MenuImageReference, {
      props: { src: '/portrait.jpg', alt: 'Menu Cơm Nhà' },
    })

    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('/portrait.jpg')
    expect(image.attributes('alt')).toBe('Menu Cơm Nhà')
    expect(image.classes()).toContain('menu-reference__image')
    expect(image.attributes('width')).toBeUndefined()
    expect(image.attributes('height')).toBeUndefined()
  })

  it('shows an inline retry control after the image fails and uses a cache-busting retry', async () => {
    const wrapper = mount(MenuImageReference, {
      props: { src: '/portrait.jpg', alt: 'Menu Cơm Nhà' },
    })

    await wrapper.get('img').trigger('error')

    expect(wrapper.text()).toContain('Không tải được ảnh menu')
    expect(wrapper.get('button').text()).toContain('Thử tải lại ảnh')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('img').attributes('src')).toMatch(/^\/portrait\.jpg\?menu-image-retry=\d+$/)
  })

  it('opens a dialog from the image trigger and restores focus after Escape', async () => {
    const wrapper = mount(MenuImageReference, {
      attachTo: document.body,
      props: { src: '/portrait.jpg', alt: 'Menu Cơm Nhà' },
    })

    const trigger = wrapper.get('.menu-reference__trigger')
    await trigger.trigger('click')

    expect(wrapper.get('[role="dialog"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })
})
