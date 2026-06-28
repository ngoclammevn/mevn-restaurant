export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const apiKey = process.env.VIETQR_API_KEY
  const clientId = process.env.VIETQR_CLIENT_ID
  if (!apiKey || !clientId) {
    res.status(500).json({ error: 'VietQR API is not configured on server' })
    return
  }

  const { bin, accountNumber } = req.body || {}
  if (!bin || !accountNumber) {
    res.status(400).json({ error: 'Missing bin or accountNumber' })
    return
  }

  try {
    const response = await fetch('https://api.vietqr.io/v2/lookup', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'x-client-id': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bin, accountNumber })
    })

    const data = await response.json()
    if (data.code === '00' && data.data) {
      res.status(200).json({ accountName: data.data.accountName })
    } else {
      res.status(400).json({ error: data.desc || 'Tra cứu số tài khoản thất bại' })
    }
  } catch (error) {
    console.error('VietQR lookup error:', error)
    res.status(500).json({ error: 'Internal server error during lookup' })
  }
}
