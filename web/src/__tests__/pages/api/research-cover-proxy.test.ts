/** @jest-environment node */
import { researchCoverProxy } from '@/server/research-cover-proxy'
import type { NextApiRequest, NextApiResponse } from 'next'

function response() {
  const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn(), send: jest.fn(), end: jest.fn() }
  res.status.mockReturnValue(res)
  return res
}
const id = '11111111-1111-4111-8111-111111111111'
afterEach(() => jest.restoreAllMocks())
it('returns exact upstream image bytes without exposing cookies', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array([137,80,78,71]), { headers: { 'Content-Type': 'image/png' } }))
  const res = response()
  await researchCoverProxy({ method: 'GET', query: { id }, headers: {cookie:'private-session'} } as unknown as NextApiRequest, res as unknown as NextApiResponse)
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/api/v1/research/covers/${id}`), expect.objectContaining({ redirect: 'error' }))
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('headers')
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
  expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
  expect(res.send).toHaveBeenCalledWith(Buffer.from([137,80,78,71]))
})
it('rejects unsafe identifiers before transport', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
  const res = response()
  await researchCoverProxy({ method: 'GET', query: { id: '../admin' } } as unknown as NextApiRequest, res as unknown as NextApiResponse)
  expect(res.status).toHaveBeenCalledWith(400)
  expect(fetchMock).not.toHaveBeenCalled()
})
it('does not turn upstream errors or HTML into image success', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('missing', {status:404})).mockResolvedValueOnce(new Response('<html>not an image</html>', {headers:{'Content-Type':'text/html'}}))
  for (const status of [404,502]) {
    const res=response()
    await researchCoverProxy({method:'GET',query:{id}} as unknown as NextApiRequest,res as unknown as NextApiResponse)
    expect(res.status).toHaveBeenCalledWith(status)
    expect(res.send).not.toHaveBeenCalled()
  }
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('caps streamed image bytes before returning a response', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } }))
  const res = response()
  await researchCoverProxy({ method: 'GET', query: { id } } as unknown as NextApiRequest, res as unknown as NextApiResponse)
  expect(res.status).toHaveBeenCalledWith(502)
  expect(res.send).not.toHaveBeenCalled()
})
it('allows only GET for public image reads', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
  const res = response()
  await researchCoverProxy({ method: 'POST', query: { id } } as unknown as NextApiRequest, res as unknown as NextApiResponse)
  expect(res.status).toHaveBeenCalledWith(405)
  expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET')
  expect(fetchMock).not.toHaveBeenCalled()
})
