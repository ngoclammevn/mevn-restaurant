import jsQR from 'jsqr'

/**
 * Decodes a QR code from an uploaded File or Blob image.
 * Uses HTML5 Canvas to read the raw RGBA pixels and passes them to jsQR.
 *
 * @param {File|Blob} file - The image file containing the QR code.
 * @returns {Promise<string>} - Resolves with the decoded text value, or rejects with an error.
 */
export function decodeQRCode(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        try {
          // Create an offscreen canvas
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return reject(new Error('Could not get 2D context for canvas.'))
          }

          // Scale down if image is extremely large to optimize performance
          const maxDim = 1000
          let width = img.width
          let height = img.height
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          const imageData = ctx.getImageData(0, 0, width, height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            resolve(code.data)
          } else {
            reject(new Error('Không tìm thấy mã QR trong ảnh. Vui lòng thử chụp lại rõ nét hơn.'))
          }
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => {
        reject(new Error('Không thể load tệp ảnh. Vui lòng chọn ảnh định dạng PNG hoặc JPG.'))
      }
      img.src = event.target.result
    }
    reader.onerror = () => {
      reject(new Error('Không thể đọc tệp tin.'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Extracts the MoMo PSP virtual account from the EMVCo string.
 * Specifically looks for the bank BIN 971025 followed by a PSP virtual account.
 * E.g. "...9710250122PSP2602012900000062..."
 *
 * @param {string} emvcoString - The raw EMVCo text decoded from the QR code.
 * @returns {string|null} - The extracted PSP account string (e.g. "PSP2602012900000062"), or null if not found.
 */
export function extractPSP(emvcoString) {
  if (!emvcoString) return null
  // Regex: Find MoMo BIN 971025, match anything until we hit PSP followed by letters/numbers
  const regex = /971025.*?(PSP[A-Za-z0-9]+)/i
  const match = emvcoString.match(regex)
  return match ? match[1].toUpperCase() : null
}
