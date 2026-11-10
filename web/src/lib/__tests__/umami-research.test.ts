import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResearchDetail } from '@/features/research/PublicResearch'
import { sample } from '@/features/research/testing-fixture'
const mockEvent = jest.fn()
jest.mock('@/lib/analytics', () => ({
  __esModule: true,
  default: { event: (...args: unknown[]) => mockEvent(...args) },
}))
it('tracks the actual PDF controls without the document URL or title', () => {
  render(
    React.createElement(ResearchDetail, {
      research: { ...sample, pdfUrl: 'https://example.org/private.pdf?token=secret' },
    }),
  )
  fireEvent.click(screen.getByRole('link', { name: 'Open PDF' }))
  fireEvent.click(screen.getByRole('link', { name: 'Download PDF' }))
  expect(mockEvent.mock.calls).toEqual([['research_pdf_clicked'], ['research_pdf_clicked']])
})
