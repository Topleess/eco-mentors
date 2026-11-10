import { render, screen } from '@testing-library/react'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'

const mockRouter = { pathname: '/admin/vacancies', replace: jest.fn() }
let mockRole = 'admin'
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/admin-moderation/AdminAuthContext', () => ({
  useAdminAuth: () => ({ session: { role: mockRole, name: 'Test admin' }, logout: jest.fn() }),
}))

beforeEach(() => { mockRole = 'admin' })

it('links administrators to the new sections and marks the current page', () => {
  render(<AdminLayout title="Vacancies">Content</AdminLayout>)
  for (const [label, href] of [
    ['Analytics', '/admin/analytics'],
    ['Vacancies', '/admin/vacancies'],
    ['Research', '/admin/research'],
  ]) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
  }
  expect(screen.getByRole('link', { name: 'Vacancies' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Pending' })).toBeInTheDocument()
})

it('does not offer internal administrator sections to moderators', () => {
  mockRole = 'moderator'
  render(<AdminLayout title="Pending">Content</AdminLayout>)
  expect(screen.getByRole('link', { name: 'Pending' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Vacancies' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Research' })).not.toBeInTheDocument()
})
