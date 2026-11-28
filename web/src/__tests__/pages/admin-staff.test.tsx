import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StaffPage from '@/pages/admin/staff'

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), pathname: '/admin/staff' }) }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Admin' }, logout: jest.fn() }),
}))
jest.mock('@/i18n', () => ({ useLocale: () => 'en', useTranslation: () => ({ t: (s: string) => s }) }))

test('uses shared accessible admin form fields', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accounts: [] }) })
  render(<StaffPage />)
  for (const label of ['Name', 'Email', 'Role']) {
    expect(await screen.findByLabelText(label)).toHaveClass('field', 'w-full', 'min-h-11')
  }
  expect(screen.getByRole('button', { name: 'Add account' })).toHaveClass('button')
})

test('creates a moderator and reloads the account list', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accounts: [] }) })
  global.fetch = fetchMock
  render(<StaffPage />)
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Test User' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.invalid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/staff', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Test User', email: 'test@example.invalid', role: 'moderator' }) })))
})

test('updates a staff role', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true)
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accounts: [{ id: '123', name: 'Jane', email: 'jane@example.invalid', role: 'moderator', active: true }] }) })
  global.fetch = fetchMock
  render(<StaffPage />)
  fireEvent.change(await screen.findByLabelText('Role for Jane'), { target: { value: 'admin' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Jane' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/staff/123', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ role: 'admin', active: true }) })))
})
