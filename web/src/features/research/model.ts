export interface ResearchSection {
  id: string
  title: string
  body: string
}
export interface ResearchWrite {
  slug: string
  title: string
  summary: string
  category: string
  author: string
  publishedOn: string
  readingMinutes: number
  coverUrl: string
  coverAlt: string
  pdfUrl: string
  sections: ResearchSection[]
  keyFindings: string[]
  citation: string
  status: 'draft' | 'published' | 'archived'
  provenance: 'manual' | 'synthetic'
  version?: number
}
export interface Research extends ResearchWrite {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}
