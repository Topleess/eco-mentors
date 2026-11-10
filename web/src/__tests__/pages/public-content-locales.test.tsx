import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import About from '@/pages/about'
import Donate from '@/pages/donate'
import Faq from '@/pages/faq'
import NotFound from '@/pages/404'
import Directory from '@/pages/mentors'
import TagPage from '@/pages/mentors/[tag]'

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock('@/components', () => ({
  Footer: () => null, NavHeader: () => null, MetaHeader: () => null,
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  MentorsList: () => null,
}))
jest.mock('@/server/mentors-data', () => ({ getAllMentors: jest.fn() }))
jest.mock('@/lib/with-ssr-observability', () => ({ withSSRObservability: (fn: unknown) => fn }))
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { info: jest.fn() }, getTraceContext: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn(), events: {} } }))

it.each([
  [<About key="about" />, 'Люди помогают людям расти'],
  [<Donate key="donate" />, 'Сохраним менторство бесплатным для всех'],
  [<Faq key="faq" />, 'Часто задаваемые вопросы'],
  [<NotFound key="404" />, 'Страница не найдена'],
  [<Directory key="directory" mentors={[]} />, 'Все менторы'],
  [<TagPage key="tag" tag="Backend" mentors={[]} />, 'Менторы: Бэкенд'],
])('localizes public page headings with the Russian provider', (page, heading) => {
  render(<I18nProvider locale="ru">{page}</I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})

it('uses translated FAQ answers in JSON-LD and preserves question anchors', () => {
  const { container } = render(<I18nProvider locale="ru"><Faq /></I18nProvider>)
  const script = container.querySelector('script[type="application/ld+json"]')
  if (!script?.textContent) throw new Error('Missing FAQ JSON-LD')
  const schema = JSON.parse(script.textContent)
  expect(schema.inLanguage).toBe('ru')
  expect(schema.mainEntity[0].name).toBe('Как найти ментора и связаться с ним?')
  expect(schema.mainEntity[0].acceptedAnswer.text).toContain('каталог')
  expect(screen.getByRole('link', { name: 'Как найти ментора и связаться с ним?' })).toHaveAttribute('href', '#find-a-mentor')
})

it('keeps original English public content and mentor data unchanged', () => {
  render(<I18nProvider locale="en"><Directory mentors={[{id:1, slug:'unchanged', name:'Имя Mentor', job:'Engineer', workplace:'Company'}]} /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: 'All mentors' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Имя Mentor Engineer · Company' })).toHaveAttribute('href', '/mentor/unchanged')
})
