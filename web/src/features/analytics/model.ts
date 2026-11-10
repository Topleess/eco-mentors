export interface DateRange {
  startDate: string
  endDate: string
}
export interface Metric {
  name: string
  count: number
}
export interface TrafficData {
  status: 'connected' | 'not_configured' | 'unavailable'
  range: DateRange & { timezone: string }
  generatedAt: string
  summary: {
    visitors: number
    visits: number
    views: number
    previousVisitors: number
    previousVisits: number
    previousViews: number
  } | null
  daily: { date: string; visitors: number; views: number }[]
  sources: Metric[]
  devices: Metric[]
  pages: Metric[]
  events: Metric[]
  campaigns?: Metric[]
}
export interface RequestsData {
  range: DateRange & { timezone: string }
  generatedAt: string
  historyStartedAt: string
  historyCoverage: { eligible: number; total: number }
  summary: {
    created: number
    previousCreated: number
    active: number
    done: number
    declined: number
    attention: number
  }
  daily: { date: string; created: number; done: number; declined: number }[]
  statuses: { status: string; count: number }[]
  funnel: { status: string; count: number }[]
  durations: {
    stage: string
    medianHours: number | null
    p90Hours: number | null
    sampleCount: number
  }[]
  mentors: {
    id: string
    name: string
    created: number
    pending: number
    contacted: number
    working: number
    done: number
    declined: number
    unavailable: number
    attention: number
  }[]
  declineReasons: { reason: string; count: number }[]
  attention: { mentorId: string; mentorName: string; count: number; oldestCreatedAt: string }[]
}
const DAY = 86400000
export function analyticsPreset(days: number, now = new Date()): DateRange {
  const endDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const startDate = new Date(Date.parse(`${endDate}T00:00:00Z`) - (days - 1) * DAY)
    .toISOString()
    .slice(0, 10)
  return { startDate, endDate }
}
export function validAnalyticsDates(start: string, end: string): boolean {
  const valid = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  return (
    valid(start) && valid(end) && end >= start && (Date.parse(end) - Date.parse(start)) / DAY < 366
  )
}
export function analyticsCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (value: string | number | null): string => {
    let text = value === null ? '' : String(value)
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
): void {
  const url = URL.createObjectURL(
    new Blob([analyticsCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
