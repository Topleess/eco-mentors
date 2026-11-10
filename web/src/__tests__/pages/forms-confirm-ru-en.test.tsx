import { I18nProvider } from '@/i18n'
import { render, screen } from '@testing-library/react'
import ConfirmMentorEmail from '@/pages/mentor/confirm'

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

function mockFetchResponse(status: number, body: unknown): void {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })
}

it('confirms in Russian with the unchanged token payload', async () => {
  mockRouter.query = { token: 'mcf_test' }
  global.fetch = jest.fn()
  mockFetchResponse(200, { success: true })
  render(<I18nProvider locale="ru"><ConfirmMentorEmail /></I18nProvider>)
  expect(await screen.findByText('🎉 Профиль отправлен на проверку — мы напишем вам')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith('/api/mentor/confirm', expect.objectContaining({ body: JSON.stringify({ token: 'mcf_test' }) }))
})
