/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import handler from '@/pages/api/admin/vacancies/[id]/telegram/photos/[index]'

it('forwards authenticated image bytes without caching', async () => {
 const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array([255,216,255,217]), { status: 200, headers: { 'content-type': 'image/jpeg' } }))
 const {req,res} = createMocks({method:'GET',query:{id:'one',index:'0'},headers:{cookie:'admin=session'}})
 await handler(req,res)
 expect(res.statusCode).toBe(200)
 expect(res.getHeader('content-type')).toBe('image/jpeg')
 expect(res.getHeader('cache-control')).toBe('no-store')
 expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/v1/admin/vacancies/one/telegram/photos/0'),expect.objectContaining({headers:expect.objectContaining({Cookie:'admin=session'})}))
 fetcher.mockRestore()
})

it('rejects anonymous, invalid and non-GET requests without upstream calls', async () => {
 const fetcher = jest.spyOn(global, 'fetch')
 for (const [options, status] of [
  [{method:'GET',query:{id:'one',index:'0'}},401],
  [{method:'GET',query:{id:'one',index:'../1'},headers:{cookie:'session=x'}},400],
  [{method:'POST',query:{id:'one',index:'0'},headers:{cookie:'session=x'}},405],
 ] as const) {
  const {req,res}=createMocks(options)
  await handler(req,res)
  expect(res.statusCode).toBe(status)
 }
 expect(fetcher).not.toHaveBeenCalled()
 fetcher.mockRestore()
})
