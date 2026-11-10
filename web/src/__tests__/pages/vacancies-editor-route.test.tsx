import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n'
import Page from '@/pages/admin/vacancies/[id]'
import { loadAdminDictionaries, loadVacancy, saveVacancy } from '@/features/vacancies/api'
import { vacancyFixtures } from '@/features/vacancies/fixtures'
const mockRouter = { pathname: '/admin/vacancies/[id]', query: { id: 'demo-vacancy-01' }, replace: jest.fn(), push: jest.fn(), events: { on: jest.fn(), off: jest.fn() } }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({ useAdminAuth: () => ({ isAuthenticated: true, isLoading: false, session: { role: 'admin', name: 'Admin' } }), AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/components/layout/NoIndexHead', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/vacancies/api', () => ({ loadVacancy: jest.fn(), loadAdminDictionaries: jest.fn(), saveVacancy: jest.fn() }))
it('loads the exact ID, saves edits and uses readback version for the next write', async () => {
  const user = userEvent.setup()
  const row = vacancyFixtures[0]
  ;(loadVacancy as jest.Mock).mockResolvedValue(row)
  const entry = { slug: 'test', active: true, version: 1, updatedAt: '', name: 'Custom' }
  ;(loadAdminDictionaries as jest.Mock).mockResolvedValue({ industries: [{ ...entry, id: row.industryId }], cities: [{ ...entry, id: row.cityId }] })
  ;(saveVacancy as jest.Mock).mockImplementation(async value => ({ ...row, ...value, version: (value.version ?? 0) + 1 }))
  render(<I18nProvider locale="en"><Page /></I18nProvider>)
  expect(await screen.findByLabelText('Job title')).toHaveValue(row.title)
  expect(loadVacancy).toHaveBeenCalledWith(row.id)
  await user.clear(screen.getByLabelText('Job title'))
  await user.type(screen.getByLabelText('Job title'), 'Edited role')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved and verified')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Company'), ' edited')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveVacancy).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Edited role', version: 2 }), row.id))
})
