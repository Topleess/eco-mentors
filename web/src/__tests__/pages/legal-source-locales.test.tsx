import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Privacy from '@/pages/privacy'
import Terms from '@/pages/terms'

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock('@/components', () => ({
  Footer: () => null, NavHeader: () => null, MetaHeader: () => null,
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}))

it.each([
  [Privacy, 'Политика конфиденциальности', '/privacy', '6 August 2026'],
  [Terms, 'Условия использования', '/terms', '9 July 2026'],
])('renders the Russian legal translation with its upstream source notice', (Page, heading, path, date) => {
  const { container } = render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  expect(screen.getByText(/не являются юридическими документами, адаптированными для клиента/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Оригинал на английском' })).toHaveAttribute('href', path)
  expect(container).toHaveTextContent(date)
  expect(container).toHaveTextContent('Georgiy Mogelashvili')
  expect(container).toHaveTextContent('Netherlands')
})

it.each([[Privacy, 'Privacy Policy'], [Terms, 'Terms of Service']])('preserves standalone English without a translation notice', (Page, heading) => {
  render(<Page />)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  expect(screen.queryByText('Оригинал на английском')).not.toBeInTheDocument()
})
