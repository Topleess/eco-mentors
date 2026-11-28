import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Footer from '@/components/layout/Footer'

jest.mock('@/components', () => ({
  NavHeader: () => <header />,
  Footer: () => <footer />,
  MetaHeader: () => null,
}))

describe.each(['ru', 'en'] as const)('feedback (%s)', (locale) => {
  it('offers an honest direct email contact', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Feedback = require('@/pages/feedback').default
    render(<I18nProvider locale={locale}><Feedback /></I18nProvider>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(locale === 'ru' ? 'Обратная связь' : 'Feedback')
    expect(screen.getByRole('link', { name: 'ecocareerguide@yandex.ru' })).toHaveAttribute('href', 'mailto:ecocareerguide@yandex.ru')
    expect(screen.getByText(locale === 'ru' ? /откроется почтовое приложение/i : /opens your email app/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /отправить|submit/i })).not.toBeInTheDocument()
  })

  it('links to feedback from the footer', () => {
    render(<I18nProvider locale={locale}><Footer /></I18nProvider>)
    expect(screen.getByRole('link', { name: locale === 'ru' ? 'Обратная связь' : 'Feedback' })).toHaveAttribute('href', '/feedback')
  })
})
