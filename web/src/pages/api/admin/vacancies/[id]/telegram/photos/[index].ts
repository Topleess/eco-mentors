import type { NextApiRequest, NextApiResponse } from 'next'
import { withObservability } from '@/lib/with-observability'

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).end(); return }
  if (!req.headers.cookie) { res.status(401).end(); return }
  const { id, index } = req.query
  if (typeof id !== 'string' || !id || typeof index !== 'string' || !/^(0|[1-9]\d{0,2})$/.test(index) || Number(index) > 100) { res.status(400).end(); return }
  const base = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8081'
  try {
    const upstream = await fetch(`${base}/api/v1/admin/vacancies/${encodeURIComponent(id)}/telegram/photos/${index}`, {
      headers: { Cookie: req.headers.cookie, 'x-internal-mentors-api-auth-token': process.env.GO_API_INTERNAL_TOKEN || '' },
      redirect: 'error', signal: AbortSignal.timeout(20000),
    })
    if (!upstream.ok) { res.status([401,403,404].includes(upstream.status) ? upstream.status : 502).end(); return }
    const type = upstream.headers.get('content-type')
    if (!type || !['image/jpeg','image/png','image/webp'].includes(type)) { res.status(502).end(); return }
    const reader = upstream.body?.getReader()
    if (!reader) { res.status(502).end(); return }
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const {done,value} = await reader.read()
      if (done) break
      size += value.length
      if (size > 5 * 1024 * 1024) { await reader.cancel(); res.status(502).end(); return }
      chunks.push(value)
    }
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.status(200).send(Buffer.concat(chunks))
  } catch { res.status(502).end() }
}

export default withObservability('/api/admin/vacancies/:id/telegram/photos/:id', handler)
