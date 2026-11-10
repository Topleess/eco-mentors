import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import NavHeader from '@/components/layout/NavHeader'
import CookieConsentBanner from '@/components/ui/CookieConsentBanner'
import PriceBadge from '@/components/ui/PriceBadge'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

const replace = jest.fn().mockResolvedValue(true)
jest.mock('next/compat/router', () => ({ useRouter: () => ({ pathname: '/mentor/[slug]', asPath: '/mentor/alex?tab=details#about', query: { slug: 'alex', tab: 'details' }, locale: 'ru', replace }) }))

describe('localized shared UI', () => {
  beforeEach(() => { localStorage.clear(); replace.mockClear() })
  it('renders Russian navigation and display prices', () => {
    render(<I18nProvider locale="ru"><NavHeader /><PriceBadge price="Free" /></I18nProvider>)
    expect(screen.getAllByText('Стать ментором').length).toBeGreaterThan(0)
    expect(screen.getByText('Бесплатно')).toBeInTheDocument()
  })
  it('renders cookie consent in Russian', () => {
    render(<I18nProvider locale="ru"><CookieConsentBanner /></I18nProvider>)
    expect(screen.getByRole('button', { name: 'Принять' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отклонить' })).toBeInTheDocument()
  })
  it('switches language shallowly while preserving dynamic query/hash and stores preference', async () => {
    render(<I18nProvider locale="ru"><LanguageSwitcher /></I18nProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
    expect(replace).toHaveBeenCalledWith({ pathname: '/mentor/[slug]', query: { slug: 'alex', tab: 'details' } }, '/mentor/alex?tab=details#about', { locale: 'en', shallow: true, scroll: false })
    await waitFor(() => expect(document.cookie).toContain('NEXT_LOCALE=en'))
  })
})
