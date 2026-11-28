import { fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { VacancyEditor } from './VacancyEditor'
import type { Vacancy } from './model'

jest.mock('./TelegramPublish', () => ({ TelegramPublish: () => null }))
jest.mock('./CreatableDictionarySelect', () => ({ CreatableDictionarySelect: () => null }))

const vacancy = { id: '1', slug: 'draft', title: 'Original', company: '', industryId: '', cityId: '', workFormat: '', experience: '', employment: '', status: 'draft', salary: null, description: 'Original post', responsibilities: [], requirements: [], conditions: [], provenance: 'manual', version: 1, telegramSource: { channelId: 'channel', messageId: 1, rawText: 'Original post', photoIds: [], sourceUrl: '' } } as unknown as Vacancy
const candidate = { heading: 'Original', rawText: 'Original post', title: 'Ecologist', company: 'Green Co', description: 'Protect nature', cityId: 'secret-city-id', workFormat: 'remote', employment: 'fullTime', salary: { min: 100000, max: 150000, currency: 'RUB' }, responsibilities: ['Survey habitats'], requirements: ['Field experience'], conditions: ['Flexible hours'] }
const cities = [{ id: 'secret-city-id', name: 'Москва', slug: 'moscow', active: true, version: 1, updatedAt: '' }]

beforeEach(() => { global.fetch = jest.fn() })

test.each([['ru', 'Извлечённые данные', 'Удалённо', 'Полная занятость'], ['en', 'Extracted data', 'Remote', 'Full time']])('renders translated extracted fields in %s', async (locale, heading, format, employment) => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => candidate })
  render(<I18nProvider locale={locale}><VacancyEditor vacancy={vacancy} dictionaries={{ industries: [], cities }} onSave={jest.fn()} onCancel={() => {}} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: /разобрать исходный пост/i }))
  const preview = await screen.findByRole('region', { name: heading })
  for (const text of ['Москва', 'Ecologist', format, employment, 'Survey habitats', 'Field experience', 'Flexible hours']) expect(preview).toHaveTextContent(text)
  expect(preview.querySelectorAll('li')).toHaveLength(3)
  expect(preview).not.toHaveTextContent(/secret-city-id|"title"|fullTime/)
  expect(screen.getByLabelText(locale === 'ru' ? 'Название вакансии' : 'Job title')).toHaveValue('Original')
  fireEvent.click(screen.getByRole('button', { name: /подтвердить и заполнить/i }))
  expect(screen.getByLabelText(locale === 'ru' ? 'Название вакансии' : 'Job title')).toHaveValue('Ecologist')
})

test('marks missing and unrecognized fields without guessing or exposing codes', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ ...candidate, cityId: 'unknown-city-id', workFormat: 'unknown-format', employment: '', salary: null, requirements: [] }) })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={vacancy} dictionaries={{ industries: [], cities }} onSave={jest.fn()} onCancel={() => {}} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: /разобрать исходный пост/i }))
  const preview = await screen.findByRole('region', { name: 'Extracted data' })
  expect(within(preview).getAllByText('Missing or unrecognized — not guessed')).toHaveLength(5)
  expect(preview).not.toHaveTextContent(/unknown-city-id|unknown-format/)
})
