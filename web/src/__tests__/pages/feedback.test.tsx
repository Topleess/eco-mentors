import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Footer from '@/components/layout/Footer'
import Feedback from '@/pages/feedback'
import { randomUUID } from 'node:crypto'

jest.mock('@/components', () => ({
  NavHeader: () => <header />,
  Footer: () => <footer />,
  MetaHeader: () => null,
}))

jest.mock('@/components/forms/Captcha', () => ({
  __esModule: true,
  default: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess('test-captcha')}>Captcha test</button>
  ),
}))

const renderFeedback = (): void => { render(<I18nProvider locale="ru"><Feedback /></I18nProvider>) }
const message = 'Добавьте фильтр по теме.'
function completeForm(): void {
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'suggestion' } })
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: message } })
  fireEvent.click(screen.getByRole('button', { name: 'Captcha test' }))
}

const originalFetch = global.fetch
beforeAll(() => { if (!global.crypto.randomUUID) Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: randomUUID }) })
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks() })

test('submits an anonymous idea through the site, not a mail application', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ status: 201, json: async () => ({ success: true }) })
  global.fetch = fetchMock
  renderFeedback()
  const button = screen.getByRole('button', { name: 'Отправить' })
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  completeForm()
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Сообщение отправлено'))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/feedback')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    submissionId: expect.any(String), category: 'suggestion', message, consent: true, captchaToken: 'test-captcha',
  })
})

test('keeps the message and request identifier on a temporary failure', async () => {
  const fetchMock = jest.fn().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ status: 201, json: async () => ({ success: true }) })
  global.fetch = fetchMock
  renderFeedback()
  completeForm()
  fireEvent.change(screen.getByLabelText(/почта для ответа/i), { target: { value: 'reply@example.test' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось отправить/i)
  expect(screen.getByLabelText('Сообщение')).toHaveValue(message)
  fireEvent.click(screen.getByRole('button', { name: 'Captcha test' }))
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Сообщение отправлено')
  const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))
  expect(bodies[0].submissionId).toBe(bodies[1].submissionId)
  expect(bodies[1].email).toBe('reply@example.test')
})

describe.each(['ru', 'en'] as const)('feedback navigation (%s)', (locale) => {
  it('links to feedback from the footer', () => {
    render(<I18nProvider locale={locale}><Footer /></I18nProvider>)
    expect(screen.getByRole('link', { name: locale === 'ru' ? 'Обратная связь' : 'Feedback' })).toHaveAttribute('href', '/feedback')
  })
})
