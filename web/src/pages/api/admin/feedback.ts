import type { NextApiRequest, NextApiResponse } from 'next'
import type { FeedbackPage } from '@/features/feedback/model'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
import { withObservability } from '@/lib/with-observability'

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!req.headers.cookie) { res.status(401).json({ error: 'Unauthorized' }); return }
  const offset = req.query.offset ?? '0'
  if (typeof offset !== 'string' || !/^\d{1,6}$/.test(offset)) { res.status(400).json({ error: 'Invalid page' }); return }
  try {
    const { data } = await getGoApiClient().requestWithCookies<FeedbackPage>('GET', `/api/v1/admin/feedback?offset=${offset}`, { cookies: req.headers.cookie })
    res.status(200).json(data)
  } catch (error) {
    const status = error instanceof HttpError && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 502
    res.status(status).json({ error: 'Feedback unavailable' })
  }
}

export default withObservability('/api/admin/feedback', handler)
