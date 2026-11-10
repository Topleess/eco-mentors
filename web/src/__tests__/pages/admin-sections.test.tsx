import { render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Analytics from '@/pages/admin/analytics'
import Vacancies from '@/pages/admin/vacancies'
import Research from '@/pages/admin/research'

jest.mock('@/features/vacancies/api', () => ({ loadAdminVacancies: jest.fn().mockResolvedValue([]) }))
jest.mock('@/features/research/api', () => ({ loadResearchList: jest.fn().mockResolvedValue([]) }))
const mockRouter = { pathname: '/admin/analytics', replace: jest.fn() }
let mockAuth = { isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Test admin' } }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({
  useAdminAuth: () => mockAuth,
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/layout/NoIndexHead', () => ({ __esModule: true, default: () => null }))

beforeEach(() => {
  mockRouter.replace.mockReset()
  global.fetch = jest.fn(async (url: RequestInfo | URL) => ({ ok: String(url).includes('/traffic?'), json: async () => ({ status: 'not_configured' }) })) as jest.Mock
  mockAuth = { isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Test admin' } }
})

it.each([
  [Analytics, 'Аналитика', 'Umami не подключён'],
  [Vacancies, 'Вакансии', 'Ничего не найдено'],
  [Research, 'Исследования', 'Исследований не найдено'],
])('renders a distinct honest empty state for %s', async (Page, title, empty) => {
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  expect(await screen.findByText(empty)).toBeInTheDocument()
})

it.each([Analytics, Vacancies, Research])('redirects unauthenticated visitors', async (Page) => {
  mockAuth.isAuthenticated = false
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin/login'))
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
})

it.each([Analytics, Vacancies, Research])('prevents moderators from rendering administrator content', async (Page) => {
  mockAuth.session.role = 'moderator'
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin/mentors/pending'))
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
})

it('waits for authentication before rendering or redirecting', () => {
  mockAuth.isLoading = true
  render(<I18nProvider locale="ru"><Analytics /></I18nProvider>)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
  expect(mockRouter.replace).not.toHaveBeenCalled()
})
