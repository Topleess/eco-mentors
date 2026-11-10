import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logError: jest.fn(),
  logHttpRequest: jest.fn(),
}))

const mockDemoLogin = jest.fn()

jest.mock('@/lib/go-api-client', () => {
  class HttpError extends Error {
    statusCode: number
    statusText: string
    body: string

    constructor(statusCode: number, statusText: string, body: string) {
      super(`Go API error: ${statusCode} ${statusText} - ${body}`)
      this.name = 'HttpError'
      this.statusCode = statusCode
      this.statusText = statusText
      this.body = body
    }
  }
  return {
    HttpError,
    getGoApiClient: () => ({ demoLogin: mockDemoLogin }),
  }
})

import demoLoginHandler from '@/pages/api/demo/login'
import { HttpError } from '@/lib/go-api-client'

describe('api/demo/login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects non-POST requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    await demoLoginHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res._getJSONData()).toEqual({ error: 'Method not allowed' })
  })

  it('requires a string email', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', body: {} })
    await demoLoginHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(mockDemoLogin).not.toHaveBeenCalled()
  })

  it('forwards the realm cookie and returns the role without exposing a bearer token', async () => {
    const headers = {
      getSetCookie: () => ['mentor_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax'],
    } as unknown as Headers
    mockDemoLogin.mockResolvedValue({
      data: { success: true, role: 'mentor', session: { name: 'Demo Mentor' } },
      headers,
    })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { email: 'demo-mentor@openmentor.test' },
    })

    await demoLoginHandler(req, res)

    expect(mockDemoLogin).toHaveBeenCalledWith('demo-mentor@openmentor.test')
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({ success: true, role: 'mentor', session: { name: 'Demo Mentor' } })
    expect(res.getHeader('Set-Cookie')).toEqual([
      'mentor_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax',
    ])
    expect(JSON.stringify(res._getJSONData())).not.toContain('opaque')
  })

  it('maps denied and disabled demo access to generic client errors', async () => {
    mockDemoLogin.mockRejectedValue(
      new HttpError(401, 'Unauthorized', JSON.stringify({ message: 'Demo account is unavailable' }))
    )
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { email: 'unknown@example.test' },
    })
    await demoLoginHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res._getJSONData()).toEqual({ success: false, message: 'Demo account is unavailable' })
  })

  it('does not log request data or expose backend failures', async () => {
    mockDemoLogin.mockRejectedValue(new Error('connection refused'))
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { email: 'demo-admin@openmentor.test' },
    })
    await demoLoginHandler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res._getJSONData()).toEqual({ success: false, message: 'Internal server error' })
  })
})
