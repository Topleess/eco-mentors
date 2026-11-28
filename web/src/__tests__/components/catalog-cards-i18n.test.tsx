import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import MentorsList from '@/components/mentors/MentorsList'
import type { MentorCardItem } from '@/types'

const mentor: MentorCardItem = {
  id: 1, mentorId: 'mentor-1', slug: 'mentor', name: 'Test Mentor',
  job: 'Developer', workplace: 'Company', experience: '2-5', price: 'Free',
  isNew: false, sessionsCount: 1,
}

it.each([[1, '1 ВСТРЕЧА'], [2, '2 ВСТРЕЧИ'], [5, '5 ВСТРЕЧ'], [21, '21 ВСТРЕЧА']])('localizes RU session badge %s and card metadata without changing source data', (count, label) => {
  const more = jest.fn()
  render(<I18nProvider locale="ru"><MentorsList mentors={[{ ...mentor, sessionsCount: Number(count) }]} hasMore onClickMore={more} /></I18nProvider>)
  expect(screen.getByText(String(label))).toBeInTheDocument()
  expect(screen.getByText(/2–5 ЛЕТ ОПЫТА/)).toBeInTheDocument()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/mentor/mentor')
  fireEvent.click(screen.getByRole('button', { name: 'Показать ещё менторов' }))
  expect(more).toHaveBeenCalledTimes(1)
})

it('localizes the new badge without exposing historical prices', () => {
  render(<I18nProvider locale="ru"><MentorsList mentors={[{ ...mentor, isNew: true, price: 'Negotiable' }, { ...mentor, id: 2, slug: 'paid', price: '$1000' }]} hasMore={false} onClickMore={() => {}} /></I18nProvider>)
  expect(screen.getByText('НОВЫЙ')).toHaveClass('bg-brand-cobalt')
  expect(screen.queryByText('ПО ДОГОВОРЁННОСТИ')).not.toBeInTheDocument()
  expect(screen.queryByText('$1000')).not.toBeInTheDocument()
})

it('does not display historical prices on public cards', () => {
  const { container } = render(<I18nProvider locale="ru"><MentorsList mentors={[{ ...mentor, price: '$789' }, { ...mentor, id: 2, slug: 'old', price: 'Negotiable' }]} hasMore={false} onClickMore={() => {}} /></I18nProvider>)
  expect(container.textContent).not.toMatch(/\$789|договорённости/i)
})
