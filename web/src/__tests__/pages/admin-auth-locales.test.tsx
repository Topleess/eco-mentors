import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Login from '@/pages/admin/login'
import Callback from '@/pages/admin/auth/callback'

const mockRouter = { pathname: '/admin/login', query: { expired: 'true' }, isReady: false, replace: jest.fn() }
const mockRequestLogin = jest.fn().mockResolvedValue({ success: true })
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation', () => ({
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAdminAuth: () => ({ isAuthenticated: false, isLoading: false, requestLogin: mockRequestLogin, verifyLogin: jest.fn() }),
}))
it('renders Russian moderation login and validates email without changing submitted data', async () => {
  render(<I18nProvider locale="ru"><Login /></I18nProvider>)
  expect(screen.getByText('Срок действия сессии истёк. Войдите снова.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Получить ссылку для входа' }))
  expect(await screen.findByText('Введите электронную почту')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'moderator@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Получить ссылку для входа' }))
  expect(await screen.findByRole('heading', { name: 'Проверьте почту' })).toBeInTheDocument()
  expect(mockRequestLogin).toHaveBeenCalledWith('moderator@example.test')
})
it('localizes callback waiting state without running token verification early', () => {
  render(<I18nProvider locale="ru"><Callback /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Проверяем ссылку…' })).toBeInTheDocument()
})
