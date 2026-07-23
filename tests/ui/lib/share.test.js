import { describe, expect, it } from 'vitest'
import { buildShareUrl } from '../../../src/lib/share'

describe('buildShareUrl', () => {
  it('appends and encodes the original menu image', () => {
    const url = buildShareUrl(
      {
        id: 'menu-1',
        image_url: 'https://project.supabase.co/storage/v1/object/public/menus/user/menu 1.png',
      },
      'https://lunch.example',
    )

    expect(url).toBe(
      'https://lunch.example/share/menu-1?image=https%3A%2F%2Fproject.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmenus%2Fuser%2Fmenu+1.png',
    )
  })

  it('keeps the legacy short link when the menu has no image', () => {
    expect(buildShareUrl({ id: 'menu-2', image_url: null }, 'https://lunch.example'))
      .toBe('https://lunch.example/share/menu-2')
  })
})
