import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { VacancyCatalog } from '@/features/vacancies/VacancyCatalog'
import { vacancyFixtures } from '@/features/vacancies/fixtures'
import { getServerSideProps } from '@/pages/vacancies'
import { getGoApiClient } from '@/lib/go-api-client'

jest.mock('@/lib/go-api-client', () => ({ getGoApiClient: jest.fn() }))

it.each([['ru', 'В архиве'], ['en', 'Archived']] as const)('shows archived records without a broken detail link in %s', (locale, label) => {
  const published = { ...vacancyFixtures[0], status: 'published' as const }
  const archived = { ...vacancyFixtures[1], status: 'archived' as const }
  const draft = { ...vacancyFixtures[2], status: 'draft' as const }
  render(<I18nProvider locale={locale}><VacancyCatalog vacancies={[published, archived, draft]} /></I18nProvider>)
  const card = screen.getByText(archived.title).closest('article')!
  expect(within(card).getByText(label)).toBeInTheDocument()
  expect(within(card).queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: published.title })).toHaveAttribute('href', `/vacancies/${published.slug}`)
  expect(screen.queryByText(draft.title)).not.toBeInTheDocument()
})

it('passes published and archived vacancies from the public API, but never drafts', async () => {
  const vacancies = vacancyFixtures.slice(0, 3).map((v, i) => ({ ...v, status: (['published', 'archived', 'draft'] as const)[i] }))
  ;(getGoApiClient as jest.Mock).mockReturnValue({ request: jest.fn().mockResolvedValue({ vacancies }) })
  const result = await getServerSideProps({ res: { setHeader: jest.fn() } })
  expect(result.props.vacancies.map(v => v.status)).toEqual(['published', 'archived'])
})
