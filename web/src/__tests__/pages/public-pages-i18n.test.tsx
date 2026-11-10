import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import ErrorPage from '@/pages/_error'

jest.mock('@/lib/posthog', () => ({ captureException: jest.fn() }))

it('renders public error recovery content in Russian under the RU provider', () => {
  render(<I18nProvider locale="ru"><ErrorPage statusCode={500} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Что-то сломалось' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← Назад ко всем менторам' })).toHaveAttribute('href', '/')
  expect(screen.getByText('Ошибка 500')).toBeInTheDocument()
})

it('preserves the original English public error content', () => {
  render(<I18nProvider locale="en"><ErrorPage statusCode={404} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByText('Page not found.')).toBeInTheDocument()
})
