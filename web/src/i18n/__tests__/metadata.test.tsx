/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '@/i18n'
import MetaHeader from '@/components/layout/MetaHeader'

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('next/compat/router', () => ({ useRouter: () => ({ locale: 'ru', asPath: '/mentors?sort=name#list' }) }))

it('renders Russian SEO with locale-aware canonical and reciprocal alternates', () => {
  const html = renderToStaticMarkup(<I18nProvider locale="ru"><MetaHeader /></I18nProvider>)
  expect(html).toContain('content="ru_RU"')
  expect(html).toContain('открытое сообщество IT-менторов')
  expect(html).toContain('hrefLang="ru"')
  expect(html).toContain('hrefLang="en"')
  expect(html).not.toContain('?sort=')
})
it('does not advertise private pages as public language alternates', () => {
  const html = renderToStaticMarkup(<I18nProvider locale="ru"><MetaHeader noIndex /></I18nProvider>)
  expect(html).toContain('noindex,follow')
  expect(html).not.toContain('hrefLang=')
})
