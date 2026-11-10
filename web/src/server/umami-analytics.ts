import { createHash } from 'node:crypto'
import type { AnalyticsRange } from '@/server/analytics-range'
import { publicRange } from '@/server/analytics-range'

interface Metric {
  name: string
  count: number
}
interface TrafficSummary {
  visitors: number
  visits: number
  views: number
  previousVisitors: number
  previousVisits: number
  previousViews: number
}
export interface TrafficAnalytics {
  status: 'connected' | 'not_configured' | 'unavailable'
  range: ReturnType<typeof publicRange>
  generatedAt: string
  summary: TrafficSummary | null
  daily: { date: string; visitors: number; views: number }[]
  sources: Metric[]
  devices: Metric[]
  pages: Metric[]
  events: Metric[]
  campaigns: Metric[]
}
const cache = new Map<string, { expires: number; value: TrafficAnalytics }>()
const pending = new Map<string, Promise<TrafficAnalytics>>()
export function clearTrafficCache(): void {
  cache.clear()
  pending.clear()
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid provider response')
  return value as Record<string, unknown>
}
function count(value: unknown): number {
  const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < 0)
    throw new Error('Invalid provider count')
  return result
}
// These are public publication addresses, never private request/login capabilities.
function safePath(value: string): string | null {
  const path = value.split(/[?#]/)[0]
  if (/^\/(?:|about|faq|bementor|donate|mentors|vacancies|research)\/?$/.test(path)) return path
  if (
    /^\/(?:mentor\/[a-z0-9_-]+(?:\/contact)?|mentors\/[a-z0-9_-]+|vacancies\/[a-z0-9_-]+|research\/[a-z0-9_-]+)\/?$/i.test(
      path,
    ) &&
    !/^\/mentor\/(?:auth|requests|profile|login|confirm|past|index)(?:\/|$)/i.test(path)
  )
    return path
  return null
}
function metrics(value: unknown, kind: string): Metric[] {
  if (!Array.isArray(value)) throw new Error('Invalid provider metrics')
  return value.flatMap((row: unknown) => {
    const item = record(row)
    if (typeof item.x !== 'string') throw new Error('Invalid provider metric label')
    let name = item.x
    if (kind === 'path') {
      const safe = safePath(name)
      if (!safe) return []
      name = safe
    } else if (kind === 'referrer') {
      // Host names only: no referrer paths, credentials, query strings or fragments.
      if (!/^[a-z0-9.-]{0,253}$/i.test(name)) return []
      name = name || '(direct)'
    } else if (!/^[\p{L}\p{N} _.-]{0,100}$/u.test(name)) return []
    return [{ name: name || '(unknown)', count: count(item.y) }]
  })
}
function series(value: unknown): Map<string, number> {
  if (!Array.isArray(value)) throw new Error('Invalid provider series')
  return new Map(
    value.map((row: unknown) => {
      const item = record(row)
      if (typeof item.x !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(item.x))
        throw new Error('Invalid provider date')
      return [item.x.slice(0, 10), count(item.y)]
    }),
  )
}
function empty(range: AnalyticsRange, status: TrafficAnalytics['status']): TrafficAnalytics {
  return {
    status,
    range: publicRange(range),
    generatedAt: new Date().toISOString(),
    summary: null,
    daily: [],
    sources: [],
    devices: [],
    pages: [],
    events: [],
    campaigns: [],
  }
}
export async function getTrafficAnalytics(range: AnalyticsRange): Promise<TrafficAnalytics> {
  const endpoint = process.env.UMAMI_API_URL?.replace(/\/$/, '')
  const token = process.env.UMAMI_API_TOKEN
  const website = process.env.UMAMI_WEBSITE_ID
  if (!endpoint || !token || !website) return empty(range, 'not_configured')
  let url: URL
  try {
    url = new URL(endpoint)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^[a-f0-9-]{36}$/i.test(website)
    )
      throw new Error('Invalid configuration')
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('HTTPS required')
  } catch {
    return empty(range, 'unavailable')
  }
  const key = `${endpoint}:${website}:${createHash('sha256').update(token).digest('hex')}:${range.startDate}:${range.endDate}`
  const saved = cache.get(key)
  if (saved && saved.expires > Date.now()) return saved.value
  const inflight = pending.get(key)
  if (inflight) return inflight
  const operation = (async (): Promise<TrafficAnalytics> => {
    try {
      const fetchData = async (
        route: string,
        extra: Record<string, string> = {},
      ): Promise<unknown> => {
        const query = new URLSearchParams({
          startAt: String(range.startAt),
          endAt: String(range.endAt),
          timezone: range.timezone,
          unit: 'day',
          ...extra,
        })
        const response = await fetch(`${endpoint}/api/websites/${website}/${route}?${query}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
          redirect: 'error',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Provider unavailable')
        const body = await response.text()
        if (body.length > 2000000) throw new Error('Provider response too large')
        return JSON.parse(body) as unknown
      }
      const [statsRaw, timelineRaw, sources, devices, pages, events, campaigns] = await Promise.all(
        [
          fetchData('stats'),
          fetchData('pageviews'),
          fetchData('metrics', { type: 'referrer', limit: '100' }),
          fetchData('metrics', { type: 'device', limit: '20' }),
          fetchData('metrics', { type: 'path', limit: '500' }),
          fetchData('metrics', { type: 'event', limit: '100' }),
          fetchData('metrics', { type: 'utmCampaign', limit: '100' }),
        ],
      )
      const stats = record(statsRaw)
      const previous = record(stats.comparison)
      const timeline = record(timelineRaw)
      const viewsByDay = series(timeline.pageviews)
      const visitorsByDay = series(timeline.sessions)
      const value: TrafficAnalytics = {
        status: 'connected',
        range: publicRange(range),
        generatedAt: new Date().toISOString(),
        summary: {
          visitors: count(stats.visitors),
          visits: count(stats.visits),
          views: count(stats.pageviews),
          previousVisitors: count(previous.visitors),
          previousVisits: count(previous.visits),
          previousViews: count(previous.pageviews),
        },
        daily: range.days.map((date) => ({
          date,
          views: viewsByDay.get(date) ?? 0,
          visitors: visitorsByDay.get(date) ?? 0,
        })),
        sources: metrics(sources, 'referrer'),
        devices: metrics(devices, 'device'),
        pages: metrics(pages, 'path'),
        events: metrics(events, 'event'),
        campaigns: metrics(campaigns, 'utmCampaign'),
      }
      if (cache.size >= 24) cache.delete(cache.keys().next().value as string)
      cache.set(key, { expires: Date.now() + 30000, value })
      return value
    } catch {
      return empty(range, 'unavailable')
    }
  })()
  pending.set(key, operation)
  try {
    return await operation
  } finally {
    pending.delete(key)
  }
}
