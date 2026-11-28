import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
import { withObservability } from '@/lib/with-observability'

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ success: false })
    return
  }
  const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json' || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ success: false })
    return
  }
  try {
    const result = await getGoApiClient().request<{ success?: boolean }>('POST', '/api/v1/feedback', { body: req.body as Record<string, unknown> })
    if (result.success !== true) { res.status(502).json({ success: false }); return }
    res.status(201).json({ success: true })
  } catch (error) {
    const status = error instanceof HttpError && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 502
    res.status(status).json({ success: false })
  }
}

export default withObservability('/api/feedback', handler)
