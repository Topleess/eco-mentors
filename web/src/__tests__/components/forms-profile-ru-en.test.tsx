import { I18nProvider } from '@/i18n'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProfileForm from '@/components/forms/ProfileForm'
import type { MentorWithSecureFields } from '@/types'

// Mock react-select: the tags field is irrelevant here and its portal
// rendering does not work under jsdom.
jest.mock('react-select', () => ({
  __esModule: true,
  default: function MockSelect() {
    return <div data-testid="tags-select" />
  },
}))

jest.mock('@/components/forms/Wysiwyg', () => ({
  __esModule: true,
  default: function MockWysiwyg({
    content,
    onUpdate,
  }: {
    content: string
    onUpdate: (editor: { getHTML: () => string }) => void
  }) {
    return (
      <textarea
        value={content}
        onChange={(e) => onUpdate({ getHTML: () => e.target.value })}
        data-testid="wysiwyg"
      />
    )
  },
}))

const baseMentor: MentorWithSecureFields = {
  id: 1,
  mentorId: 'aa63ba98-0000-4000-8000-000000000001',
  slug: 'jane-doe',
  name: 'Jane Doe',
  job: 'Staff Engineer',
  workplace: 'Acme',
  description: '<p>I can help with Go</p>',
  about: '<p>15 years of backend work</p>',
  competencies: 'Go, PostgreSQL',
  experience: '10+',
  price: '$100',
  tags: ['Backend'],
  menteeCount: 3,
  photo_url: null,
  sortOrder: 0,
  isVisible: true,
  isNew: false,
  calendarType: 'none',
  calendarUrl: null,
}

const mockOnSubmit = jest.fn()

function renderForm(overrides: Partial<MentorWithSecureFields> = {}): void {
  render(
    <I18nProvider locale="ru"><ProfileForm
      mentor={{ ...baseMentor, ...overrides }}
      isLoading={false}
      isError={false}
      onSubmit={mockOnSubmit}
      onImageUpload={jest.fn()}
      imageUploadStatus="idle"
      tempImagePreview={null}
    /></I18nProvider>
  )
}

it('Russian profile save preserves stored price, experience and tags', async () => {
  renderForm({ experience: '15 years', price: '$75' })
  expect(screen.getByLabelText(/Ваше полное имя/)).toHaveValue('Jane Doe')
  expect(screen.getByRole('option', { name: '15 years' })).toHaveValue('15 years')
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ price: '$75', experience: '15 years', tags: ['Backend'] })))
})
