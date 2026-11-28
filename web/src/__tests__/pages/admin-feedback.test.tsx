import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'

const mockReplace = jest.fn()
const mockRouter = { replace: mockReplace, pathname: '/admin/feedback' }
let mockRole: 'admin' | 'moderator' | null
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/layout/LanguageSwitcher', () => () => null)
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminAuth: () => ({ isAuthenticated: Boolean(mockRole), isLoading: false, session: { role: mockRole }, logout: jest.fn() }),
}))

const originalFetch = global.fetch
const renderInbox = async (): Promise<void> => {
  const { default: Inbox } = await import('@/pages/admin/feedback')
  render(<I18nProvider locale="ru"><Inbox /></I18nProvider>)
}
beforeEach(() => { mockReplace.mockClear(); mockRole = 'admin' })
afterEach(() => { global.fetch = originalFetch })

test('reads the private list with category, optional contact and pagination', async () => {
  const f = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'a', category: 'suggestion', message: 'Нужен фильтр', email: null, createdAt: '2026-11-28T12:15:00Z' }], hasMore: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'b', category: 'question', message: '<b>Не разметка</b>', email: 'qa@example.test', createdAt: '2026-11-27T12:15:00Z' }], hasMore: false }) })
  global.fetch = f
  await renderInbox()
  expect(screen.getByRole('link', { name: 'Обратная связь' })).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByText('Нужен фильтр')).toBeVisible()
  expect(screen.getByText('Предложение')).toBeVisible()
  expect(screen.queryByText(/example\.test/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
  expect(await screen.findByText('<b>Не разметка</b>')).toBeVisible()
  expect(screen.getByText('qa@example.test')).toBeVisible()
  expect(f.mock.calls.map(([url]) => url)).toEqual(['/api/admin/feedback?offset=0', '/api/admin/feedback?offset=25'])
})

test('does not fetch messages for a moderator', async () => {
  const fetchMock = jest.fn()
  global.fetch = fetchMock
  mockRole = 'moderator'
  await renderInbox()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/mentors/pending'))
  expect(fetchMock).not.toHaveBeenCalled()
})
