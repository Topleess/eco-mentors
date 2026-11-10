import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import MentorsFilters from '@/components/mentors/MentorsFilters'
import analytics from '@/lib/analytics'
import { translateLabel } from '@/i18n/labels'
import type { AppliedFilters } from '@/types'

function filters(): AppliedFilters {
  return {
    tags: { values: [], set: jest.fn(), reset: jest.fn() },
    category: { values: undefined, set: jest.fn(), reset: jest.fn() },
    experience: { values: [], set: jest.fn(), reset: jest.fn() },
    price: { values: undefined, set: jest.fn(), reset: jest.fn() },
    noSessions: { value: false, set: jest.fn(), reset: jest.fn() },
    newMentor: { value: false, set: jest.fn(), reset: jest.fn() },
    count: () => 0,
  }
}

it('renders RU filter controls without changing canonical selection or analytics payloads', () => {
  const applied = filters()
  const event = jest.spyOn(analytics, 'event').mockImplementation(() => {})
  render(<I18nProvider locale="ru"><MentorsFilters appliedFilters={applied} mentors={[]} /></I18nProvider>)
  expect(screen.getByRole('button', { name: 'Все менторы' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Опыт' }))
  fireEvent.click(screen.getByRole('button', { name: /10\+ лет/ }))
  expect(applied.experience.set).toHaveBeenCalledWith(['10+ years'])
  expect(event).toHaveBeenCalledWith(analytics.events.MENTOR_FILTER_CHANGED, {
    filter_type: 'experience', filter_value: '10+ years', action: 'added',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Цена' }))
  fireEvent.click(screen.getByRole('button', { name: /Бесплатно/ }))
  expect(applied.price.set).toHaveBeenCalledWith('Free')
  expect(event).toHaveBeenCalledWith(analytics.events.MENTOR_FILTER_CHANGED, {
    filter_type: 'price', filter_value: 'Free', action: 'added',
  })
  const categoryLabel = translateLabel('ru', 'Engineering')
  expect(categoryLabel).not.toBe('Engineering')
  fireEvent.click(screen.getByRole('button', { name: categoryLabel }))
  expect(applied.category.set).toHaveBeenCalledWith('Engineering')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(translateLabel('ru', 'Backend')) }))
  expect(applied.tags.set).toHaveBeenLastCalledWith(['Backend'])
  expect(event).toHaveBeenCalledWith(analytics.events.MENTOR_FILTER_CHANGED, {
    filter_type: 'tag', filter_value: 'Backend', action: 'added',
  })
  event.mockRestore()
})
