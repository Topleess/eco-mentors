import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResearchEditorPage } from '@/features/research/ResearchAdminPages'
import { sample } from '@/features/research/testing-fixture'
const mockReplace = jest.fn().mockResolvedValue(true)
const mockSave = jest.fn().mockResolvedValue({ ...sample, id: 'saved-id' })
jest.mock('next/router', () => ({ useRouter: () => ({ query: {}, replace: mockReplace }) }))
jest.mock('@/features/vacancies/VacancyAdminShell', () => ({
  VacancyAdminShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/features/research/api', () => ({
  saveResearch: (...args: unknown[]) => mockSave(...args),
}))
it('replaces the new route with the verified saved editor identity', async () => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => '00000000-0000-4000-8000-000000000003',
  })
  render(<ResearchEditorPage create />)
  for (const [name, value] of Object.entries({
    Title: 'New study',
    Summary: 'Summary',
    Category: 'Ecology',
    Author: 'Author',
    'Publication date': '2026-01-01',
    'Section title': 'Intro',
    'Section text (blank lines separate paragraphs)': 'Body',
  }))
    fireEvent.change(screen.getByLabelText(name), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/research/saved-id'))
})
