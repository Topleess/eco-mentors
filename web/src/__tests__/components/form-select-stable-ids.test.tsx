import { render } from '@testing-library/react'
import RegisterMentorForm from '@/components/forms/RegisterMentorForm'
import ProfileForm from '@/components/forms/ProfileForm'
import type { MentorWithSecureFields } from '@/types'

jest.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }))
jest.mock('@/components/forms/Wysiwyg', () => ({ __esModule: true, default: () => null }))

const mentor: MentorWithSecureFields = {
  id: 1, mentorId: 'b0000000-0000-4000-8000-000000000001', slug: 'local-alex', name: 'Alex',
  job: 'Developer', workplace: 'Local', description: 'Test', about: 'Test', competencies: 'Go',
  experience: '5-10', price: 'Free', tags: ['Backend'], menteeCount: 0, photo_url: null,
  sortOrder: 0, isVisible: true, isNew: false, calendarType: 'none', calendarUrl: null,
}

it('gives registration tags a stable SSR/client id independent of react-select render counters', () => {
  const { container, unmount } = render(<RegisterMentorForm isLoading={false} isError={false} onSubmit={jest.fn()} />)
  expect(container.querySelector('#react-select-register-mentor-tags-input')).toBeInTheDocument()
  unmount()
  const second = render(<RegisterMentorForm isLoading={false} isError={false} onSubmit={jest.fn()} />)
  expect(second.container.querySelector('#react-select-register-mentor-tags-input')).toBeInTheDocument()
})
it('gives profile tags a distinct stable SSR/client id', () => {
  const { container } = render(<ProfileForm mentor={mentor} isLoading={false} isError={false} onSubmit={jest.fn()} onImageUpload={jest.fn()} imageUploadStatus="idle" tempImagePreview={null} />)
  expect(container.querySelector('#react-select-mentor-profile-tags-input')).toBeInTheDocument()
})
