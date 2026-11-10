import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient } from '@/lib/go-api-client'
import { withObservability } from '@/lib/with-observability'
import { isLocalDevelopment } from '@/server/dev-access'

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  if (!isLocalDevelopment(req.headers.host)) {
    res.status(404).json({ success: false })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ success: false })
    return
  }
  const role: unknown = req.body?.role
  if (role !== 'admin' && role !== 'mentor') {
    res.status(400).json({ success: false, message: 'Choose admin or mentor' })
    return
  }
  try {
    const email = role === 'admin' ? 'demo-admin@openmentor.test' : 'demo-mentor@openmentor.test'
    const { data, headers } = await getGoApiClient().demoLogin(email)
    if (!data.success || data.role !== role) {
      res.status(502).json({ success: false, message: 'Local account is unavailable' })
      return
    }
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
    res.status(200).json({ success: true, role })
  } catch {
    res.status(502).json({ success: false, message: 'Local account is unavailable' })
  }
}

export default withObservability('/api/dev/login', handler)
