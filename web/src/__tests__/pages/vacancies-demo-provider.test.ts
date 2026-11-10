import { createVacancyProvider } from '@/features/vacancies/provider'

it('explicit mock source exposes only published public records and defensive copies', () => {
  const provider = createVacancyProvider('mock')
  const all = provider.listAdmin()
  expect(all).toHaveLength(12)
  expect(new Set(all.map(row => row.responsibilities[0])).size).toBe(12)
  expect(new Set(all.map(row => row.requirements[0])).size).toBe(12)
  expect(all.every(row => row.provenance === 'synthetic' && row.description && row.conditions.length)).toBe(true)
  expect(new Set(all.map(row => row.slug)).size).toBe(all.length)
  expect(all.some(row => row.salary === null)).toBe(true)
  expect(new Set(all.map(row => row.status))).toEqual(new Set(['published', 'draft', 'archived']))
  expect(provider.listPublished()).toHaveLength(9)
  expect(provider.listPublished().every(row => row.status === 'published')).toBe(true)
  all[0].responsibilities.push('mutation')
  expect(provider.listAdmin()[0].responsibilities).not.toContain('mutation')
  expect(() => createVacancyProvider('api' as 'mock')).toThrow('Unsupported vacancy source')
})
