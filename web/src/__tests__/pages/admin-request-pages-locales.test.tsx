import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import List from '@/pages/admin/mentors/[id]/requests'
import Details from '@/pages/admin/mentors/[id]/requests/[requestId]'
import * as api from '@/lib/admin-moderation-api'

const mockRouter = { query: { id: 'mentor-id', requestId: 'request-id' }, replace: jest.fn() }
const mockSession = { role: 'admin' }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation', () => ({
  AdminAuthProvider: ({ children }: { children: ReactNode }) => children,
  AdminLayout: ({ children, title }: { children: ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
  useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: mockSession }),
}))
jest.mock('@/components', () => ({ AuthGateScreen: ({ title }: { title: string }) => <div>{title}</div>, NoIndexHead: () => null }))
jest.mock('@/lib/admin-moderation-api')
const request = { id: 'request-id', name: 'Original name', email: 'test@example.test', contact: '@original', details: 'Original message', level: 'Original level', status: 'pending', createdAt: '2026-07-01T10:00:00Z', modifiedAt: '2026-07-02T10:00:00Z', statusChangedAt: null, review: 'Original review', declineReason: null, declineComment: null }
beforeEach(() => {
  jest.clearAllMocks()
  mockSession.role = 'admin'
  jest.mocked(api.getModerationMentorById).mockResolvedValue({ name: 'Original mentor', email: 'mentor@example.test' } as Awaited<ReturnType<typeof api.getModerationMentorById>>)
  jest.mocked(api.getModerationMentorRequests).mockResolvedValue([request] as unknown as Awaited<ReturnType<typeof api.getModerationMentorRequests>>)
  jest.mocked(api.getModerationMentorRequest).mockResolvedValue(request as unknown as Awaited<ReturnType<typeof api.getModerationMentorRequest>>)
})
it('localizes request list and switches locale without fetching or discarding search', async () => {
  const view = render(<I18nProvider locale="ru"><List /></I18nProvider>)
  expect(await screen.findByRole('heading', { name: 'Заявки ментора' })).toBeInTheDocument()
  const search = await screen.findByPlaceholderText('Поиск по имени, почте, контакту, сообщению')
  expect(screen.getByText('Original message')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Фильтр по статусу' })).toBeInTheDocument()
  fireEvent.change(search, { target: { value: 'missing' } })
  expect(screen.getByText('Нет заявок, соответствующих текущему фильтру.')).toBeInTheDocument()
  view.rerender(<I18nProvider locale="en"><List /></I18nProvider>)
  expect(screen.getByPlaceholderText('Search by name, email, contact, message')).toHaveValue('missing')
  expect(api.getModerationMentorRequests).toHaveBeenCalledTimes(1)
})

it('localizes detail controls, preserves content and submits canonical status after a locale switch', async () => {
  jest.mocked(api.updateModerationRequestStatus).mockResolvedValue({ ...request, status: 'done' } as unknown as Awaited<ReturnType<typeof api.updateModerationRequestStatus>>)
  const view = render(<I18nProvider locale="ru"><Details /></I18nProvider>)
  const select = await screen.findByRole('combobox', { name: 'Изменить статус' })
  expect(screen.getByText('Original message')).toBeInTheDocument()
  expect(screen.getByText('Original review')).toBeInTheDocument()
  expect(screen.getByText('Текущий статус')).toBeInTheDocument()
  fireEvent.change(select, { target: { value: 'done' } })
  view.rerender(<I18nProvider locale="en"><Details /></I18nProvider>)
  expect(screen.getByRole('combobox', { name: 'Change status' })).toHaveValue('done')
  expect(api.getModerationMentorRequest).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Update status' }))
  await waitFor(() => expect(api.updateModerationRequestStatus).toHaveBeenCalledWith('mentor-id', 'request-id', 'done'))
  expect(await screen.findByText('Status set to "Completed".')).toBeInTheDocument()
})
it.each([List, Details])('denies moderators without loading private requests', async (Page) => {
  mockSession.role = 'moderator'
  render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin/mentors/pending'))
  expect(api.getModerationMentorRequests).not.toHaveBeenCalled()
  expect(api.getModerationMentorRequest).not.toHaveBeenCalled()
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
})

it.each([
  [List, api.getModerationMentorRequests, 'Не удалось загрузить заявки', 'Failed to load requests'],
  [Details, api.getModerationMentorRequest, 'Не удалось загрузить заявку', 'Failed to load the request'],
] as const)('localizes failed loads without fetching again on language change', async (Page, load, russian, english) => {
  jest.mocked(load).mockRejectedValueOnce(new Error('Internal diagnostic'))
  const view = render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  expect(await screen.findByText(russian)).toBeInTheDocument()
  view.rerender(<I18nProvider locale="en"><Page /></I18nProvider>)
  expect(screen.getByText(english)).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(1)
})
it('renders English list copy without a provider', async () => {
  render(<List />)
  expect(await screen.findByPlaceholderText('Search by name, email, contact, message')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mentor requests' })).toBeInTheDocument()
})
