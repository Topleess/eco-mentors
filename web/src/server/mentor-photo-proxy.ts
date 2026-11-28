import type { NextApiRequest, NextApiResponse } from 'next'
import { MAX_IMAGE_FILE_BYTES } from '@/config/uploads'

export async function mentorPhotoProxy(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({error:'Method not allowed'}); return }
  const id = req.query.id
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) { res.status(400).json({error:'Invalid photo identifier'}); return }
  return fetchPhoto(res, `/api/v1/mentor-photos/${id}`)
}

export async function privateMentorPhotoProxy(req: NextApiRequest, res: NextApiResponse, scope: 'own' | 'admin'): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({error:'Method not allowed'}); return }
  if (!req.headers.cookie) { res.status(401).json({error:'Unauthorized'}); return }
  const id = req.query.id
  if (scope === 'admin' && (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))) { res.status(400).json({error:'Invalid photo identifier'}); return }
  const path = scope === 'own' ? '/api/v1/mentor/profile/photo' : `/api/v1/admin/mentors/${id}/photo`
  return fetchPhoto(res, path, req.headers.cookie)
}

async function fetchPhoto(res: NextApiResponse, path: string, cookie?: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const base = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8081'
    const upstream = await fetch(`${base.replace(/\/$/, '')}${path}`, { headers: cookie ? { cookie } : {}, signal: controller.signal, redirect: 'error', cache: 'no-store' })
    if (!upstream.ok) { await upstream.body?.cancel(); res.status([400,401,403,404,503].includes(upstream.status) ? upstream.status : 502).json({error:'Photo unavailable'}); return }
    const type = upstream.headers.get('content-type')?.split(';')[0]
    if (!type || !['image/png','image/jpeg','image/webp'].includes(type) || !upstream.body) { await upstream.body?.cancel(); res.status(502).json({error:'Invalid photo response'}); return }
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_IMAGE_FILE_BYTES) { await reader.cancel(); res.status(502).json({error:'Invalid photo response'}); return }
      chunks.push(next.value)
    }
    if (!size) { res.status(502).json({error:'Empty photo response'}); return }
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', size)
    res.status(200).send(Buffer.concat(chunks))
  } catch { res.status(502).json({error:'Photo unavailable'}) }
  finally { clearTimeout(timer) }
}
