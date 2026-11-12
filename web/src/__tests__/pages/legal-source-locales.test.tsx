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
  [Privacy, 'Политика конфиденциальности'],
  [Terms, 'Условия использования'],
])('renders Russian legal content without upstream operator claims or implementation notes', (Page, heading) => {
  const { container } = render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  expect(container).toHaveTextContent('Менторы ЭкоКарьеры')
  expect(container).not.toHaveTextContent(/Georgiy|Netherlands|openmentor|адаптированными для клиента|исходного проекта/i)
  expect(container.querySelector('a[href*="openmentor.io"]')).toBeNull()
  expect(screen.queryByText('Оригинал на английском')).not.toBeInTheDocument()
})

it.each([[Privacy, 'Privacy Policy'], [Terms, 'Terms of Service']])('preserves standalone English without stale operator claims', (Page, heading) => {
  const { container } = render(<Page />)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  expect(container).not.toHaveTextContent(/Georgiy|Netherlands|openmentor|not legal documents adapted for a client/i)
})
