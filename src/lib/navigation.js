export const desktopLinks = [
  { to: '/', label: 'Hôm nay', icon: 'today' },
  { to: '/history', label: 'Đơn của tôi', icon: 'calendar' },
  { to: '/manage', label: 'Quản lý', icon: 'manage' },
]
export const mobileLinks = [...desktopLinks, { to: '/profile', label: 'Cá nhân', icon: 'person' }]
// Router giữ nguyên dấu / cuối (vd /manage/), nên bỏ đi trước khi so sánh.
const trimPath = path => path.length > 1 ? path.replace(/\/+$/, '') : path
export function isNavActive(targetPath, rawCurrentPath) {
  const currentPath = trimPath(rawCurrentPath)
  return targetPath === currentPath || targetPath === '/' && currentPath.startsWith('/menu/')
    || targetPath === '/manage' && ['/my-menus', '/dashboard'].includes(currentPath)
    || targetPath === '/profile' && currentPath === '/taste'
}
