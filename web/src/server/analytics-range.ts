export interface AnalyticsRange {
  startDate: string
  endDate: string
  timezone: 'Europe/Moscow'
  startAt: number
  endAt: number
  days: string[]
}
const DAY = 86400000
export function parseAnalyticsRange(query: Record<string, unknown>): AnalyticsRange {
  const { startDate, endDate } = query
  function midnight(value: unknown): number {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error('Invalid date')
    const utc = Date.parse(`${value}T00:00:00Z`)
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value)
      throw new Error('Invalid date')
    return utc - 3 * 3600000
  }
  const startAt = midnight(startDate)
  const endAt = midnight(endDate) + DAY - 1
  const length = (endAt + 1 - startAt) / DAY
  if (length < 1 || length > 366) throw new Error('Range must contain 1–366 days')
  const days = Array.from({ length }, (_, index) =>
    new Date(startAt + 3 * 3600000 + index * DAY).toISOString().slice(0, 10),
  )
  return {
    startDate: startDate as string,
    endDate: endDate as string,
    timezone: 'Europe/Moscow',
    startAt,
    endAt,
    days,
  }
}
export function publicRange(
  range: AnalyticsRange,
): Pick<AnalyticsRange, 'startDate' | 'endDate' | 'timezone'> {
  return { startDate: range.startDate, endDate: range.endDate, timezone: range.timezone }
}
