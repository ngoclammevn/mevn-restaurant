// Turn free-text (menu notes) into safe HTML where URLs become clickable links.
// XSS-safe: the WHOLE string is HTML-escaped first, then escaped URLs are wrapped
// in <a> tags. The only HTML we ever emit is anchor tags we build ourselves.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function autolink(text) {
  if (text == null) return ''
  const escaped = escapeHtml(String(text))
  // URLs no longer contain raw < > " ' after escaping, so this is safe to wrap.
  return escaped.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  )
}

// Runnable self-check (not auto-run). node -e "import('./src/lib/autolink.js').then(m=>m._selfCheck())"
export function _selfCheck() {
  const xss = autolink('<script>alert(1)</script>')
  if (!xss.includes('&lt;script&gt;') || xss.includes('<script>')) {
    throw new Error('autolink failed to escape script tag: ' + xss)
  }
  const link = autolink('see http://x.com ok')
  if (!link.includes('<a href="http://x.com"')) {
    throw new Error('autolink failed to linkify URL: ' + link)
  }
  // ponytail: two cases cover the only risks — XSS escape and URL match.
  return true
}
