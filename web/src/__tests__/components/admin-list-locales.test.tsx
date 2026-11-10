import { fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { MentorModerationListPage } from '@/components/admin-moderation/MentorModerationListPage'
import { getModerationMentors } from '@/lib/admin-moderation-api'

const mockRouter = { pathname: '/admin/mentors/pending', replace: jest.fn() }
const mockSession = { role: 'admin', name: 'Admin' }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({ useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: mockSession, logout: jest.fn() }) }))
jest.mock('@/lib/admin-moderation-api', () => ({ getModerationMentors: jest.fn() }))

it('localizes list status/prices/search while keeping canonical filters and retaining search on locale change', async () => {
  jest.mocked(getModerationMentors).mockResolvedValue([
    { mentorId: 'b0000000-0000-4000-8000-000000000002', id: 2, name: 'Анна', email: 'anna@example.test', contact: '@anna', job: 'Developer', workplace: 'Local', price: 'Free', status: 'pending', createdAt: '2026-10-19T10:00:00Z' },
  ])
  const view = render(<I18nProvider locale="ru"><MentorModerationListPage status="pending" title="Менторы" /></I18nProvider>)
  const card = await screen.findByRole('link', { name: /Анна/ })
  expect(within(card).getByText('На модерации')).toBeInTheDocument()
  expect(within(card).getByText('Бесплатно')).toBeInTheDocument()
  const search = screen.getByPlaceholderText('Поиск по имени, почте или контакту')
  fireEvent.change(search, { target: { value: 'Анна' } })
  view.rerender(<I18nProvider locale="en"><MentorModerationListPage status="pending" title="Mentors" /></I18nProvider>)
  expect(screen.getByPlaceholderText('Search by name, email, contact')).toHaveValue('Анна')
  expect(jest.mocked(getModerationMentors)).toHaveBeenCalledTimes(1)
  expect(jest.mocked(getModerationMentors)).toHaveBeenCalledWith('pending')
  expect(within(screen.getByRole('link', { name: /Анна/ })).getByText('pending')).toBeInTheDocument()
})
