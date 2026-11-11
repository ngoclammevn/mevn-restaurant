// Dựng ảnh "chụp" thông tin chuyển khoản (số tiền, QR, người nhận, nội dung) bằng canvas.
// Web không chụp được màn hình thật; ảnh này thay cho thao tác chụp màn hình.
const WIDTH = 800, PAD = 56, INK = '#111', SOFT = '#555'
const font = (size, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`

export function wrapText(measure, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > maxWidth) { lines.push(line); line = word } else line = next
  }
  return line ? [...lines, line] : lines
}

// VietQR trả SVG (dù URL đuôi .png); createImageBitmap của Chrome không đọc SVG nên nạp qua <img>.
function loadImage(blob) {
  const url = URL.createObjectURL(blob), image = new Image()
  return new Promise((resolve, reject) => {
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('qr_decode')) }
    image.src = url
  })
}

export async function paymentImage(qrBlob, { title, amount, rows }) {
  const qr = await loadImage(qrBlob)
  const qrWidth = WIDTH - PAD * 2, qrHeight = Math.round((qr.naturalHeight || 1) * qrWidth / (qr.naturalWidth || 1))
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
  const wrap = (text, size, weight) => { ctx.font = font(size, weight); return wrapText(t => ctx.measureText(t).width, text, qrWidth) }
  const blocks = rows.filter(row => row.value).map(row => ({ labels: wrap(row.label, 26), lines: wrap(row.value, 34, 700) }))
  canvas.width = WIDTH
  canvas.height = PAD + 130 + qrHeight + 24 + blocks.reduce((sum, block) => sum + 20 + block.labels.length * 34 + block.lines.length * 44, 0) + PAD
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  let y = PAD + 30
  ctx.fillStyle = SOFT; ctx.font = font(28); ctx.fillText(title, WIDTH / 2, y)
  y += 76; ctx.fillStyle = INK; ctx.font = font(64, 700); ctx.fillText(amount, WIDTH / 2, y)
  y += 24; ctx.drawImage(qr, PAD, y, qrWidth, qrHeight); y += qrHeight + 24
  ctx.textAlign = 'left'
  for (const block of blocks) {
    ctx.fillStyle = SOFT; ctx.font = font(26)
    for (const line of block.labels) { y += 34; ctx.fillText(line, PAD, y) }
    ctx.fillStyle = INK; ctx.font = font(34, 700)
    for (const line of block.lines) { y += 44; ctx.fillText(line, PAD, y) }
    y += 20
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas_empty')), 'image/png'))
}
