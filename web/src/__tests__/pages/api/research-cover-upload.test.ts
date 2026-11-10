/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import { researchProxy } from '@/server/research-proxy'
import { HttpError } from '@/lib/go-api-client'
const mockUpload = jest.fn()
jest.mock('@/lib/go-api-client', () => ({
  ...jest.requireActual('@/lib/go-api-client'),
  getGoApiClient: () => ({ requestWithCookies: mockUpload }),
}))
it('reports unavailable cover storage as a safe 503 without upstream details', async () => {
  mockUpload.mockRejectedValue(new HttpError(503, 'Service Unavailable', 'private internal storage hostname'))
  const { req, res }=createMocks({method:'POST',headers:{cookie:'admin_session=test'},body:{image:'synthetic'}})
  await researchProxy('/admin/research/covers',['POST'],true)(req,res)
  expect(res.statusCode).toBe(503)
  expect(res._getJSONData()).toEqual({error:'Storage unavailable'})
})
