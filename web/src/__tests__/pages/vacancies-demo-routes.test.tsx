import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Index, { getServerSideProps as listProps } from '@/pages/vacancies'
import Detail, { getServerSideProps } from '@/pages/vacancies/[slug]'
import { vacancyProvider } from '@/features/vacancies/provider'
import { HttpError } from '@/lib/go-api-client'
const mockRequest = jest.fn()
jest.mock('@/lib/go-api-client', () => ({ ...jest.requireActual('@/lib/go-api-client'), getGoApiClient: () => ({ request: mockRequest }) }))
jest.mock('@/components', () => ({ NavHeader: () => <nav />, Footer: () => <footer />, MetaHeader: ({ noIndex }: { noIndex?: boolean }) => <span data-testid="seo">{String(noIndex)}</span> }))
jest.mock('next/head', () => ({ __esModule: true, default: () => null }))
const res = { setHeader: jest.fn() }
beforeEach(() => mockRequest.mockReset())
it('fetches published records on every request and turns changed visibility into a 404', async () => {
  const vacancy = vacancyProvider.listPublished()[0]
  mockRequest.mockResolvedValueOnce({ vacancy })
  expect(await getServerSideProps({ params: { slug: vacancy.slug }, res })).toEqual({ props: { vacancy } })
  expect(mockRequest).toHaveBeenCalledWith('GET', `/api/v1/vacancies/${vacancy.slug}`)
  mockRequest.mockRejectedValueOnce(new HttpError(404, 'Not Found', ''))
  expect(await getServerSideProps({ params: { slug: vacancy.slug }, res })).toEqual({ notFound: true })
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  mockRequest.mockResolvedValueOnce({ vacancies: [vacancy] })
  expect(await listProps({ res })).toEqual({ props: { vacancies: [vacancy] } })
  expect(mockRequest).toHaveBeenLastCalledWith('GET', '/api/v1/vacancies')
})
it('propagates failures without substituting fixture jobs', async () => {
  mockRequest.mockRejectedValue(new Error('upstream unavailable'))
  await expect(listProps({ res })).rejects.toThrow('upstream unavailable')
  await expect(getServerSideProps({ params: { slug: 'one' }, res })).rejects.toThrow('upstream unavailable')
})
it('shows complete detail, back link, unavailable applications and noindex metadata', () => {
  render(<I18nProvider locale="ru"><Detail vacancy={vacancyProvider.listPublished()[0]} /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: 'Эколог-консультант' })).toBeInTheDocument()
  for (const title of ['О вакансии', 'Задачи', 'Требования', 'Условия']) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Все вакансии' })).toHaveAttribute('href', '/vacancies')
  expect(screen.getByText('Отклик пока недоступен')).toBeInTheDocument()
  expect(screen.getByText('Учебный пример: компания вымышлена.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /отклик/i })).not.toBeInTheDocument()
  expect(screen.getByTestId('seo')).toHaveTextContent('true')
})
it('renders English public UI and only labels synthetic records as fictional', () => {
  const vacancy = { ...vacancyProvider.listPublished()[0], provenance: 'manual' as const }
  render(<I18nProvider locale="en"><Index vacancies={[vacancy]} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Ecology vacancies' })).toBeInTheDocument()
  expect(screen.getByLabelText('Work format')).toBeInTheDocument()
  expect(screen.queryByText(/fictional/i)).not.toBeInTheDocument()
  expect(screen.getByTestId('seo')).toHaveTextContent('true')
})
