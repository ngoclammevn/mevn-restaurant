let locks = 0
let overflow = ''
export function lockDialogScroll() {
  if (!locks++) { overflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  let released = false
  return () => { if (!released) { released = true; if (!--locks) document.body.style.overflow = overflow } }
}
