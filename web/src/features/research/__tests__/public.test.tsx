import { render, screen, fireEvent } from '@testing-library/react'
import { ResearchCatalog, ResearchDetail } from '@/features/research/PublicResearch'
import { sample } from '@/features/research/testing-fixture'
it('hides unpublished rows and filters real published categories', () => {
  render(
    <ResearchCatalog
      research={[sample, { ...sample, id: 'two', title: 'Private', status: 'draft' }]}
    />,
  )
  expect(screen.queryByText('Private')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-3xl', 'sm:text-[40px]')
  expect(screen.getByRole('searchbox').parentElement?.parentElement).toHaveClass('items-end')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } })
  expect(screen.queryByText('Sample study')).not.toBeInTheDocument()
})
it('uses named dropdown pills instead of separately labelled selects', () => {
  render(<ResearchCatalog research={[sample, { ...sample, id: 'two', slug: 'other', title: 'Other study', category: 'Other', publishedOn: '2025-01-01' }]} />)
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  const category = screen.getByRole('button', { name: 'Category' })
  fireEvent.click(category)
  expect(category).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(screen.getByRole('button', { name: /Other/ }))
  expect(screen.queryByText('Sample study')).not.toBeInTheDocument()
  expect(screen.getByText('Other study')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Year' }))
  fireEvent.click(screen.getByRole('button', { name: /2025/ }))
  expect(screen.getByText('Other study')).toBeInTheDocument()
  fireEvent.click(category)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(category).toHaveAttribute('aria-expanded', 'false')
})

it('keeps complete cover artwork visible without cropping its title', () => {
  render(<ResearchDetail research={{ ...sample, coverUrl: '/research-assets/ecology-careers.svg', coverAlt: 'Complete study cover' }} />)
  expect(screen.getByRole('img', { name: 'Complete study cover' })).toHaveClass('object-contain')
})

it('renders safe text, real section anchors, sample label, and no unavailable PDF control', () => {
  const { container } = render(<ResearchDetail research={sample} />)
  expect(container.querySelector('script')).toBeNull()
  expect(screen.getByText('<script>alert(1)</script>')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '#intro')
  expect(screen.getByText(/Sample Russian content/)).toBeVisible()
  expect(screen.queryByText('Open PDF')).not.toBeInTheDocument()
})
