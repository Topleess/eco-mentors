import { render, screen, waitFor } from '@testing-library/react'
import { ResearchAdminList } from '@/features/research/ResearchAdminPages'
const mockList = jest.fn()
jest.mock('@/features/research/api', () => ({ loadResearchList: () => mockList() }))
it('opens title in editor and provides a distinct public link only for published rows', async () => {
  mockList.mockResolvedValue([
    { id: 'one', slug: 'research-one', title: 'Study', status: 'published' },
    { id: 'two', slug: 'research-two', title: 'Draft study', status: 'draft' },
  ])
  render(<ResearchAdminList />)
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Study' })).toHaveAttribute(
      'href',
      '/admin/research/one',
    ),
  )
  expect(screen.getAllByRole('link', { name: 'View publication' })).toHaveLength(1)
})
