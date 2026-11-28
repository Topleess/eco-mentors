import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { VacancyEditor } from '@/features/vacancies/VacancyEditor'
import { vacancyFixtures } from '@/features/vacancies/fixtures'

it('requires a preview before confirmation and invalidates it on unsaved edits', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Preview text', version: 4 }) })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={{ ...vacancyFixtures[0], status: 'published' }} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  expect(screen.queryByRole('button', { name: 'Confirm Telegram publication' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  expect(await screen.findByText('Preview text')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Job title'), ' changed')
  expect(screen.queryByRole('button', { name: 'Confirm Telegram publication' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview for Telegram' })).toBeDisabled()
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('sends only the preview version after explicit confirmation and shows success', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Saved message', version: 7 }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: 42 }) })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={vacancyFixtures[0]} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  await screen.findByText('Saved message')
  expect(global.fetch).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Confirm Telegram publication' }))
  expect(await screen.findByText('Message sent to Telegram.')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenLastCalledWith(expect.stringContaining('/telegram/publish'), expect.objectContaining({ body: JSON.stringify({ version: 7 }) }))
  expect(screen.queryByRole('button', { name: 'Confirm Telegram publication' })).not.toBeInTheDocument()
})

it('shows missing vacancy errors without offering confirmation', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={vacancyFixtures[0]} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Vacancy not found')
  expect(screen.queryByRole('button', { name: 'Confirm Telegram publication' })).not.toBeInTheDocument()
})

it('distinguishes unconfigured Telegram when confirming a published vacancy', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Saved', version: 1 }) }).mockResolvedValueOnce({ ok: false, status: 503 })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={{ ...vacancyFixtures[0], status: 'published' }} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  await user.click(await screen.findByRole('button', { name: 'Confirm Telegram publication' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram is not configured')
})

it('shows imported photos through same-origin authenticated URLs', () => {
  const vacancy = { ...vacancyFixtures[0], telegramSource: { channelId: '1', messageId: 2, rawText: 'Original', sourceUrl: 'https://example.org', photoIds: ['small', 'large'] } }
  render(<I18nProvider locale="en"><VacancyEditor vacancy={vacancy} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  expect(screen.getAllByRole('img')).toHaveLength(1)
  expect(screen.getByRole('img')).toHaveAttribute('src', `/api/admin/vacancies/${vacancy.id}/telegram/photos/1`)
})

it('identifies the missing company in an imported draft before preview', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn()
  render(<I18nProvider locale="ru"><VacancyEditor vacancy={{ ...vacancyFixtures[0], status: 'draft', title: 'Специалист по охране труда и экологии в Nestle', company: '' }} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Предпросмотр для Telegram' }))
  expect(screen.getByRole('alert')).toHaveTextContent('заполните и сохраните поле «Компания»')
  expect(global.fetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Подтвердить публикацию в Telegram' })).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Компания'), 'Nestle')
  expect(screen.getByRole('button', { name: 'Предпросмотр для Telegram' })).toBeDisabled()
  expect(screen.getByText('Сохраните изменения перед предпросмотром.')).toBeInTheDocument()
})

it.each([
  { title: ' ', company: 'Acme', message: 'Job title field' },
  { title: '', company: ' ', message: 'Job title and Company fields' },
])('identifies missing saved fields without requesting a preview', async ({ title, company, message }) => {
  const user = userEvent.setup()
  global.fetch = jest.fn()
  render(<I18nProvider locale="en"><VacancyEditor vacancy={{ ...vacancyFixtures[0], status: 'draft', title, company }} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  expect(screen.getByRole('alert')).toHaveTextContent(message)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('previews a saved draft but does not offer to send it', async () => {
  const user = userEvent.setup()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Saved draft', version: 1 }) })
  render(<I18nProvider locale="en"><VacancyEditor vacancy={{ ...vacancyFixtures[0], status: 'draft' }} dictionaries={{ industries: [], cities: [] }} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Preview for Telegram' }))
  expect(await screen.findByText('Saved draft')).toBeInTheDocument()
  expect(screen.getByText(/publish the vacancy on the website before sending/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Confirm Telegram publication' })).not.toBeInTheDocument()
})
