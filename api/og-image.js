import { validateMenuImageUrl } from './_og-image.js'

export default function handler(req, res) {
  const imageUrl = validateMenuImageUrl(req.query.image)
  res.redirect(307, imageUrl ?? '/og-default.png')
}
