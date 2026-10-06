export const FEEDBACK_VERSION = '1'
export const MAX_FEEDBACK_OPTIONS = 12
export const MAX_REVIEW_LABELS = 6

function cleanLabels(value, limit) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value.filter(label => typeof label === 'string' && !/[<>\n\r]/.test(label))
    .map(label => label.trim().replace(/\s+/g, ' '))
    .filter(label => {
      const key = label.toLocaleLowerCase('vi')
      if (!label || label.length > 48 || seen.has(key)) return false
      seen.add(key); return true
    }).slice(0, limit)
}
export function validateLabels(value) { return cleanLabels(value, MAX_REVIEW_LABELS) }
export function validateSuggestionLabels(value) { return cleanLabels(value, MAX_FEEDBACK_OPTIONS) }

// Options describe possible sensations, never the meal's actual quality.
export function dishFeedbackProfile(name = '') {
  const dish = String(name).normalize('NFC').toLocaleLowerCase('vi')
  const soup = /canh|súp|cháo/.test(dish)
  const tofu = /đậu hũ|đậu phụ/.test(dish)
  const egg = /trứng/.test(dish)
  const seafood = /(^|\s)(cá|tôm|mực|lươn|hải sản)(?=\s|$)/u.test(dish)
  const meat = /thịt|sườn|gà|bò|heo|lòng|ba rọi|ba chỉ/.test(dish)
  const vegetables = /rau|cà tím|nấm|salad|khổ qua|đậu rồng/.test(dish)
  let key = 'general', pairs = [['Vừa miệng', 'Hơi nhạt'], ['Nêm đậm đà', 'Hơi mặn'], ['Dễ ăn', 'Hơi ngấy'], ['Vừa chín', 'Chưa vừa chín']]
  if (soup) {
    key = 'soup'; pairs = [['Nước đậm vị', 'Hơi nhạt'], ['Nước canh thanh', 'Hơi mặn'], ['Nguyên liệu vừa chín', 'Nấu quá mềm'], ['Dễ ăn', 'Vị chưa hài hòa']]
    if (/chua/.test(dish)) pairs[3] = ['Vị chua dịu', 'Chua gắt']
  } else if (tofu) {
    key = 'tofu'; pairs = [['Đậu mềm', 'Đậu hơi khô'], ['Nêm vừa miệng', 'Hơi mặn'], ['Đậu thơm', 'Đậu hơi bở'], ['Sốt vừa đủ', 'Sốt hơi ít']]
  } else if (egg) {
    key = 'egg'; pairs = [['Trứng mềm', 'Trứng hơi khô'], ['Nêm vừa miệng', 'Hơi mặn'], ['Trứng thơm', 'Hơi nhiều dầu'], ['Vừa chín', 'Chín quá kỹ']]
  } else if (seafood) {
    key = 'seafood'; pairs = [['Cá mềm', 'Cá hơi khô'], ['Nêm vừa miệng', 'Hơi mặn'], ['Mùi vị dễ ăn', 'Hơi tanh'], ['Sốt đậm đà', 'Sốt hơi nhạt']]
    if (/tôm/.test(dish)) pairs[0] = ['Tôm chắc thịt', 'Tôm hơi bở']
    else if (/mực/.test(dish)) pairs[0] = ['Mực vừa giòn', 'Mực hơi dai']
    else if (/lươn/.test(dish)) pairs[0] = ['Lươn mềm', 'Lươn hơi khô']
  } else if (meat) {
    key = 'meat'; pairs = [['Thịt mềm', 'Thịt hơi dai'], ['Ướp vừa miệng', 'Hơi mặn'], ['Thơm ngon', 'Thịt hơi khô'], ['Sốt đậm đà', 'Sốt hơi ít']]
  } else if (vegetables) {
    key = 'vegetables'; pairs = [['Rau tươi', 'Rau hơi mềm'], ['Nêm vừa miệng', 'Hơi mặn'], ['Vừa chín', 'Nấu quá mềm'], ['Vị thanh', 'Hơi nhiều dầu']]
    if (/cà tím/.test(dish)) pairs[0] = ['Cà tím mềm', 'Cà tím hơi dai']
    else if (/nấm/.test(dish)) pairs[0] = ['Nấm vừa giòn', 'Nấm hơi dai']
  } else if (/cơm/.test(dish)) {
    key = 'rice'; pairs = [['Cơm dẻo', 'Cơm hơi khô'], ['Hạt cơm tơi', 'Cơm hơi nhão'], ['Cơm thơm', 'Cơm chưa thơm'], ['Dễ ăn', 'Vị chưa hài hòa']]
  }
  if (/chiên|rán|xối mỡ/.test(dish) && !soup) {
    pairs[2] = ['Lớp ngoài giòn', 'Chưa đủ giòn']; pairs[3] = ['Ráo dầu', 'Hơi nhiều dầu']
  } else if (/nướng/.test(dish) && !soup) {
    pairs[2] = ['Thơm mùi nướng', 'Hơi cháy']; pairs[3] = ['Ướp đậm đà', 'Ướp hơi nhạt']
  } else if (/kho|rim/.test(dish) && !soup) pairs[3] = ['Nước kho đậm đà', 'Nước kho quá mặn']
  if (/khổ qua/.test(dish)) pairs[2] = ['Vị đắng vừa', 'Đắng quá']
  return { key, pairs, focus: pairs.map(pair => pair.join(' / ')) }
}
export function fallbackLabels(name = '') {
  return [...dishFeedbackProfile(name).pairs, ['Phần ăn vừa đủ', 'Phần hơi ít'], ['Vừa nóng', 'Hơi nguội']].flat()
}
export function relevantFeedbackLabels(labels, name = '') {
  const profile = dishFeedbackProfile(name)
  return validateSuggestionLabels(labels).filter(label => {
    if (['tofu', 'egg', 'vegetables', 'rice', 'general'].includes(profile.key) && /(?:^|\s)(?:thịt|cá|tôm|mực|lươn)(?=\s|$)/iu.test(label) && !/thịt|cá|tôm|mực|lươn/iu.test(name)) return false
    if (['meat', 'seafood'].includes(profile.key) && /rau/iu.test(label) && !/rau|khổ qua|nấm|đậu|cà tím/iu.test(name)) return false
    return true
  })
}
export function feedbackSections(labels) {
  const groups = [{ id: 'dish', title: 'Vị & cách nấu', labels: [] }, { id: 'portion', title: 'Khẩu phần', labels: [] }, { id: 'temperature', title: 'Nhiệt độ', labels: [] }]
  for (const label of validateSuggestionLabels(labels)) {
    const group = /phần ăn|khẩu phần|phần hơi|đủ no|ít cơm|lượng cơm/iu.test(label) ? groups[1] : /(?:^|\s)(?:nóng|nguội|ấm)(?=\s|$)|nhiệt độ/iu.test(label) ? groups[2] : groups[0]
    group.labels.push(label)
  }
  return groups.filter(group => group.labels.length)
}
