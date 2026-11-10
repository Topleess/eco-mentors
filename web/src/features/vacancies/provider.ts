import type { VacancyProvider } from '@/features/vacancies/model'
import { vacancyFixtures } from '@/features/vacancies/fixtures'

export function createVacancyProvider(source: 'mock'): VacancyProvider {
  if (source !== 'mock') throw new Error('Unsupported vacancy source')
  const copy = () => vacancyFixtures.map(row => ({ ...row, salary: row.salary ? { ...row.salary } : null, responsibilities: [...row.responsibilities], requirements: [...row.requirements], conditions: [...row.conditions] }))
  return { source, listAdmin: copy, listPublished: () => copy().filter(row => row.status === 'published') }
}

// Deliberate source selection; an API adapter must be implemented, never inferred.
export const vacancyProvider = createVacancyProvider('mock')
