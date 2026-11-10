import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { AdminSectionPage } from '@/components/admin-moderation/AdminSectionPage'

const mockRouter = { pathname: '/admin/vacancies', replace: jest.fn() }
let mockRole = 'admin'
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({
  useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: { role: mockRole, name: 'Alex' }, logout: jest.fn() }),
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))
beforeEach(() => { mockRole = 'admin' })

it('renders administrator navigation and role in Russian', () => {
  render(<I18nProvider locale="ru"><AdminLayout title="Менторы">Content</AdminLayout></I18nProvider>)
  expect(screen.getByRole('link', { name: 'На модерации' })).toHaveAttribute('href', '/admin/mentors/pending')
  expect(screen.getByRole('link', { name: 'Одобренные' })).toHaveAttribute('href', '/admin/mentors/approved')
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
  expect(screen.getByText('Администратор')).toBeInTheDocument()
})
it('retains moderator restrictions after Russian localization', () => {
  mockRole = 'moderator'
  render(<I18nProvider locale="ru"><AdminLayout title="Модерация">Content</AdminLayout></I18nProvider>)
  expect(screen.getByRole('link', { name: 'На модерации' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Аналитика' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Одобренные' })).not.toBeInTheDocument()
  expect(screen.getByText('Модератор')).toBeInTheDocument()
})
it.each([
  ['analytics', 'Analytics', 'Data sources are not connected yet'],
  ['vacancies', 'Vacancies', 'The vacancies catalog is not connected yet'],
  ['research', 'Research', 'The research catalog is not connected yet'],
] as const)('translates the %s section and honest empty state to English', (section, title, empty) => {
  render(<I18nProvider locale="en"><AdminSectionPage section={section} /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  expect(screen.getByText(empty)).toBeInTheDocument()
})
