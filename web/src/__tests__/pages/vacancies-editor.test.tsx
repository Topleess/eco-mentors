import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n'
import { VacancyEditor } from '@/features/vacancies/VacancyEditor'
import { vacancyFixtures } from '@/features/vacancies/fixtures'
import { ApiError } from '@/lib/admin-moderation-api'

const mockEvents = { on: jest.fn(), off: jest.fn(), emit: jest.fn() }
const mockRouter = { events: mockEvents }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
beforeEach(() => {
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => '11111111-1111-4111-8111-111111111111') })
})

const metadata = { slug: 'custom', version: 1, updatedAt: '2026-11-09T00:00:00Z' }
const dictionaries = { industries: [{ ...metadata, id: 'industry-1', name: 'Custom industry', active: true }], cities: [{ ...metadata, id: 'city-1', name: 'Custom city', active: true }] }

it('starts in draft, validates required fields and saves canonical dictionary references', async () => {
  const user = userEvent.setup()
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  expect(screen.getByLabelText('Status')).toHaveValue('draft')
  fireEvent.submit(screen.getByRole('form', { name: 'Vacancy editor' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Complete the required fields')
  expect(save).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Job title'), 'New role')
  await user.type(screen.getByLabelText('Company'), 'New company')
  await user.type(screen.getByLabelText('About the role'), 'A genuine description')
  await user.click(screen.getByRole('button', { name: 'Industry' }))
  await user.click(screen.getByRole('option', { name: 'Custom industry' }))
  await user.click(screen.getByRole('button', { name: 'City' }))
  await user.click(screen.getByRole('option', { name: 'Custom city' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'New role', company: 'New company', industryId: 'industry-1', cityId: 'city-1', status: 'draft', salary: null })))
})

const existing = { ...vacancyFixtures[0], industryId: 'industry-1', cityId: 'city-1' }
it('normalizes prose lists before saving without dropping text while typing', async () => {
  const user = userEvent.setup()
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  fireEvent.change(screen.getByLabelText('Responsibilities'), { target: { value: ' First task \n\n Second task \n' } })
  expect(screen.getByLabelText('Responsibilities')).toHaveValue(' First task \n\n Second task \n')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ responsibilities: ['First task', 'Second task'] })))
})
it('retains edits on a version conflict and does not report success', async () => {
  const user = userEvent.setup()
  const save = jest.fn().mockRejectedValue(new ApiError('Conflict', 409))
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  await user.type(screen.getByLabelText('Company'), ' edited')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The record changed')
  expect(screen.getByLabelText('Company')).toHaveValue(`${existing.company} edited`)
  expect(screen.queryByText('Saved and verified')).not.toBeInTheDocument()
})
it('blocks invalid salary ranges and preserves a single-sided salary', async () => {
  const user = userEvent.setup()
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  fireEvent.change(screen.getByLabelText('Salary from, RUB'), { target: { value: '200000' } })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a nonnegative salary')
  expect(save).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('Salary to, RUB'))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ salary: { min: 200000, max: null, currency: 'RUB' } })))
})
it('guards dirty cancellation and beforeunload, then clears the guard after saving', async () => {
  const user = userEvent.setup()
  const cancel = jest.fn()
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={cancel} /></I18nProvider>)
  await user.type(screen.getByLabelText('Company'), ' changed')
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(confirm).toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved and verified')).toBeInTheDocument()
  const cleanEvent = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(cleanEvent)
  expect(cleanEvent.defaultPrevented).toBe(false)
  confirm.mockRestore()
})
it('cancels internal links before routing without throwing a runtime error', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
  render(<I18nProvider locale="en"><a href="/admin/vacancies">Vacancy list</a><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={jest.fn()} onCancel={jest.fn()} /></I18nProvider>)
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Unsaved company' } })
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
  expect(screen.getByRole('link', { name: 'Vacancy list' }).dispatchEvent(click)).toBe(false)
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByLabelText('Company')).toHaveValue('Unsaved company')
  confirm.mockRestore()
})

it('hides the URL field and creates a stable automatic URL for a Cyrillic title across retries', async () => {
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => '11111111-1111-4111-8111-111111111111') })
  const user = userEvent.setup()
  const save = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  render(<I18nProvider locale="ru"><VacancyEditor dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  expect(screen.queryByLabelText(/Адрес|URL slug/)).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Название вакансии'), 'Эколог')
  await user.type(screen.getByLabelText('Компания'), 'Компания')
  await user.type(screen.getByLabelText('О вакансии'), 'Описание вакансии')
  for (const [label, name] of [['Отрасль', 'Custom industry'], ['Город', 'Custom city']]) {
    await user.click(screen.getByRole('button', { name: label }))
    await user.click(screen.getByRole('option', { name }))
  }
  await user.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить')
  await user.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  const slug = save.mock.calls[0][0].slug
  expect(slug).toBe('vacancy-11111111-1111-4111-8111-111111111111')
  expect(save.mock.calls[1][0].slug).toBe(slug)
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
})

it('preserves the existing URL when the vacancy title changes', async () => {
  const user = userEvent.setup()
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  expect(screen.queryByLabelText(/URL slug/)).not.toBeInTheDocument()
  await user.clear(screen.getByLabelText('Job title'))
  await user.type(screen.getByLabelText('Job title'), 'A renamed vacancy')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ slug: existing.slug, title: 'A renamed vacancy' })))
})

it('requires archive confirmation and saves archived status', async () => {
  const user = userEvent.setup()
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  const save = jest.fn().mockResolvedValue(undefined)
  render(<I18nProvider locale="en"><VacancyEditor vacancy={existing} dictionaries={dictionaries} onSave={save} onCancel={jest.fn()} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Archive' }))
  expect(save).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived', version: 1, provenance: 'synthetic' })))
  confirm.mockRestore()
})
