/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import type { NextApiHandler } from 'next'

const mockRequest = jest.fn()
const mockWithCookies = jest.fn()
jest.mock('@/lib/go-api-client', () => ({ ...jest.requireActual('@/lib/go-api-client'), getGoApiClient: () => ({ request: mockRequest, requestWithCookies: mockWithCookies }) }))
jest.mock('@/lib/with-observability', () => ({ withObservability: (_: string, handler: NextApiHandler) => handler }))
beforeEach(() => jest.clearAllMocks())

it('returns confirmation only for successful submission and does not forward cookies', async () => {
  const { default: submit } = await import('@/pages/api/feedback')
  const body = { category: 'question', message: 'Example text', consent: true, captchaToken: 'test-captcha' }
  mockRequest.mockResolvedValue({ success: true })
  const { req, res } = createMocks({ method: 'POST', headers: { cookie: 'test-session=opaque', 'content-type': 'application/json' }, body })
  await submit(req, res)
  expect(mockRequest).toHaveBeenCalledWith('POST', '/api/v1/feedback', { body })
  expect(res.statusCode).toBe(201)
  expect(res._getJSONData()).toEqual({ success: true })
  expect(res.getHeader('cache-control')).toBe('no-store')
})

it('rejects anonymous admin reads and forwards authenticated reads to the exact private route', async () => {
  const { default: admin } = await import('@/pages/api/admin/feedback')
  const open = createMocks({ method: 'GET' }); await admin(open.req, open.res)
  expect(open.res.statusCode).toBe(401)
  expect(mockWithCookies).not.toHaveBeenCalled()
  mockWithCookies.mockResolvedValue({ data: { items: [], hasMore: false } })
  const auth = createMocks({ method: 'GET', headers: { cookie: 'test-session=opaque' }, query: { offset: '25' } })
  await admin(auth.req, auth.res)
  expect(mockWithCookies).toHaveBeenCalledWith('GET', '/api/v1/admin/feedback?offset=25', { cookies: 'test-session=opaque' })
  expect(auth.res.getHeader('cache-control')).toBe('no-store')
  expect(auth.res._getJSONData()).toEqual({ items: [], hasMore: false })
})
