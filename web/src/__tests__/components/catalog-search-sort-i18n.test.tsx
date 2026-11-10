import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import MentorsSearch from '@/components/mentors/MentorsSearch'
import MentorsSort from '@/components/mentors/MentorsSort'
import analytics from '@/lib/analytics'

it('translates sort labels without changing sort identifiers or analytics', () => {
  const onChange = jest.fn()
  const event = jest.spyOn(analytics, 'event').mockImplementation(() => {})
  render(<I18nProvider locale="ru"><MentorsSort value="relevance" onChange={onChange} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: /СОРТИРОВКА: ПО РЕЛЕВАНТНОСТИ/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Больше встреч' }))
  expect(onChange).toHaveBeenCalledWith('sessions')
  expect(event).toHaveBeenCalledWith(analytics.events.MENTORS_SORT_CHANGED, { sort_option: 'sessions', previous_option: 'relevance' })
  event.mockRestore()
})

it('translates Russian search accessibility and placeholder while preserving typed queries', () => {
  const onChange = jest.fn()
  render(<I18nProvider locale="ru"><MentorsSearch value="" onChange={onChange} /></I18nProvider>)
  const search = screen.getByRole('searchbox', { name: 'Поиск менторов по роли, навыку или компании' })
  expect(search).toHaveAttribute('placeholder', 'Роль, навык или компания…')
  fireEvent.change(search, { target: { value: 'React' } })
  expect(onChange).toHaveBeenCalledWith('React')
})
