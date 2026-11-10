import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Page from '@/pages/admin/vacancies'
import { vacancyFixtures } from '@/features/vacancies/fixtures'
import { loadAdminVacancies } from '@/features/vacancies/api'
jest.mock('@/features/vacancies/api', () => ({ loadAdminVacancies: jest.fn() }))

const mockRouter = { pathname: '/admin/vacancies', replace: jest.fn() }
let mockAuth = { isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Admin' } }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({ useAdminAuth: () => mockAuth, AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/components/layout/NoIndexHead', () => ({ __esModule: true, default: ({ title }: { title: string }) => <span data-testid="noindex">{title}</span> }))

beforeEach(() => {
  mockRouter.replace.mockReset()
  ;(loadAdminVacancies as jest.Mock).mockReset().mockResolvedValue(vacancyFixtures)
  mockAuth = { isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Admin' } }
})

it('loads all statuses from the API and links to a working editor and dictionaries', async () => {
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(await screen.findByRole('table', { name: 'Вакансии' })).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(12)
  expect(screen.getByText('Аналитик возобновляемой энергетики')).toBeInTheDocument()
  expect(screen.getByTestId('noindex')).toHaveTextContent('Вакансии')
  expect(loadAdminVacancies).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Новая вакансия' })).toHaveAttribute('href', '/admin/vacancies/new')
  expect(screen.queryByRole('link', { name: 'Отрасли и города' })).not.toBeInTheDocument()
})

it('filters administrative statuses with no public links for unpublished entries', async () => {
  const user = userEvent.setup()
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  await screen.findByRole('table')
  await user.selectOptions(screen.getByLabelText('Статус'), 'draft')
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.getByRole('status')).toHaveTextContent('Найдено: 2')
  expect(screen.getByRole('link', { name: 'Аналитик возобновляемой энергетики' })).toHaveAttribute('href', '/admin/vacancies/demo-vacancy-10')
  expect(screen.queryByRole('link', { name: 'Открыть публичную страницу' })).not.toBeInTheDocument()
  await user.type(screen.getByRole('searchbox'), 'москва')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await user.type(screen.getByRole('searchbox'), 'несуществующая')
  expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
  expect(await screen.findByRole('table', { name: 'Вакансии' })).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(12)
  expect(screen.getByRole('link', { name: 'Эколог-консультант' })).toHaveAttribute('href', '/admin/vacancies/demo-vacancy-01')
})

it('translates administrator controls into English', async () => {
  render(<I18nProvider locale="en"><Page /></I18nProvider>)
  expect(screen.getByLabelText('Status')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New vacancy' })).toBeInTheDocument()
  await screen.findByRole('table')
})

it.each(['anonymous', 'moderator', 'loading'])('does not expose records to %s', async kind => {
  mockAuth.isAuthenticated = kind !== 'anonymous'
  mockAuth.isLoading = kind === 'loading'
  mockAuth.session.role = kind === 'moderator' ? 'moderator' : 'admin'
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(loadAdminVacancies).not.toHaveBeenCalled()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
  expect(screen.getByTestId('noindex')).toBeInTheDocument()
  if (kind === 'loading') expect(mockRouter.replace).not.toHaveBeenCalled()
  else await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(kind === 'anonymous' ? '/admin/login' : '/admin/mentors/pending'))
})
