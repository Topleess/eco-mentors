/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import admin from '@/pages/api/admin/vacancies/[id]'
import publicList from '@/pages/api/vacancies'
const mockRequest = jest.fn()
const mockCookies = jest.fn()
jest.mock('@/lib/go-api-client', () => ({ getGoApiClient: () => ({ request: mockRequest, requestWithCookies: mockCookies }) }))
jest.mock('@/lib/with-observability', () => ({ withObservability: (_: string, handler: unknown) => handler }))
it('rejects anonymous writes before proxying', async () => {
  const { req, res } = createMocks({ method: 'PUT', query: { id: 'one' }, body: {} })
  await admin(req, res)
  expect(res.statusCode).toBe(401)
  expect(mockCookies).not.toHaveBeenCalled()
})
it('forwards cookies and the versioned PUT to the exact admin target', async () => {
  mockCookies.mockResolvedValue({ data: { vacancy: { id: 'one', version: 2 } } })
  const { req, res } = createMocks({ method: 'PUT', headers: { cookie: 'admin_session=test' }, query: { id: 'one' }, body: { version: 1 } })
  await admin(req, res)
  expect(mockCookies).toHaveBeenCalledWith('PUT', '/api/v1/admin/vacancies/one', { cookies: 'admin_session=test', body: { version: 1 } })
  expect(res.statusCode).toBe(200)
})
it('public proxy never forwards admin cookies or requests an admin endpoint', async () => {
  mockRequest.mockResolvedValue({ vacancies: [] })
  const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'admin_session=test' } })
  await publicList(req, res)
  expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/vacancies')
  expect(res._getJSONData()).toEqual({ vacancies: [] })
})
