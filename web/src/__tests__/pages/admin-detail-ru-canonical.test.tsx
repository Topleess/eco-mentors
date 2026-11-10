import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Page from '@/pages/admin/mentors/[id]'
import * as api from '@/lib/admin-moderation-api'
import type { AdminMentorDetails } from '@/types'

let mockRouter = { query: { id: 'mentor-fixture' }, replace: jest.fn() }
const mockSession = { role: 'admin' }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/lib/admin-moderation-api')
// Parent workstream supplies this display helper; this suite tests page actions.
jest.mock('@/components/admin-moderation/utils', () => ({
  moderationStatusLabel: (status: string) => status,
}))
jest.mock('@/components/admin-moderation', () => ({
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
  useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: mockSession }),
  moderationStatusBadgeClass: () => '',
}))
jest.mock('@/components', () => ({
  AuthGateScreen: () => null,
  NoIndexHead: () => null,
  DeleteProfileDialog: jest.requireActual('@/components/ui/DeleteProfileDialog').default,
}))
jest.mock('@/components/forms/Wysiwyg', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/username', () => ({
  useUsernameAvailability: () => ({ status: 'idle' }),
  isUsernameFormatValid: () => true,
  USERNAME_MAX_LENGTH: 40,
}))
const mentor = {
  mentorId: 'mentor-fixture',
  slug: 'ada-fixture',
  name: 'Ada',
  email: 'ada@example.test',
  contact: 'contact',
  job: 'Engineer',
  workplace: 'Work',
  experience: '5+',
  price: 'Free',
  tags: ['Custom API tag'],
  about: '',
  description: '',
  competencies: '',
  calendarUrl: '',
  status: 'pending',
  requestsCount: 2,
  updatedAt: '2026-01-01',
} as AdminMentorDetails
beforeEach(() => {
  jest.clearAllMocks()
  mockRouter = { query: { id: 'mentor-fixture' }, replace: jest.fn() }
  mockSession.role = 'admin'
  jest.mocked(api.getModerationMentorById).mockResolvedValue(mentor)
  jest.mocked(api.updateModerationMentorStatus).mockResolvedValue({ ...mentor, status: 'inactive' })
})
it('renders Russian detail actions and submits canonical status without reloading on locale switch', async () => {
  const { rerender } = render(
    <I18nProvider locale="ru">
      <Page />
    </I18nProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Сделать неактивным' }))
  await waitFor(() =>
    expect(api.updateModerationMentorStatus).toHaveBeenCalledWith('mentor-fixture', {
      status: 'inactive',
    }),
  )
  expect(screen.getByText('Custom API tag')).toBeInTheDocument()
  expect(screen.getByText('Проверка ментора')).toBeInTheDocument()
  rerender(
    <I18nProvider locale="en">
      <Page />
    </I18nProvider>,
  )
  expect(await screen.findByRole('button', { name: 'Set inactive' })).toBeInTheDocument()
  expect(api.getModerationMentorById).toHaveBeenCalledTimes(1)
})
it('preserves unsaved fields when Next supplies a new router object during locale navigation', async () => {
  const { rerender } = render(<I18nProvider locale="ru"><Page /></I18nProvider>)
  const job = await screen.findByDisplayValue('Engineer')
  fireEvent.change(job, { target: { value: 'Unsaved job' } })
  mockRouter = { ...mockRouter }
  rerender(<I18nProvider locale="en"><Page /></I18nProvider>)
  expect(await screen.findByDisplayValue('Unsaved job')).toBeInTheDocument()
  expect(api.getModerationMentorById).toHaveBeenCalledTimes(1)
})
it('preserves typed deletion confirmation and localized request plurals', async () => {
  jest.mocked(api.deleteModerationMentor).mockResolvedValue({ ...mentor, deletedAt: '2026-01-01' })
  render(
    <I18nProvider locale="ru">
      <Page />
    </I18nProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить профиль…' }))
  expect(screen.getByRole('dialog', { name: 'Удалить профиль Ada' })).toBeInTheDocument()
  expect(screen.getByText(/вместе с 2 заявками/)).toBeInTheDocument()
  const confirm = screen.getByRole('button', { name: 'Удалить профиль навсегда' })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByPlaceholderText('ada-fixture'), {
    target: { value: ' ADA-FIXTURE ' },
  })
  fireEvent.click(confirm)
  await waitFor(() =>
    expect(api.deleteModerationMentor).toHaveBeenCalledWith('mentor-fixture', ' ADA-FIXTURE '),
  )
})
it('keeps English standalone fallback and unknown API errors intact', async () => {
  jest
    .mocked(api.getModerationMentorById)
    .mockRejectedValue(new Error('Specific upstream diagnostic'))
  render(<Page />)
  expect(await screen.findByText('Specific upstream diagnostic')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mentor review' })).toBeInTheDocument()
})
it('submits the original return reason and validates image types in Russian', async () => {
  jest.mocked(api.returnModerationMentor).mockResolvedValue({ ...mentor, status: 'draft' })
  render(
    <I18nProvider locale="ru">
      <Page />
    </I18nProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Вернуть на доработку…' }))
  fireEvent.change(screen.getByLabelText(/Что ментору нужно исправить/), {
    target: { value: '  Original review note  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Вернуть ментору' }))
  await waitFor(() =>
    expect(api.returnModerationMentor).toHaveBeenCalledWith(
      'mentor-fixture',
      'Original review note',
    ),
  )
  fireEvent.change(screen.getByLabelText('Фото профиля'), {
    target: { files: [new File(['bad'], 'file.gif', { type: 'image/gif' })] },
  })
  expect(await screen.findByText('Выберите изображение JPEG, PNG или WebP')).toBeInTheDocument()
  expect(api.uploadModerationMentorPicture).not.toHaveBeenCalled()
})
it('keeps moderator role guards and canonical redirect for nonpending profiles', async () => {
  mockSession.role = 'moderator'
  jest.mocked(api.getModerationMentorById).mockResolvedValue({ ...mentor, status: 'active' })
  render(
    <I18nProvider locale="ru">
      <Page />
    </I18nProvider>,
  )
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin/mentors/pending'))
  expect(screen.queryByRole('button', { name: 'Сделать неактивным' })).not.toBeInTheDocument()
})
