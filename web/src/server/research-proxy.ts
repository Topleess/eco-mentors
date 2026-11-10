import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
import { sendUpstreamError } from '@/lib/api-proxy'

export function researchProxy(
  path: string,
  methods: readonly string[],
  admin = false,
  dynamic = false,
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store')
    if (!req.method || !methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '))
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (admin && !req.headers.cookie) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const id = req.query.id
    if (dynamic && (typeof id !== 'string' || !id)) {
      res.status(400).json({ error: 'Invalid identifier' })
      return
    }
    const target = `/api/v1${path}${dynamic ? `/${encodeURIComponent(id as string)}` : ''}`
    try {
      const client = getGoApiClient()
      const method = req.method as 'GET' | 'POST' | 'PUT' | 'DELETE'
      const data = admin
        ? (
            await client.requestWithCookies<unknown>(method, target, {
              cookies: req.headers.cookie,
              ...(method === 'GET' ? {} : { body: req.body as Record<string, unknown> }),
            })
          ).data
        : await client.request<unknown>('GET', target)
      res.status(method === 'POST' ? 201 : 200).json(data)
    } catch (error) {
      if (path === '/admin/research/covers' && error instanceof HttpError && error.statusCode === 503) {
        res.status(503).json({ error: 'Storage unavailable' })
        return
      }
      sendUpstreamError(res, error, { context: 'research-proxy', method: req.method })
    }
  }
}
