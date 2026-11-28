import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient } from '@/lib/go-api-client'
import { sendUpstreamError } from '@/lib/api-proxy'
import { withObservability } from '@/lib/with-observability'

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const cookies = req.headers.cookie
  if (!cookies) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { id } = req.query
  const contact = typeof req.body?.contact === 'string' ? req.body.contact.trim() : ''
  if (typeof id !== 'string' || !contact || contact.length > 500) { res.status(400).json({ error: 'Invalid contact or request ID' }); return }
  try { const data = await getGoApiClient().mentorAcceptRequest(cookies, id, contact); res.status(200).json(data) }
  catch (error) { sendUpstreamError(res, error, { context: 'mentor-accept-request', method: req.method, url: req.url }) }
}
export default withObservability('/api/mentor/requests/:id/accept', handler)
