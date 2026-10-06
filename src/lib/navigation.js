export const desktopLinks = [
  { to: '/', label: 'Hôm nay', icon: 'today' },
  { to: '/history', label: 'Lịch cơm', icon: 'calendar' },
  { to: '/manage', label: 'Quản lý', icon: 'manage' },
]
export const mobileLinks = [...desktopLinks, { to: '/profile', label: 'Cá nhân', icon: 'person' }]
export function isNavActive(targetPath, currentPath) {
  return targetPath === currentPath || targetPath === '/manage' && ['/my-menus', '/dashboard'].includes(currentPath)
    || targetPath === '/profile' && currentPath === '/taste'
}
