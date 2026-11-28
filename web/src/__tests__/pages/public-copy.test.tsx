import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import About from '@/pages/about'
import Faq from '@/pages/faq'
import Home from '@/pages/index'

jest.mock('@/components', () => ({
  ...jest.requireActual('@/components'),
  Footer: () => null,
  NavHeader: () => null,
  MetaHeader: () => null,
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

describe.each(['ru', 'en'] as const)('public copy (%s)', (locale) => {
  it('presents free meetings without commission or paid-session copy', () => {
    const { container } = render(<I18nProvider locale={locale}><Home pageMentors={[]} /><Faq /></I18nProvider>)
    const text = container.textContent || ''
    expect(text).not.toMatch(/комисси|(?<!бес)платн|оплат|commission|paid|payment/i)
    expect(text).toMatch(locale === 'ru' ? /Бесплатные встречи/ : /Free sessions/i)
    expect(text).toMatch(locale === 'ru' ? /Без регистрации/ : /No account needed/i)
  })

  it('links to the EcoCareer Laboratory materials', () => {
    render(<I18nProvider locale={locale}><About /></I18nProvider>)
    expect(screen.getByText(locale === 'ru' ? 'Eco Mentors — часть Лаборатории ЭкоКарьеры.' : 'Eco Mentors is part of the EcoCareer Laboratory.')).toBeInTheDocument()
    for (const href of ['https://t.me/EcoCartaMsk', 'https://ecocareerguide.ru/', 'https://rutube.ru/video/e1b2aea3244dca0f496f12531c4cab7c/']) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeInTheDocument()
    }
  })
})
