import type { NextApiRequest, NextApiResponse } from 'next'
import { MAX_IMAGE_FILE_BYTES } from '@/config/uploads'

export async function researchCoverProxy(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({error:'Method not allowed'}); return }
  const id = req.query.id
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) { res.status(400).json({error:'Invalid cover identifier'}); return }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const base = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8081'
    const upstream = await fetch(`${base}/api/v1/research/covers/${id}`, { signal: controller.signal, redirect: 'error', cache: 'no-store' })
    if (!upstream.ok) { await upstream.body?.cancel(); res.status([400,404,503].includes(upstream.status) ? upstream.status : 502).json({error:'Cover unavailable'}); return }
    const type = upstream.headers.get('content-type')?.split(';')[0]
    if (!type || !['image/png','image/jpeg','image/webp'].includes(type) || !upstream.body) { await upstream.body?.cancel(); res.status(502).json({error:'Invalid cover response'}); return }
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_IMAGE_FILE_BYTES) { await reader.cancel(); res.status(502).json({error:'Invalid cover response'}); return }
      chunks.push(next.value)
    }
    if (!size) { res.status(502).json({error:'Empty cover response'}); return }
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', size)
    res.status(200).send(Buffer.concat(chunks))
  } catch { res.status(502).json({error:'Cover unavailable'}) }
  finally { clearTimeout(timer) }
}
