export type VacancyStatus = 'published' | 'draft' | 'archived'
export type WorkFormat = 'remote' | 'hybrid' | 'office'
export type Industry = string
export interface DictionaryEntry {
  id: string
  slug: string
  name: string
  active: boolean
  version: number
  updatedAt: string
}
export interface VacancyDictionaries { industries: DictionaryEntry[]; cities: DictionaryEntry[] }
export interface Vacancy {
  id: string
  slug: string
  title: string
  company: string
  industryId: string
  cityId: string
  location: string
  industry: Industry
  workFormat: WorkFormat
  status: VacancyStatus
  salary: { min: number | null; max: number | null; currency: 'RUB' } | null
  experience: 'junior' | 'middle' | 'senior'
  employment: 'fullTime' | 'partTime' | 'internship'
  description: string
  responsibilities: string[]
  requirements: string[]
  conditions: string[]
  provenance: 'synthetic' | 'manual'
  version: number
  createdAt: string
  updatedAt: string
}
export type VacancyWrite = Omit<Vacancy, 'id' | 'industry' | 'location' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number }
export interface VacancyProvider {
  readonly source: 'mock'
  listPublished(): Vacancy[]
  listAdmin(): Vacancy[]
}
