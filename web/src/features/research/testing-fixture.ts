import type { Research } from '@/features/research/model'
export const sample = {
  id: 'one',
  slug: 'research-one',
  title: 'Sample study',
  summary: 'A summary',
  category: 'Ecology',
  author: 'Author',
  publishedOn: '2026-01-01',
  readingMinutes: 5,
  sections: [
    { id: 'intro', title: 'Introduction', body: '<script>alert(1)</script>\n\nSecond paragraph' },
  ],
  keyFindings: ['Finding'],
  status: 'published',
  provenance: 'synthetic',
  coverUrl: '',
  coverAlt: '',
  pdfUrl: '',
  citation: '',
} as Research
