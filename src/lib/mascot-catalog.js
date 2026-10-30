// Sprite grid and reaction names ported from nilbuild/page-mascot (MIT).
export const MASCOTS = Object.freeze([
  { id: 'fox', label: 'Cáo' }, { id: 'cat', label: 'Mèo' },
  { id: 'bunny', label: 'Thỏ' }, { id: 'panda', label: 'Gấu trúc' },
  { id: 'penguin', label: 'Chim cánh cụt' }, { id: 'otter', label: 'Rái cá' },
  { id: 'robot', label: 'Robot' }, { id: 'chef', label: 'Đầu bếp' },
])
export const MASCOT_IDS = Object.freeze(MASCOTS.map(mascot => mascot.id))
export const DIRECTIONS = ['up-left', 'up', 'up-right', 'left', 'center', 'right', 'down-left', 'down', 'down-right']
export const REACTIONS = ['blink', 'heart', 'sparkle', 'surprised', 'wink', 'bashful', 'sleepy', 'dizzy', 'delighted']
export function mascotAssets(mascotId) {
  const id = MASCOT_IDS.includes(mascotId) ? mascotId : 'fox'
  return { directions: `/mascots/${id}-directions.webp`, reactions: `/mascots/${id}-reactions.webp` }
}
export function spritePosition(index) {
  return `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`
}
