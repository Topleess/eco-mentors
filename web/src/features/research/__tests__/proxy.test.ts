/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import { researchProxy } from '@/server/research-proxy'
const mockCookies = jest.fn()
jest.mock('@/lib/go-api-client', () => ({
  getGoApiClient: () => ({ requestWithCookies: mockCookies }),
}))
it('denies anonymous writes and forwards authenticated versioned writes', async () => {
  const handler = researchProxy('/admin/research', ['GET', 'PUT'], true, true)
  const anonymous = createMocks({ method: 'PUT', query: { id: 'one' } })
  await handler(anonymous.req, anonymous.res)
  expect(anonymous.res.statusCode).toBe(401)
  mockCookies.mockResolvedValue({ data: { research: { id: 'one' } } })
  const { req, res } = createMocks({
    method: 'PUT',
    headers: { cookie: 'admin_session=test' },
    query: { id: 'one' },
    body: { version: 2 },
  })
  await handler(req, res)
  expect(mockCookies).toHaveBeenCalledWith('PUT', '/api/v1/admin/research/one', {
    cookies: 'admin_session=test',
    body: { version: 2 },
  })
  expect(res.statusCode).toBe(200)
})
