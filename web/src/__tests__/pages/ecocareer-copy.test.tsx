import { render } from '@testing-library/react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { I18nProvider } from '@/i18n'
import { messages } from '@/i18n/messages/public-pages'
import { messages as formMessages } from '@/i18n/messages/forms'
import About from '@/pages/about'
import Faq from '@/pages/faq'
import { getServerSideProps } from '@/pages/donate'
import type { GetServerSidePropsContext } from 'next'

jest.mock('next/head', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components', () => ({
  Footer: () => null, NavHeader: () => null, MetaHeader: () => null,
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

it('preserves the approved Russian headline, description and journey', () => {
  expect(messages.heroHeadline.ru).toBe('Расти с теми, кто в теме')
  expect(messages.heroDescription.ru).toBe('Открытое сообщество менторов для передачи опыта, развития навыков и профессионального роста.')
  expect([messages.browseFreely.ru, messages.sendARequest.ru, messages.meetGrow.ru]).toEqual([
    'Выберите ментора', 'Отправьте запрос', 'Договоритесь о встрече',
  ])
  expect(formMessages.skillsHint.ru).toContain('ОВОС, экологическая отчётность, углеродный учёт, РОП, QGIS')
})

it.each(['ru', 'en'] as const)('removes funding, migration and upstream contact marketing in %s', (locale) => {
  const { container } = render(<I18nProvider locale={locale}><About /><Faq /></I18nProvider>)
  expect(container.textContent).not.toMatch(/ko-fi|donation|пожертвован|Kubernetes|hello@|getmentor|usually within|в течение пары дней/i)
  expect(container.textContent).toContain('OpenMentor')
  expect(container.textContent).toContain('AGPL-3.0')
  expect(container.querySelector('a[href="/donate"]')).toBeNull()
  expect(container.querySelector('a[href="/migrate"]')).toBeNull()
})

it('does not render a donation destination on the home page', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/index.tsx'), 'utf8')
  expect(source).not.toMatch(/href="\/donate"|donationFunded|data-section="support"/)
})

it('redirects legacy donation URLs without exposing upstream payment links', async () => {
  await expect(getServerSideProps({} as GetServerSidePropsContext)).resolves.toEqual({
    redirect: { destination: '/about', permanent: false },
  })
})
