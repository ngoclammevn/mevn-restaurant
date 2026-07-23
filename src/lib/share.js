export function buildShareUrl(menu, origin = window.location.origin) {
  const url = new URL(`/share/${menu.id}`, origin)
  if (menu.image_url) {
    url.searchParams.set('image', menu.image_url)
  }
  return url.toString()
}
