import { I18nProvider } from '@/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Migrate from '@/pages/migrate'

// Mock Turnstile component (forwardRef so the widget's reset() is callable)
const mockTurnstileReset = jest.fn()
let freshTokenSeq = 0
jest.mock('@marsidev/react-turnstile', () => {
  const react = jest.requireActual('react')
  return {
    __esModule: true,
    Turnstile: react.forwardRef(function MockTurnstile(
      { onSuccess }: { onSuccess?: (token: string) => void },
      ref: React.Ref<{ reset: () => void }>
    ) {
      react.useImperativeHandle(ref, () => ({
        reset: () => {
          mockTurnstileReset()
          // The real widget re-solves the challenge asynchronously. Issuing the
          // token synchronously here would have it wiped by the
          // setCaptchaToken('') that follows reset() in the page's effect.
          freshTokenSeq += 1
          const token = `fresh-turnstile-token-${freshTokenSeq}`
          setTimeout(() => onSuccess?.(token), 0)
        },
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

// Keep the page test focused: layout chrome is covered elsewhere
jest.mock('@/components', () => ({
  __esModule: true,
  NavHeader: () => <div data-testid="nav-header" />,
  Footer: () => <div data-testid="footer" />,
  MetaHeader: () => null,
  Section: Object.assign(
    ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
    { Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2> }
  ),
}))

const mockRouter = { isReady: true, query: {} as Record<string, string | string[]> }
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

it('schedules migration in Russian with canonical payload', async () => {
  mockRouter.query = { slug: 'Ivan-Petrov-42' }
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  render(<I18nProvider locale="ru"><Migrate /></I18nProvider>)
  await userEvent.click(screen.getByTestId('turnstile'))
  await userEvent.click(screen.getByRole('button', { name: 'Запланировать перенос' }))
  expect(await screen.findByText('🎉 Вы в списке!')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith('/api/schedule-migration', expect.objectContaining({ body: JSON.stringify({ slug: 'ivan-petrov-42', captchaToken: 'mock-turnstile-token' }) }))
})
