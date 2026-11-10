/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import { analyticsRequests, analyticsTraffic } from '@/server/analytics-api'
import { getTrafficAnalytics, clearTrafficCache } from '@/server/umami-analytics'
import { parseAnalyticsRange } from '@/server/analytics-range'

const mockRequest = jest.fn()
const mockSession = jest.fn()
jest.mock('@/lib/go-api-client', () => ({
  ...jest.requireActual('@/lib/go-api-client'),
  getGoApiClient: () => ({ requestWithCookies: mockRequest, adminGetSession: mockSession }),
}))
const rangeQuery = { startDate: '2026-11-01', endDate: '2026-11-03' }
const realFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  clearTrafficCache()
  delete process.env.UMAMI_API_URL
  delete process.env.UMAMI_API_TOKEN
  delete process.env.UMAMI_WEBSITE_ID
  mockSession.mockResolvedValue({ data: { success: true, session: { role: 'admin' } } })
})
afterAll(() => {
  global.fetch = realFetch
})

it('validates actual dates, inclusive Moscow boundaries and bounded ranges', () => {
  const range = parseAnalyticsRange(rangeQuery)
  expect(range.startAt).toBe(Date.parse('2026-11-01T00:00:00+03:00'))
  expect(range.endAt).toBe(Date.parse('2026-11-04T00:00:00+03:00') - 1)
  expect(range.days).toHaveLength(3)
  for (const bad of [
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: ['2026-11-01'], endDate: '2026-11-03' },
    { startDate: '2026-11-03', endDate: '2026-11-01' },
    { startDate: '2024-01-01', endDate: '2026-01-01' },
  ])
    expect(() => parseAnalyticsRange(bad)).toThrow()
})
it('forwards only approved query values and cookies to request analytics', async () => {
  mockRequest.mockResolvedValue({ data: { summary: { created: 1 } } })
  const { req, res } = createMocks({
    method: 'GET',
    headers: { cookie: 'admin_session=test' },
    query: { ...rangeQuery, token: 'never-forward' },
  })
  await analyticsRequests(req, res)
  expect(res.statusCode).toBe(200)
  expect(res.getHeader('Cache-Control')).toBe('no-store')
  expect(mockRequest).toHaveBeenCalledWith(
    'GET',
    '/api/v1/admin/analytics/requests?startDate=2026-11-01&endDate=2026-11-03',
    { cookies: 'admin_session=test' },
  )
})
it('requires real admin authorization before reading cached traffic or provider state', async () => {
  const anonymous = createMocks({ method: 'GET', query: rangeQuery })
  await analyticsTraffic(anonymous.req, anonymous.res)
  expect(anonymous.res.statusCode).toBe(401)
  mockSession.mockResolvedValue({ data: { success: true, session: { role: 'moderator' } } })
  const moderator = createMocks({
    method: 'GET',
    headers: { cookie: 'admin_session=test' },
    query: rangeQuery,
  })
  await analyticsTraffic(moderator.req, moderator.res)
  expect(moderator.res.statusCode).toBe(403)
})
it('distinguishes unconfigured traffic from zero visits', async () => {
  const result = await getTrafficAnalytics(parseAnalyticsRange(rangeQuery))
  expect(result.status).toBe('not_configured')
  expect(result.summary).toBeNull()
  expect(result.daily).toEqual([])
})
function configure() {
  process.env.UMAMI_API_URL = 'http://127.0.0.1:18185'
  process.env.UMAMI_API_TOKEN = 'private-test-token'
  process.env.UMAMI_WEBSITE_ID = '6dd67ccb-9298-492f-9393-f3901992052d'
}
it('normalizes the pinned Umami v3 stats, fills zero days and never sums daily uniques', async () => {
  configure()
  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const u = new URL(String(input))
    let data: unknown = []
    if (u.pathname.endsWith('/stats'))
      data = {
        visitors: 2,
        visits: 3,
        pageviews: 8,
        comparison: { visitors: 4, visits: 5, pageviews: 12 },
      }
    if (u.pathname.endsWith('/pageviews'))
      data = {
        pageviews: [{ x: '2026-11-02 00:00:00', y: 8 }],
        sessions: [{ x: '2026-11-02 00:00:00', y: 2 }],
      }
    if (u.searchParams.get('type') === 'path')
      data = [
        { x: '/mentor/alex?token=private', y: 2 },
        { x: '/admin/mentors', y: 4 },
        { x: '/research/a-report', y: 1 },
      ]
    return new Response(JSON.stringify(data), { status: 200 })
  }) as typeof fetch
  const range = parseAnalyticsRange(rangeQuery)
  const result = await getTrafficAnalytics(range)
  expect(result.status).toBe('connected')
  expect(result.summary).toEqual({
    visitors: 2,
    visits: 3,
    views: 8,
    previousVisitors: 4,
    previousVisits: 5,
    previousViews: 12,
  })
  expect(result.daily).toEqual([
    { date: '2026-11-01', views: 0, visitors: 0 },
    { date: '2026-11-02', views: 8, visitors: 2 },
    { date: '2026-11-03', views: 0, visitors: 0 },
  ])
  expect(result.pages).toEqual([
    { name: '/mentor/alex', count: 2 },
    { name: '/research/a-report', count: 1 },
  ])
  const calls = (global.fetch as jest.Mock).mock.calls
  expect(
    calls.every(
      ([url, options]) =>
        new URL(url).searchParams.get('timezone') === 'Europe/Moscow' &&
        options.headers.Authorization === 'Bearer private-test-token',
    ),
  ).toBe(true)
  const callCount = calls.length
  await getTrafficAnalytics(range)
  expect(global.fetch).toHaveBeenCalledTimes(callCount)
  expect(JSON.stringify(result)).not.toContain('private-test-token')
})
it('returns unavailable, not fake zeros, for a malformed or failed provider', async () => {
  configure()
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ error: 'private upstream detail' }), { status: 503 }),
    )
  const result = await getTrafficAnalytics(parseAnalyticsRange(rangeQuery))
  expect(result.status).toBe('unavailable')
  expect(result.summary).toBeNull()
  expect(JSON.stringify(result)).not.toContain('private upstream detail')
})
it('rejects methods and malformed ranges without calling Umami', async () => {
  const badMethod = createMocks({ method: 'POST', headers: { cookie: 'test' }, query: rangeQuery })
  await analyticsTraffic(badMethod.req, badMethod.res)
  expect(badMethod.res.statusCode).toBe(405)
  const badRange = createMocks({
    method: 'GET',
    headers: { cookie: 'test' },
    query: { ...rangeQuery, startDate: '2026-02-31' },
  })
  await analyticsTraffic(badRange.req, badRange.res)
  expect(badRange.res.statusCode).toBe(400)
})
