const SYSTEM_PROMPT = `Bạn là trợ lý đắc lực chuyên số hóa thực đơn (menu) cơm trưa từ hình ảnh.
Hãy quét hình ảnh thực đơn này, trích xuất tất cả các món ăn kèm giá tiền, phân loại chúng, ước lượng lượng calo tiêu thụ và giải thích ngắn gọn lượng calo đó của từng món.
Định dạng trả về BẮT BUỘC phải là một đối tượng JSON hợp lệ có dạng:
{
  "dishes": [
    { "name": "Tên món", "price": 45000, "category": "Nhóm món", "calories": 450, "description": "Lý do ước lượng calo & lời khuyên sức khỏe..." }
  ]
}

Quy tắc trích xuất:
1. "name": Chuẩn hóa tên món ăn chỉ viết hoa chữ cái đầu tiên, tất cả các từ còn lại viết thường (ví dụ: "Cơm trứng cuộn chiên", "Cơm chả trứng hấp", "Trứng cuộn chiên (thêm)"). Không viết hoa toàn bộ từ.
2. "price": Trích xuất và quy đổi giá trị sang số nguyên VNĐ (ví dụ: "45k", "45", "45.000" -> 45000; "5k", "5" -> 5000). Nếu không tìm thấy giá hoặc món ăn kèm miễn phí, để là 0.
3. "calories": Ước lượng lượng calo (kcal) tiêu thụ cho phần ăn/uống này dựa vào tên món ăn và giá tiền của nó. Ví dụ: cơm tấm sườn bì chả hoặc cơm mặn nhiều thịt khoảng 600-800 kcal, cơm gà khoảng 550-700 kcal, các món canh/rau ăn thêm khoảng 50-100 kcal, trứng cuộn chiên khoảng 120 kcal, các loại đồ ngọt/nước ngọt khoảng 140 kcal, nước lọc/trà đá 0 kcal. Trả về là một số nguyên (ví dụ: 650). Nếu hoàn toàn không thể ước lượng được hoặc là thông tin không phải món ăn, để mặc định là 0.
4. "description": Viết duy nhất 1 câu nhận xét siêu ngắn gọn (dưới 15 từ) về món ăn/calo theo hướng tích cực, nạp năng lượng lành mạnh. Tuyệt đối TRÁNH các từ ngữ nhạy cảm dễ gây mặc cảm ngoại hình hoặc lo lắng cân nặng như 'béo', 'mập', 'nhiều mỡ', 'béo ngậy', 'tăng cân'... và không lặp lại máy móc câu 'đừng bỏ bữa'. Ví dụ: 'Nhiều protein từ thịt nướng, nạp năng lượng cực đã cho buổi chiều!', 'Canh rau thanh đạm bù nước, ăn kèm món chính cho đủ chất nhé!', 'Cơm gà thơm ngon, nạp đầy pin cho ngày làm việc!', 'Món ăn kèm giàu dinh dưỡng, nạp thêm năng lượng nhé!'. Tránh viết dài dòng.
5. "category": Trích xuất phân nhóm dựa vào tiêu đề nhóm có sẵn trên ảnh thực đơn (ví dụ: "Cơm gà", "Món canh", "Món gọi thêm - ăn kèm"...) nếu có. Chuẩn hóa tên nhóm chỉ viết hoa chữ cái đầu tiên (ví dụ: "Cơm cá", "Món canh", "Món gọi thêm - ăn kèm").
6. BỎ QUA HOÀN TOÀN các tùy chọn giảm trừ hoặc khấu trừ phụ trợ (ví dụ: các dòng kiểu "Canh riêng không cơm trừ 5k", "Thức ăn mua riêng (ko cơm) trừ 5k", hoặc bất cứ dòng nào ghi "TRỪ ...K"). Chỉ trích xuất các món ăn thực tế có thể gọi.
7. SỬA LỖI CHÍNH TẢ & THÊM DẤU TIẾNG VIỆT: Tự động sửa các lỗi chính tả phổ biến trong tiếng Việt (ví dụ: 'sào' -> 'xào', 'chứng' -> 'trứng', 'chả' vs 'trả', 'riêu' vs 'ziêu', 'giò' vs 'dò'...) và khôi phục dấu tiếng Việt chính xác nếu thực đơn gốc viết không dấu hoặc thiếu dấu (ví dụ: 'com thit kho tau' -> 'Cơm thịt kho tàu', 'bun thit nuong' -> 'Bún thịt nướng'). Bảo đảm tên món ăn tự nhiên, đúng ngữ pháp tiếng Việt.
8. Chỉ trả về định dạng JSON thô, không bọc trong ký hiệu markdown như \`\`\`json.
9. PHÒNG NGỪA HÌNH ẢNH KHÔNG LIÊN QUAN (QUAN TRỌNG): Nếu hình ảnh được cung cấp hoàn toàn không chứa thực đơn món ăn/đồ uống (ví dụ: ảnh phong cảnh, ảnh chụp màn hình UI thiết kế, sơ đồ, code, v.v.), hoặc không thể tìm thấy bất kỳ thông tin món ăn hợp lệ nào, hãy trả về mảng dishes rỗng: {"dishes": []}. Tuyệt đối không được tự bịa ra (hallucinate) danh sách món ăn từ dữ liệu huấn luyện hoặc ví dụ nếu ảnh thực tế không chứa thông tin đó.`

function parseJsonFromText(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim()
  }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }
  const parsed = JSON.parse(cleaned)
  if (!parsed.dishes || !Array.isArray(parsed.dishes)) {
    throw new Error('Dữ liệu trả về thiếu danh sách món ăn hoặc không đúng cấu trúc.')
  }
  return parsed.dishes
    .filter(dish => {
      const name = String(dish.name || '').trim().toLowerCase()
      const price = Number(dish.price) || 0
      if (price < 0) return false
      if (name.includes('trừ') && (name.includes('k') || name.includes('đ') || name.includes('000'))) return false
      return true
    })
    .map(dish => {
      let cleanName = String(dish.name || '').trim().replace(/\s+/g, ' ').toLowerCase()
      if (cleanName) cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
      let cleanCategory = String(dish.category || 'Khác').trim().replace(/\s+/g, ' ').toLowerCase()
      if (cleanCategory) cleanCategory = cleanCategory.charAt(0).toUpperCase() + cleanCategory.slice(1)
      return {
        name: cleanName,
        price: Number(dish.price) || 0,
        category: cleanCategory,
        calories: Number(dish.calories) || 0,
        description: String(dish.description || '').trim()
      }
    })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OCR service not configured' })
    return
  }

  const { image } = req.body || {}
  if (!image) {
    res.status(400).json({ error: 'Missing image' })
    return
  }

  const base64Data = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '')
  const model = 'gemini-3.1-flash-lite'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text()
      res.status(502).json({ error: `Gemini lỗi (${response.status}): ${errText}` })
      return
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      res.status(502).json({ error: 'AI không phản hồi dữ liệu món ăn.' })
      return
    }

    const dishes = parseJsonFromText(content)
    res.json({ dishes })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'OCR quá thời gian (25 giây)' })
    } else {
      res.status(500).json({ error: err.message })
    }
  }
}
