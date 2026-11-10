import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { VacancyCatalog } from '@/features/vacancies/VacancyCatalog'
import { vacancyProvider } from '@/features/vacancies/provider'

it('renders only published demonstration vacancies with truthful notice and detail links', () => {
  render(<I18nProvider locale="ru"><VacancyCatalog vacancies={vacancyProvider.listPublished()} /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: 'Вакансии в экологии' })).toBeInTheDocument()
  expect(screen.getByText('Отклик пока недоступен')).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(9)
  expect(screen.getByRole('link', { name: 'Эколог-консультант' })).toHaveAttribute('href', '/vacancies/ecologist-consultant')
  expect(screen.queryByText('Аналитик возобновляемой энергетики')).not.toBeInTheDocument()
})

it('combines search and facets, derives the count and resets no results', async () => {
  const user = userEvent.setup()
  render(<I18nProvider locale="ru"><VacancyCatalog vacancies={vacancyProvider.listAdmin()} /></I18nProvider>)
  await user.type(screen.getByRole('searchbox'), 'атлас')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Найдено: 1')
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'Казань')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await user.clear(screen.getByRole('searchbox'))
  await user.click(screen.getByRole('button', { name: 'Отрасль' }))
  await user.click(screen.getByRole('button', { name: /research/ }))
  await user.click(screen.getByRole('button', { name: 'Формат работы' }))
  await user.click(screen.getByRole('button', { name: /Удалённо/ }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await user.type(screen.getByRole('searchbox'), 'несуществующая')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Найдено: 0')
  expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
  expect(screen.getAllByRole('article')).toHaveLength(9)
  expect(screen.getByRole('searchbox')).toHaveValue('')
})


it('uses the homepage search treatment without a visible search label and accessible pill filters', async () => {
  const user = userEvent.setup()
  render(<I18nProvider locale="ru"><VacancyCatalog vacancies={vacancyProvider.listPublished()} /></I18nProvider>)
  const search = screen.getByRole('searchbox', { name: 'Поиск по должности, компании или городу' })
  expect(search).toHaveAttribute('placeholder', 'Должность, компания, город')
  expect(search).toHaveClass('rounded-card', 'pl-11', 'bg-surface')
  expect(screen.queryByText('Поиск по должности, компании или городу')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  const industry = screen.getByRole('button', { name: 'Отрасль' })
  expect(industry).toHaveAttribute('aria-expanded', 'false')
  await user.click(industry)
  expect(industry).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(industry).toHaveAttribute('aria-expanded', 'false')
  await user.click(industry)
  await user.click(search)
  expect(industry).toHaveAttribute('aria-expanded', 'false')
})

it('localizes the new search placeholder and filter pills in English', () => {
  render(<I18nProvider locale="en"><VacancyCatalog vacancies={vacancyProvider.listPublished()} /></I18nProvider>)
  expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Job title, company, city')
  expect(screen.getByRole('button', { name: 'Industry' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Work format' })).toBeInTheDocument()
})
