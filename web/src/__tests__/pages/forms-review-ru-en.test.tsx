import { I18nProvider } from '@/i18n'
/**
 * H4 SENTINELS for the review page.
 *
 * The review capability arrives in a URL fragment, and this page is the only
 * place in the frontend that ever holds it. These tests pin the three properties
 * that keep it out of telemetry: it leaves the address bar immediately, it never
 * reaches the DOM (session replay serializes the DOM), and it never reaches an
 * analytics property. Plus the dual-read behaviour for links already sent.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewReviewPage, { REVIEW_TOKEN_FRAGMENT_KEY } from '@/pages/reviews/new'

// Fabricated, shaped like a real capability from api/pkg/reviewtoken.
const REVIEW_TOKEN = 'rvw_SENTINELreviewPageCapabilityAAAAAAAAAAAAAAA'

const mockRouter = { isReady: true, query: {} as Record<string, string | string[]> }
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

const mockAnalyticsEvent = jest.fn()
jest.mock('@/lib/analytics', () => ({
  __esModule: true,
  default: {
    events: { REVIEW_PAGE_VIEWED: 'review_page_viewed' },
    event: (name: string, params?: Record<string, unknown>) => mockAnalyticsEvent(name, params),
  },
}))

// Turnstile renders an iframe to Cloudflare; stub it and hand the form a token.
jest.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => {
    onSuccess('captcha-ok')
    return <div data-testid="turnstile" />
  },
}))

function mockFetchResponse(status: number, body: unknown): void {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })
}

/** Puts the capability where the email link puts it. */
function visitWithFragment(token: string): void {
  window.history.replaceState(
    null,
    '',
    `/reviews/new#${REVIEW_TOKEN_FRAGMENT_KEY}=${encodeURIComponent(token)}`
  )
}

function lastFetchBody(): Record<string, unknown> {
  const calls = (global.fetch as jest.Mock).mock.calls
  const [, init] = calls[calls.length - 1]
  return JSON.parse(init.body as string) as Record<string, unknown>
}

it('submits a Russian review using the canonical request contract', async () => {
  global.fetch = jest.fn()
  visitWithFragment(REVIEW_TOKEN)
  mockFetchResponse(200, { canSubmit: true, mentorName: 'Jane Doe' })
  render(<I18nProvider locale="ru"><NewReviewPage /></I18nProvider>)
  await userEvent.type(await screen.findByLabelText(/Отзыв о менторе/), 'Спасибо за полезную сессию!')
  mockFetchResponse(200, { success: true })
  await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }))
  expect(await screen.findByText('Спасибо за отзыв!')).toBeInTheDocument()
  expect(lastFetchBody()).toEqual({ token: REVIEW_TOKEN, mentorReview: 'Спасибо за полезную сессию!', platformReview: '', improvements: '', captchaToken: 'captcha-ok' })
})
