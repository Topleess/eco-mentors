import { render, screen, fireEvent } from '@testing-library/react'
import MentorsFilters from '@/components/mentors/MentorsFilters'
import allFilters from '@/config/filters'
import { translateLabel } from '@/i18n/labels'
import type { AppliedFilters, MentorListItem } from '@/types'

function makeAppliedFilters(overrides: Partial<AppliedFilters> = {}): AppliedFilters {
  return {
    tags: { values: [], set: jest.fn(), reset: jest.fn() },
    category: { values: [], set: jest.fn(), reset: jest.fn() },
    experience: { values: [], set: jest.fn(), reset: jest.fn() },
    price: { values: undefined, set: jest.fn(), reset: jest.fn() },
    noSessions: { value: false, set: jest.fn(), reset: jest.fn() },
    newMentor: { value: false, set: jest.fn(), reset: jest.fn() },
    count: () => 0,
    ...overrides,
  }
}

function makeMentor(overrides: Partial<MentorListItem>): MentorListItem {
  return {
    id: 1,
    mentorId: 'rec1',
    slug: 'mentor',
    name: 'Mentor',
    job: 'Dev',
    workplace: 'Corp',
    competencies: 'Things',
    experience: '2-5',
    price: '$50',
    tags: ['Производственный экологический контроль'],
    menteeCount: 0,
    photo_url: null,
    sortOrder: 1,
    isVisible: true,
    isNew: false,
    calendarType: 'none',
    ...overrides,
  }
}

const mentors: MentorListItem[] = [
  makeMentor({ id: 1, slug: 'a', tags: ['Производственный экологический контроль'], experience: '2-5', price: '$50' }),
  makeMentor({ id: 2, slug: 'b', tags: ['Производственный экологический контроль', 'Экологическая отчётность'], experience: '10+', price: 'Free' }),
  makeMentor({ id: 3, slug: 'c', tags: ['Экологическое проектирование'], experience: '10+', price: 'Negotiable' }),
]

describe('MentorsFilters', () => {
  it('adds a second category without clearing existing topics', () => {
    const appliedFilters = makeAppliedFilters({
      category: { values: ['Климат'], set: jest.fn(), reset: jest.fn() },
      tags: { values: ['Углеродный учёт'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enterprise ecology' }))
    expect(appliedFilters.category.set).toHaveBeenCalledWith(['Климат', 'Экология предприятий'])
    expect(appliedFilters.tags.set).not.toHaveBeenCalled()
  })

  it('renders categories and experience without a price filter', () => {
    render(<MentorsFilters appliedFilters={makeAppliedFilters()} mentors={mentors} />)

    expect(screen.getByRole('button', { name: /All mentors/i })).toBeInTheDocument()
    for (const category of allFilters.categories) {
      expect(screen.getByRole('button', { name: translateLabel('en', category.label) })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Experience' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Price' })).not.toBeInTheDocument()
  })

  it('marks "All mentors" active only when no topic filter is applied', () => {
    const { rerender } = render(
      <MentorsFilters appliedFilters={makeAppliedFilters()} mentors={mentors} />
    )
    expect(screen.getByRole('button', { name: /All mentors/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    rerender(
      <MentorsFilters
        appliedFilters={makeAppliedFilters({
          category: { values: ['Экология предприятий'], set: jest.fn(), reset: jest.fn() },
        })}
        mentors={mentors}
      />
    )
    expect(screen.getByRole('button', { name: /All mentors/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('activates a category and opens its dropdown with per-tag counts', () => {
    const appliedFilters = makeAppliedFilters()
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enterprise ecology' }))

    expect(appliedFilters.category.set).toHaveBeenCalledWith(['Экология предприятий'])
    expect(appliedFilters.tags.set).not.toHaveBeenCalled()

    // Dropdown lists the category's tags with counts from the loaded mentors
    const monitoringItem = screen.getByRole('button', { name: /Industrial environmental monitoring/ })
    expect(monitoringItem).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /Environmental reporting/ })).toHaveTextContent('1')
  })

  it('shows zero counts for category tags when no mentors are loaded', () => {
    render(<MentorsFilters appliedFilters={makeAppliedFilters()} mentors={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enterprise ecology' }))

    expect(screen.getByRole('button', { name: /Industrial environmental monitoring/ })).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /Environmental reporting/ })).toHaveTextContent('0')
  })

  it('selects a tag and keeps the panel open', () => {
    const appliedFilters = makeAppliedFilters({
      category: { values: ['Экология предприятий'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    // Active category click opens the dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Enterprise ecology' }))
    fireEvent.click(screen.getByRole('button', { name: /Environmental reporting/ }))

    expect(appliedFilters.tags.set).toHaveBeenCalledWith(['Экологическая отчётность'])
    expect(screen.getByRole('button', { name: /Industrial environmental monitoring/ })).toBeInTheDocument()
  })

  it('re-picking the selected tag widens back to the whole category', () => {
    const appliedFilters = makeAppliedFilters({
      category: { values: ['Экология предприятий'], set: jest.fn(), reset: jest.fn() },
      tags: { values: ['Экологическая отчётность'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    fireEvent.click(screen.getByRole('button', { name: /Enterprise ecology/ }))
    fireEvent.click(screen.getByRole('button', { name: /Environmental reporting/ }))

    expect(appliedFilters.tags.set).toHaveBeenCalledWith([])
  })

  it('toggles the dropdown when the active category is clicked again', () => {
    const appliedFilters = makeAppliedFilters({
      category: { values: ['Экология предприятий'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    const pill = screen.getByRole('button', { name: 'Enterprise ecology' })

    fireEvent.click(pill)
    expect(screen.getByRole('button', { name: /Environmental reporting/ })).toBeInTheDocument()
    expect(pill).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(pill)
    expect(screen.queryByRole('button', { name: /Environmental reporting/ })).not.toBeInTheDocument()
    expect(pill).toHaveAttribute('aria-expanded', 'false')
  })

  // NOTE: the "single-tag category (no dropdown)" case used to be covered here
  // via the old one-tag 'Design' category. The D30 taxonomy has no single-tag
  // category any more, so the scenario is unreachable through the real config.
  // MentorsFilters still guards it (`hasDropdown = category.tags.length > 1`)
  // in case one is added later.

  it('resets category and tags when "All mentors" is clicked', () => {
    const appliedFilters = makeAppliedFilters({
      category: { values: ['Экология предприятий'], set: jest.fn(), reset: jest.fn() },
      tags: { values: ['Экологическая отчётность'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    fireEvent.click(screen.getByRole('button', { name: /All mentors/i }))

    expect(appliedFilters.category.reset).toHaveBeenCalled()
    expect(appliedFilters.tags.set).toHaveBeenCalledWith([])
  })

  it('multi-selects experience levels and keeps the panel open', () => {
    const appliedFilters = makeAppliedFilters({
      experience: { values: ['2-5 years'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    fireEvent.click(screen.getByRole('button', { name: /Experience/ }))

    // Counts come from the loaded mentors (two mentors are 10+)
    const tenPlus = screen.getByRole('button', { name: /10\+ years/ })
    expect(tenPlus).toHaveTextContent('2')

    fireEvent.click(tenPlus)
    expect(appliedFilters.experience.set).toHaveBeenCalledWith(['2-5 years', '10+ years'])

    // Panel stays open for multi-select
    expect(screen.getByRole('button', { name: /5-10 years/ })).toBeInTheDocument()

    // Deselecting removes the value
    fireEvent.click(screen.getByRole('button', { name: /2-5 years/ }))
    expect(appliedFilters.experience.set).toHaveBeenCalledWith([])
  })

  it('shows a selection count badge on the Experience pill', () => {
    const appliedFilters = makeAppliedFilters({
      experience: { values: ['2-5 years', '10+ years'], set: jest.fn(), reset: jest.fn() },
    })
    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    expect(screen.getByRole('button', { name: /Experience/ })).toHaveTextContent('Experience2')
  })

  it('initializes tags from the #tags: URL hash on mount', () => {
    const appliedFilters = makeAppliedFilters()
    window.location.hash = '#tags:Производственный экологический контроль|NotATag'

    render(<MentorsFilters appliedFilters={appliedFilters} mentors={mentors} />)

    expect(appliedFilters.tags.set).toHaveBeenCalledWith(['Производственный экологический контроль'])
    window.location.hash = ''
  })
})