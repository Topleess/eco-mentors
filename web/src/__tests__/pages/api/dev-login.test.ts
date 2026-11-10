import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/logger', () => ({ logHttpRequest: jest.fn(), logError: jest.fn() }))
const mockDemoLogin = jest.fn()
jest.mock('@/lib/go-api-client', () => ({ getGoApiClient: () => ({ demoLogin: mockDemoLogin }) }))
import handler from '@/pages/api/dev/login'

const originalEnv = process.env
beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'development', APP_ENV: 'development' }
  mockDemoLogin.mockReset()
})
afterEach(() => { process.env = originalEnv })

it.each([
  ['production', 'development', 'localhost'], ['test', 'development', 'localhost'],
  ['development', 'production', 'localhost'], ['development', undefined, 'localhost'],
  ['development', 'demo', 'localhost'], ['development', 'development', 'example.test'],
  ['development', 'development', 'localhost.evil.test'], ['development', 'development', '127.1'],
  ['development', 'development', 'localhost@evil.test'], ['development', 'development', undefined],
])('hides login for %s / %s / %s', async (nodeEnv, appEnv, host) => {
  process.env = { ...originalEnv, NODE_ENV: nodeEnv as NodeJS.ProcessEnv['NODE_ENV'], APP_ENV: appEnv }
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { host, 'x-forwarded-host': 'localhost' }, body: { role: 'admin' } })
  await handler(req, res)
  expect(res.statusCode).toBe(404)
  expect(mockDemoLogin).not.toHaveBeenCalled()
})

it.each(['localhost', '127.0.0.1:3000', '[::1]:3000'])('accepts loopback host %s', async (host) => {
  mockDemoLogin.mockResolvedValue({ data: { success: true, role: 'mentor' }, headers: { getSetCookie: () => [] } })
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { host }, body: { role: 'mentor' } })
  await handler(req, res)
  expect(res.statusCode).toBe(200)
})

it.each(['owner', '__proto__', 'constructor', '', null, ['admin']])('rejects invalid role %s', async (role) => {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { host: 'localhost' }, body: { role } })
  await handler(req, res)
  expect(res.statusCode).toBe(400)
  expect(mockDemoLogin).not.toHaveBeenCalled()
})

it('allows POST only', async () => {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET', headers: { host: 'localhost' } })
  await handler(req, res)
  expect(res.statusCode).toBe(405)
  expect(res.getHeader('Allow')).toBe('POST')
  expect(mockDemoLogin).not.toHaveBeenCalled()
})

it('does not expose upstream errors or cookies', async () => {
  mockDemoLogin.mockRejectedValue(new Error('secret upstream details'))
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { host: 'localhost' }, body: { role: 'admin' } })
  await handler(req, res)
  expect(res.statusCode).toBe(502)
  expect(res.getHeader('Set-Cookie')).toBeUndefined()
  expect(res._getData()).not.toContain('secret')
})

it.each(['admin', 'mentor'])('logs in the fixed %s account and forwards all cookies', async (role) => {
  const cookies = ['mentor_session=opaque; HttpOnly', 'admin_session=opaque; HttpOnly']
  mockDemoLogin.mockResolvedValue({ data: { success: true, role }, headers: { getSetCookie: () => cookies } })
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { host: 'localhost:3000' }, body: { role, email: 'ignored@example.test' } })
  await handler(req, res)
  expect(mockDemoLogin).toHaveBeenCalledWith(`demo-${role}@openmentor.test`)
  expect(res.statusCode).toBe(200)
  expect(res.getHeader('Set-Cookie')).toEqual(cookies)
  expect(res._getJSONData()).toEqual({ success: true, role })
})
