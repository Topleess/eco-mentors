import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResearchEditor } from '@/features/research/ResearchEditor'
import { sample } from '@/features/research/testing-fixture'
it('retains edits after failed save and supports section operations without exposing slug', async () => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => '00000000-0000-4000-8000-000000000001',
  })
  const save = jest.fn().mockRejectedValue(new Error('offline'))
  render(<ResearchEditor research={sample} onSave={save} />)
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited title' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save failed'))
  expect(screen.getByLabelText('Title')).toHaveValue('Edited title')
  expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
  expect(screen.getAllByLabelText('Section title')).toHaveLength(2)
})
it('creates a manual entry with a stable internal slug across failed retries', async () => {
  const uuid = jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000003')
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: uuid })
  const save = jest.fn().mockRejectedValue(new Error('offline'))
  render(<ResearchEditor onSave={save} />)
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
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[0][0]).toMatchObject({
    slug: 'research-00000000-0000-4000-8000-000000000003',
    provenance: 'manual',
  })
  expect(save.mock.calls[1][0].slug).toBe(save.mock.calls[0][0].slug)
  expect(uuid).toHaveBeenCalledTimes(1)
})
it('rejects normalized invalid calendar dates without sending a write', async () => {
  const save = jest.fn()
  render(<ResearchEditor research={{ ...sample, publishedOn: '2026-02-30' }} onSave={save} />)
  const form = screen.getByRole('button', { name: 'Save' }).closest('form')
  if (!form) throw new Error('Editor form missing')
  fireEvent.submit(form)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Check required fields'))
  expect(save).not.toHaveBeenCalled()
})
it('validates each finding length before saving', async () => {
  const save = jest.fn()
  render(<ResearchEditor research={{ ...sample, keyFindings: ['x'.repeat(2001)] }} onSave={save} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Check required fields'))
  expect(save).not.toHaveBeenCalled()
})
it('keeps section text fields addressable by their label after entering content', () => {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000004' })
  render(<ResearchEditor onSave={jest.fn()} />)
  fireEvent.change(screen.getByLabelText('Section text (blank lines separate paragraphs)'), { target: { value: 'Existing paragraph' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
  for (const field of screen.getAllByLabelText('Section text (blank lines separate paragraphs)')) {
    expect(field).toHaveAttribute('aria-label', 'Section text (blank lines separate paragraphs)')
  }
  expect(screen.getAllByLabelText('Section text (blank lines separate paragraphs)')).toHaveLength(2)
})

it('locks editable content and section actions during a pending save', async () => {
  const save = jest.fn(() => new Promise<never>(() => {}))
  render(<ResearchEditor research={sample} onSave={save} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(screen.getByLabelText('Title')).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Add section' })).toBeDisabled()
})
