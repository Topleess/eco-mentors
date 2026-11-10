import { ApiError } from '@/lib/admin-moderation-api'
import type { DictionaryEntry, Vacancy, VacancyDictionaries, VacancyWrite } from '@/features/vacancies/model'

async function request<T>(url: string, method = 'GET', value?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) })
  if (!response.ok) throw new ApiError('Vacancy request failed', response.status)
  return response.json() as Promise<T>
}
export async function loadAdminVacancies(): Promise<Vacancy[]> { return (await request<{ vacancies: Vacancy[] }>('/api/admin/vacancies')).vacancies }
export async function loadVacancy(id: string): Promise<Vacancy> { return (await request<{ vacancy: Vacancy }>(`/api/admin/vacancies/${encodeURIComponent(id)}`)).vacancy }
export async function loadDictionary(kind: 'industries' | 'cities'): Promise<DictionaryEntry[]> { return (await request<{ items: DictionaryEntry[] }>(`/api/admin/vacancy-${kind}`)).items }
export async function loadAdminDictionaries(): Promise<VacancyDictionaries> {
  const [industries, cities] = await Promise.all([loadDictionary('industries'), loadDictionary('cities')])
  return { industries, cities }
}
export async function saveVacancy(value: VacancyWrite, id?: string): Promise<Vacancy> {
  const { vacancy } = await request<{ vacancy: Vacancy }>(`/api/admin/vacancies${id ? `/${encodeURIComponent(id)}` : ''}`, id ? 'PUT' : 'POST', value)
  const verified = await loadVacancy(vacancy.id)
  if (verified.id !== vacancy.id || verified.version !== vacancy.version) throw new ApiError('Readback conflict', 409)
  return verified
}
export type DictionaryWrite = Pick<DictionaryEntry, 'slug' | 'name' | 'active'> & { version?: number }
export async function saveDictionary(kind: 'industries' | 'cities', value: DictionaryWrite, id?: string): Promise<DictionaryEntry> {
  const { item } = await request<{ item: DictionaryEntry }>(`/api/admin/vacancy-${kind}${id ? `/${encodeURIComponent(id)}` : ''}`, id ? 'PUT' : 'POST', value)
  const verified = (await loadDictionary(kind)).find(row => row.id === item.id)
  if (!verified || verified.version !== item.version) throw new ApiError('Readback conflict', 409)
  return verified
}
