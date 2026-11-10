import { I18nProvider } from '@/i18n'
import { render, screen } from '@testing-library/react'
import OrderMentor from '@/pages/mentor/[slug]/contact'
import type { MentorBase } from '@/types'

jest.mock('@marsidev/react-turnstile', () => {
  const react = jest.requireActual('react')
  return {
    __esModule: true,
    Turnstile: react.forwardRef(function MockTurnstile(
      { onSuccess }: { onSuccess?: (token: string) => void },
      ref: React.Ref<{ reset: () => void }>
    ) {
      react.useImperativeHandle(ref, () => ({
        reset: () => setTimeout(() => onSuccess?.('fresh-turnstile-token'), 0),
      }))
      return (
        <button
          type="button"
          data-testid="turnstile"
          onClick={() => onSuccess?.('mock-turnstile-token')}
        >
          Complete Turnstile
        </button>
      )
    }),
  }
})

// Chrome is stubbed, but the contact form itself is the real component: what is
// under test is whether the upstream reason survives all the way to the panel.
jest.mock('@/components', () => ({
  __esModule: true,
  ...(jest.requireActual('@/components') as Record<string, unknown>),
  NavHeader: () => <div />,
  Footer: () => <div />,
  NoIndexHead: () => null,
  Koalendar: () => <div />,
  CalendlabWidget: () => <div />,
}))

jest.mock('react-calendly', () => ({
  __esModule: true,
  InlineWidget: () => <div data-testid="calendly" />,
}))

jest.mock('@/lib/analytics', () => ({
  __esModule: true,
  default: {
    event: jest.fn(),
    events: {
      MENTOR_CONTACT_PAGE_VIEWED: 'mentor_contact_page_viewed',
      MENTEE_CONTACT_SUBMITTED: 'mentee_contact_submitted',
    },
  },
}))

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  captureException: jest.fn(),
}))

const mentor: MentorBase = {
  id: 7,
  mentorId: '550e8400-e29b-41d4-a716-446655440000',
  slug: 'ivan-petrov-7',
  name: 'Ivan Petrov',
  job: 'Staff Engineer',
  workplace: 'Tech Corp',
  description: null,
  about: null,
  competencies: 'Go, PostgreSQL',
  experience: '10+',
  price: '$100',
  tags: ['Backend'],
  menteeCount: 38,
  photo_url: null,
  sortOrder: 1,
  isVisible: true,
  isNew: false,
  calendarType: 'none',
}

it('shows the existing read-only demo notice in Russian', () => {
  render(<I18nProvider locale="ru"><OrderMentor mentor={mentor} demoReadOnly /></I18nProvider>)
  expect(screen.getByText(/Это демо доступно только для просмотра/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Посмотреть демо ментора' })).toHaveAttribute('href', '/demo-login')
})

it('translates the mobile recap price without changing the canonical mentor data', () => {
  render(<I18nProvider locale="ru"><OrderMentor mentor={{ ...mentor, price: 'Free' }} demoReadOnly={false} /></I18nProvider>)
  expect(screen.queryByText(/· Free/)).not.toBeInTheDocument()
  expect(screen.getByText(/· Бесплатно/)).toBeInTheDocument()
})
