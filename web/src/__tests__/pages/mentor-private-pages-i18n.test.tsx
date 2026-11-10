import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import MentorLoginPage from '@/pages/mentor/login'
import MentorIndexPage from '@/pages/mentor'
import MentorPastRequestsPage from '@/pages/mentor/past'
import MentorProfileEditPage from '@/pages/mentor/profile/edit'
import RequestDetailsPage from '@/pages/mentor/requests/[id]'
import MentorAuthCallbackPage from '@/pages/mentor/auth/callback'
import { getActiveRequests, getPastRequests, getRequestById } from '@/lib/mentor-admin-api'

const mockRequestLogin = jest.fn()
const mockVerifyLogin = jest.fn()
const mockRouter = { query: {}, isReady: true, replace: jest.fn(), pathname: '/mentor', push: jest.fn() }
let mockAuthenticated = false
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn(), events: {} } }))
jest.mock('@/lib/posthog', () => ({ captureException: jest.fn() }))
jest.mock('@/lib/mentor-admin-api', () => ({ getActiveRequests: jest.fn(), getPastRequests: jest.fn(), getRequestById: jest.fn() }))
jest.mock('@/components/mentor-admin', () => ({
  MentorAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useMentorAuth: () => ({ isAuthenticated: mockAuthenticated, isLoading: false, session: { name: 'Ada' }, requestLogin: mockRequestLogin, verifyLogin: mockVerifyLogin }),
  MentorAdminLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => <div><h1>{title}</h1>{children}</div>,
  RequestListSkeleton: () => null,
}))
jest.mock('@/components', () => ({
  NoIndexHead: () => null,
  AuthGateScreen: () => null,
}))

afterEach(() => { jest.clearAllMocks(); mockAuthenticated = false; mockRouter.query = {} })

it('renders Russian login validation and sent-link state without changing submitted email', async () => {
  mockRequestLogin.mockResolvedValue({ success: true })
  render(<I18nProvider locale="ru"><MentorLoginPage /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Получить ссылку для входа' }))
  expect(await screen.findByText('Введите электронную почту')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'mentor@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Получить ссылку для входа' }))
  expect(await screen.findByText('Проверьте почту')).toBeInTheDocument()
  expect(mockRequestLogin).toHaveBeenCalledWith('mentor@example.com')
})

it('renders Russian private inbox and archive empty states', async () => {
  mockAuthenticated = true
  jest.mocked(getActiveRequests).mockResolvedValue([])
  jest.mocked(getPastRequests).mockResolvedValue([])
  const { unmount } = render(<I18nProvider locale="ru"><MentorIndexPage /></I18nProvider>)
  expect(await screen.findByText('Заявок пока нет')).toBeInTheDocument()
  unmount()
  render(<I18nProvider locale="ru"><MentorPastRequestsPage /></I18nProvider>)
  expect(await screen.findByText('Архив пуст')).toBeInTheDocument()
})

it('localizes profile and request loading errors from the API', async () => {
  mockAuthenticated = true
  global.fetch = jest.fn().mockResolvedValue({ ok: false })
  const { unmount } = render(<I18nProvider locale="ru"><MentorProfileEditPage /></I18nProvider>)
  expect(await screen.findByText('Не удалось загрузить профиль')).toBeInTheDocument()
  unmount()
  mockRouter.query = { id: 'request-fixture' }
  jest.mocked(getRequestById).mockRejectedValue(new Error('Failed to load the request'))
  render(<I18nProvider locale="ru"><RequestDetailsPage /></I18nProvider>)
  expect(await screen.findByText('Не удалось загрузить заявку')).toBeInTheDocument()
})

it('localizes callback API failures without changing the verification token', async () => {
  mockRouter.query = { token: 'test-token' }
  mockVerifyLogin.mockResolvedValue({ success: false, message: 'The link is invalid or has expired' })
  render(<I18nProvider locale="ru"><MentorAuthCallbackPage /></I18nProvider>)
  await waitFor(() => expect(mockVerifyLogin).toHaveBeenCalledWith('test-token'))
  expect(await screen.findByText('Ссылка недействительна или срок её действия истёк')).toBeInTheDocument()
})
