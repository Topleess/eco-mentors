import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Mentor from '@/pages/mentor/[slug]'
import type { MentorBase } from '@/types'

jest.mock('@/components', () => ({
  NavHeader: () => null, Footer: () => null, MetaHeader: () => null,
  HtmlContent: ({ content }: { content: string }) => <div>{content}</div>,
}))
jest.mock('@/components/ui/MentorPortrait', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn(), events: {} } }))

const mentor: MentorBase = {
  id: 7, mentorId: 'test-id', slug: 'original-slug', name: 'Original Name', job: 'Engineer', workplace: 'Company',
  description: 'Original help', about: 'Original about', competencies: 'Original skills', experience: '5', price: '$100',
  tags: ['Backend'], menteeCount: 21, sessionsCount: 2, legacySessionsCount: 1, photo_url: null, sortOrder: 1,
  isVisible: true, isNew: false, calendarType: 'none',
}

it('localizes Russian profile availability and session plurals, preserving user content and links', () => {
  render(<I18nProvider locale="ru"><Mentor mentor={mentor} canonicalUrl="https://openmentor.io/mentor/original-slug" ogImageUrl="https://openmentor.io/api/og/mentor?slug=original-slug" /></I18nProvider>)
  expect(screen.getAllByText('2 встречи')).toHaveLength(2)
  expect(screen.getAllByText('Принимает запросы')).toHaveLength(2)
  expect(screen.getAllByText('в т. ч. 1 на getmentor.dev')).toHaveLength(2)
  expect(screen.getByText('Original about')).toBeInTheDocument()
  expect(screen.getByRole('link', {name:'Бэкенд'})).toHaveAttribute('href', '/mentors/backend')
  expect(screen.getAllByRole('link', {name:'Отправить запрос'})[0]).toHaveAttribute('href', '/mentor/original-slug/contact')
})
