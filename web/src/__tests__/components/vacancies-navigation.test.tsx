import { fireEvent, render, screen } from '@testing-library/react'
import NavHeader from '@/components/layout/NavHeader'
import { I18nProvider } from '@/i18n'

jest.mock('@/components/layout/LanguageSwitcher', () => ({ __esModule: true, default: () => null }))

it.each([['ru', 'Вакансии', 'Открыть меню'], ['en', 'Vacancies', 'Open menu']] as const)('exposes vacancies in desktop and mobile navigation for %s', (locale, label, menu) => {
  render(<I18nProvider locale={locale}><NavHeader /></I18nProvider>)
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/vacancies')
  fireEvent.click(screen.getByRole('button', { name: menu }))
  expect(screen.getAllByRole('link', { name: label })).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('link', { name: label })[1])
  expect(screen.getAllByRole('link', { name: label })).toHaveLength(1)
})
