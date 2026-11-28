import { applyReparse, type ReparseCandidate } from './reparse'
import type { VacancyWrite } from './model'

test('fills only empty fields and replaces exact original source placeholders', () => {
  const value = { title: 'Engineer в Acme', company: 'Edited', description: 'raw', cityId: '', workFormat: 'remote', employment: '', salary: null, responsibilities: ['My edits'], requirements: [], conditions: [] } as unknown as VacancyWrite
  const candidate: ReparseCandidate = { heading: 'Engineer в Acme', rawText: 'raw', title: 'Engineer', company: 'Acme', description: 'Intro', cityId: 'city', workFormat: 'hybrid', employment: 'fullTime', salary: null, responsibilities: ['Tasks'], requirements: ['Req'], conditions: [] }
  const result = applyReparse(value, candidate)
  expect(result).toMatchObject({ title: 'Engineer', company: 'Edited', description: 'Intro', cityId: 'city', workFormat: 'remote', employment: 'fullTime', responsibilities: ['My edits'], requirements: ['Req'] })
})
