import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import MentorsFilters from '@/components/mentors/MentorsFilters'
import analytics from '@/lib/analytics'
import { translateLabel } from '@/i18n/labels'
import type { AppliedFilters } from '@/types'

function filters(): AppliedFilters {
  return {
    tags: { values: [], set: jest.fn(), reset: jest.fn() },
    category: { values: [], set: jest.fn(), reset: jest.fn() },
    experience: { values: [], set: jest.fn(), reset: jest.fn() },
    price: { values: undefined, set: jest.fn(), reset: jest.fn() },
    noSessions: { value: false, set: jest.fn(), reset: jest.fn() },
    newMentor: { value: false, set: jest.fn(), reset: jest.fn() },
    count: () => 0,
  }
}

it.each(['ru', 'en'] as const)('renders %s filter controls without changing canonical selection or analytics payloads', (locale) => {
  const applied = filters()
  const event = jest.spyOn(analytics, 'event').mockImplementation(() => {})
  render(<I18nProvider locale={locale}><MentorsFilters appliedFilters={applied} mentors={[]} /></I18nProvider>)
  expect(screen.getByRole('button', { name: locale === 'ru' ? 'Все менторы' : 'All mentors' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Опыт' : 'Experience' }))
  fireEvent.click(screen.getByRole('button', { name: locale === 'ru' ? /10\+ лет/ : /10\+ years/ }))
  expect(applied.experience.set).toHaveBeenCalledWith(['10+ years'])
  expect(event).toHaveBeenCalledWith(analytics.events.MENTOR_FILTER_CHANGED, {
    filter_type: 'experience', filter_value: '10+ years', action: 'added',
  })
  const categoryLabel = translateLabel(locale, 'Экология предприятий')
  expect(categoryLabel).toBe(locale === 'ru' ? 'Экология предприятий' : 'Enterprise ecology')
  fireEvent.click(screen.getByRole('button', { name: categoryLabel }))
  expect(applied.category.set).toHaveBeenCalledWith(['Экология предприятий'])
  fireEvent.click(screen.getByRole('button', { name: new RegExp(translateLabel(locale, 'Экологическая отчётность')) }))
  expect(applied.tags.set).toHaveBeenLastCalledWith(['Экологическая отчётность'])
  expect(event).toHaveBeenCalledWith(analytics.events.MENTOR_FILTER_CHANGED, {
    filter_type: 'tag', filter_value: 'Экологическая отчётность', action: 'added',
  })
  event.mockRestore()
})
