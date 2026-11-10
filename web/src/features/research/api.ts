import type { Research, ResearchWrite } from '@/features/research/model'
import { ApiError } from '@/lib/admin-moderation-api'
async function request<T>(url: string, method = 'GET', value?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
  if (!response.ok) throw new ApiError('Research request failed', response.status)
  return response.json() as Promise<T>
}
export async function loadResearch(id: string): Promise<Research> {
  return (await request<{ research: Research }>(`/api/admin/research/${encodeURIComponent(id)}`))
    .research
}
export async function loadResearchList(): Promise<Research[]> {
  return (await request<{ research: Research[] }>('/api/admin/research')).research
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((key) => same(left[key], right[key]))
  )
}
export async function saveResearch(value: ResearchWrite, id?: string): Promise<Research> {
  const keys: (keyof ResearchWrite)[] = [
    'slug',
    'title',
    'summary',
    'category',
    'author',
    'publishedOn',
    'readingMinutes',
    'coverUrl',
    'coverAlt',
    'pdfUrl',
    'sections',
    'keyFindings',
    'citation',
    'status',
    'provenance',
    'version',
  ]
  const payload = Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  )
  const { research } = await request<{ research: Research }>(
    `/api/admin/research${id ? `/${encodeURIComponent(id)}` : ''}`,
    id ? 'PUT' : 'POST',
    payload,
  )
  const verified = await loadResearch(research.id)
  if (!same(research, verified)) throw new ApiError('Readback conflict', 409)
  return verified
}
