import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VacancyEditor } from './VacancyEditor'
import type { Vacancy } from './model'

jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('./TelegramPublish', () => ({ TelegramPublish: () => null }))
jest.mock('./CreatableDictionarySelect', () => ({ CreatableDictionarySelect: () => null }))

const sparse = { id: '1', slug: 'draft', title: 'Title', company: 'Company', industryId: '', cityId: '', workFormat: '', experience: '', employment: '', status: 'draft', salary: null, description: '', responsibilities: [], requirements: [], conditions: [], provenance: 'manual', version: 1 } as unknown as Vacancy

test('saves sparse draft but blocks publishing it', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined)
  render(<VacancyEditor vacancy={sparse} dictionaries={{ industries: [], cities: [] }} onSave={onSave} onCancel={() => {}} />)
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', cityId: '', workFormat: '' })))
  fireEvent.change(screen.getByLabelText('status'), { target: { value: 'published' } })
  fireEvent.submit(screen.getByRole('form'))
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('alert')).toBeInTheDocument()
})

test('shows extracted data as readable fields without JSON or dictionary IDs', async () => {
  const candidate = { heading: 'Original', rawText: 'Original post', title: 'Ecologist', company: 'Green Co', description: 'Protect nature', cityId: 'city-secret-id', workFormat: 'remote', employment: 'fullTime', salary: { min: 100000, max: 150000, currency: 'RUB' }, responsibilities: ['Survey habitats'], requirements: ['Field experience'], conditions: ['Flexible hours'] }
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => candidate })
  const vacancy = { ...sparse, telegramSource: { channelId: 'channel', messageId: 1, rawText: 'Original post', photoIds: [], sourceUrl: '' } }
  render(<VacancyEditor vacancy={vacancy} dictionaries={{ industries: [], cities: [{ id: 'city-secret-id', name: 'Москва', slug: 'moscow', active: true, version: 1, updatedAt: '' }] }} onSave={jest.fn()} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /разобрать исходный пост/i }))
  const preview = await screen.findByRole('region', { name: 'reparsePreview' })
  expect(preview).toHaveTextContent('Москва')
  expect(preview).toHaveTextContent('Ecologist')
  expect(preview).toHaveTextContent('remote')
  expect(preview).toHaveTextContent('fullTime')
  expect(preview).toHaveTextContent('100')
  expect(preview.querySelectorAll('li')).toHaveLength(3)
  expect(preview).not.toHaveTextContent('city-secret-id')
  expect(preview).not.toHaveTextContent('"title"')
})
