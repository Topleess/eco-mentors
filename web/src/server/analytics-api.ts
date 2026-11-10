import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient } from '@/lib/go-api-client'
import { sendUpstreamError } from '@/lib/api-proxy'
import { parseAnalyticsRange } from '@/server/analytics-range'
import type { AnalyticsRange } from '@/server/analytics-range'
import { getTrafficAnalytics } from '@/server/umami-analytics'

function prepare(req: NextApiRequest, res: NextApiResponse): AnalyticsRange | null {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return null
  }
  if (!req.headers.cookie) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    return parseAnalyticsRange(req.query)
  } catch {
    res.status(400).json({ error: 'Invalid date range (1–366 days)' })
    return null
  }
}
export async function analyticsRequests(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const range = prepare(req, res)
  if (!range) return
  try {
    const query = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate })
    const { data } = await getGoApiClient().requestWithCookies<unknown>(
      'GET',
      `/api/v1/admin/analytics/requests?${query}`,
      { cookies: req.headers.cookie },
    )
    res.status(200).json(data)
  } catch (error) {
    sendUpstreamError(res, error, { context: 'request-analytics', method: req.method })
  }
}
export async function analyticsTraffic(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const range = prepare(req, res)
  if (!range) return
  try {
    // Authenticate even on cache hits. A cookie's presence does not confer access.
    const { data } = await getGoApiClient().adminGetSession(req.headers.cookie as string)
    if (!data.success || !data.session) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (data.session.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(200).json(await getTrafficAnalytics(range))
  } catch (error) {
    sendUpstreamError(res, error, { context: 'traffic-analytics', method: req.method })
  }
}
