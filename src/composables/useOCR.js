import { ref } from 'vue'
import Tesseract from 'tesseract.js'

export function useOCR() {
  const loading = ref(false)
  const progress = ref(0)
  const statusText = ref('')
  const errorMsg = ref('')
  const detectedMeals = ref([])

  // Parse raw OCR text into structured list of meals
  function parseMeals(text) {
    if (!text) return []
    
    const lines = text.split('\n')
    const meals = []
    
    // Regex to match trailing prices, e.g., "35K", "(40K)", "45.000đ", "Trừ 5K", "35k"
    const priceRegex = /\s*\(?(?:[tT]rừ\s*)?\d+(?:[.,]\d+)?\s*[kKđĐ]?\)?\.?\s*$/

    // Common layout metadata, contact info, or garbled characters to exclude
    const excludePatterns = [
      /tiệm cơm/i,
      /lộc vừng/i,
      /order now/i,
      /\b\d{10}\b/, // phone numbers
      /\b\d{4}\s*\d{3}\s*\d{3}\b/, // phone numbers with spaces
      /address/i,
      /địa chỉ/i,
      /đối diện/i,
      /chung cư/i,
      /miếu nổi/i
    ]

    // Keywords that a valid meal line should start with (helps filter out random OCR noise)
    const validStartKeywords = /^(?:cơm|canh|chả|trứng|cà|thức|thịt|sườn|gà|bò|cá|lươn|món|canh|rau|khô|mực|tôm|ốc|lẩu|mì|bún|phở|hủ|nước|thêm)/i

    for (const rawLine of lines) {
      const trimmedLine = rawLine.trim()
      if (!trimmedLine || trimmedLine.length < 5) continue

      // Split horizontally merged columns (e.g. split by "|" or multiple spaces)
      const columns = trimmedLine.split(/[|]+|\s{4,}/)

      for (const col of columns) {
        let cleanCol = col.trim()
        if (!cleanCol || cleanCol.length < 5) continue

        // Skip lines matching exclusion patterns
        const shouldExclude = excludePatterns.some(pattern => pattern.test(cleanCol))
        if (shouldExclude) continue

        // Strip leading bullet points or symbols common in OCR
        cleanCol = cleanCol.replace(/^[-•*+._~,›“"']\s*/, '').trim()

        // Normalize multiple spaces
        cleanCol = cleanCol.replace(/\s+/g, ' ')

        // Ensure the line starts with a likely food keyword or contains cơm/canh/món/thịt/gà/bò/cá/chả/trứng
        const hasFoodKeyword = validStartKeywords.test(cleanCol) || 
                               /cơm|canh|chả|trứng|thịt|sườn|gà|bò|cá/i.test(cleanCol)
        if (!hasFoodKeyword) continue

        // Extract price if present
        const priceMatch = cleanCol.match(priceRegex)
        let price = ''
        let cleanName = cleanCol

        if (priceMatch) {
          price = priceMatch[0].trim()
          cleanName = cleanCol.replace(priceRegex, '').trim()
        }

        // Final cleanup of trailing/leading punctuation
        cleanName = cleanName.replace(/[.,\s|]+$/, '').replace(/^[.,\s|]+/, '').trim()

        // Final validation to ensure cleanName isn't just numeric or noise
        if (cleanName.length < 3 || /^\d+$/.test(cleanName)) continue

        meals.push({
          raw: col.trim(),
          name: cleanName,
          price: price
        })
      }
    }

    return meals
  }

  async function recognizeMenu(imageSource) {
    loading.value = true
    progress.value = 0
    statusText.value = 'Khởi tạo công cụ đọc ảnh...'
    errorMsg.value = ''
    detectedMeals.value = []

    try {
      const result = await Tesseract.recognize(
        imageSource,
        'vie',
        {
          logger: (m) => {
            if (m.status === 'loading tesseract core') {
              statusText.value = 'Đang tải bộ xử lý OCR...'
            } else if (m.status === 'loading language traineddata') {
              statusText.value = 'Đang tải gói ngôn ngữ Tiếng Việt...'
            } else if (m.status === 'initializing api') {
              statusText.value = 'Đang chuẩn bị nhận diện...'
            } else if (m.status === 'recognizing text') {
              statusText.value = `Đang phân tích hình ảnh... ${Math.round(m.progress * 100)}%`
              progress.value = m.progress
            }
          }
        }
      )

      const text = result?.data?.text
      const parsed = parseMeals(text)
      detectedMeals.value = parsed
      
      if (parsed.length === 0) {
        statusText.value = 'Không tìm thấy món ăn nào trong ảnh.'
      } else {
        statusText.value = `Đã tìm thấy ${parsed.length} món!`
      }
    } catch (err) {
      console.error('OCR Error:', err)
      errorMsg.value = 'Lỗi nhận diện hình ảnh. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'
      statusText.value = ''
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    progress,
    statusText,
    errorMsg,
    detectedMeals,
    recognizeMenu
  }
}
