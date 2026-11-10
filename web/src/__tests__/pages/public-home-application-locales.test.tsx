import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Home from '@/pages/index'
import Bementor from '@/pages/bementor'

jest.mock('@/components', () => ({
  Footer: () => null, NavHeader: () => null, MetaHeader: () => null,
  MentorsFilters: () => null, MentorsList: () => null, MentorsSort: () => null, MentorsSearch: () => null,
  sortMentors: (items: unknown[]) => items,
  useMentors: () => [[], '', false, jest.fn(), jest.fn(), { count: () => 0, tags: {values: []}, category: {values: null} }, 22],
}))
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock('@/components/forms/RegisterMentorForm', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (data: { experience: number; price: string; tags: string[] }) => void }) => <button onClick={() => onSubmit({ experience: 5, price: 'Free', tags: ['Backend'] })}>Submit fixture</button>,
}))
jest.mock('@/server/mentors-data', () => ({ getAllMentors: jest.fn() }))
jest.mock('@/lib/with-ssr-observability', () => ({ withSSRObservability: (fn: unknown) => fn }))
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { info: jest.fn() }, getTraceContext: jest.fn() }))
jest.mock('@/lib/posthog', () => ({ captureException: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn(), events: {} } }))

it('renders the Russian homepage and Russian mentor plurals', () => {
  render(<I18nProvider locale="ru"><Home pageMentors={[]} /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ваш путь в менторстве начинается именно здесь')
  expect(screen.getByText('22 ментора')).toBeInTheDocument()
  expect(screen.getByRole('button', {name:'Найти ментора'})).toBeInTheDocument()
})

it('renders Russian public application success guidance', async () => {
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({success:true, mentorId:'fixture'}) })
  render(<I18nProvider locale="ru"><Bementor /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', {name:'Submit fixture'}))
  expect(await screen.findByRole('heading', {name:'Спасибо за заявку!'})).toBeInTheDocument()
  expect(screen.getByText(/ВАЖНО! Проверьте почту/)).toBeInTheDocument()
})

it('does not leak an English API error into Russian application recovery', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({success:false, error:'Backend English error'}) })
  render(<I18nProvider locale="ru"><Bementor /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', {name:'Submit fixture'}))
  await waitFor(() => expect(screen.getByText('При отправке заявки произошла ошибка.')).toBeInTheDocument())
  expect(screen.queryByText('Backend English error')).not.toBeInTheDocument()
})
