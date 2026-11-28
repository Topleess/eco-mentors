import type { VacancyWrite } from './model'

export type ReparseCandidate = Pick<VacancyWrite, 'title' | 'company' | 'description' | 'cityId' | 'workFormat' | 'employment' | 'salary' | 'responsibilities' | 'requirements' | 'conditions'> & { heading: string; rawText: string }

export function applyReparse(value: VacancyWrite, candidate: ReparseCandidate): VacancyWrite {
  const next = { ...value }
  for (const key of ['title', 'company', 'description', 'cityId', 'workFormat', 'employment'] as const) {
    const original = value[key]
    const placeholder = (key === 'title' && original === candidate.heading) || (key === 'description' && original === candidate.rawText)
    if ((!original?.trim() || placeholder) && candidate[key]?.trim()) Object.assign(next, { [key]: candidate[key] })
  }
  if (!value.salary && candidate.salary) next.salary = candidate.salary
  for (const key of ['responsibilities', 'requirements', 'conditions'] as const) {
    if (!value[key].some(item => item.trim()) && candidate[key].some(item => item.trim())) next[key] = [...candidate[key]]
  }
  return next
}
