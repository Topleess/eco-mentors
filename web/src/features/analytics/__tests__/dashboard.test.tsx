import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { AnalyticsDashboard } from '@/features/analytics/AnalyticsDashboard'
const requests = {
  range: { startDate: '2026-11-01', endDate: '2026-11-10', timezone: 'Europe/Moscow' },
  generatedAt: '2026-11-10T09:00:00Z',
  historyStartedAt: '2026-11-01T00:00:00Z',
  historyCoverage: { eligible: 2, total: 3 },
  summary: { created: 3, previousCreated: 1, active: 2, done: 1, declined: 0, attention: 1 },
  daily: [{ date: '2026-11-10', created: 3, done: 1, declined: 0 }],
  statuses: [
    { status: 'pending', count: 2 },
    { status: 'done', count: 1 },
  ],
  funnel: [
    { status: 'pending', count: 2 },
    { status: 'contacted', count: 1 },
    { status: 'working', count: 1 },
    { status: 'done', count: 1 },
  ],
  durations: [{ stage: 'pending', medianHours: null, p90Hours: null, sampleCount: 0 }],
  mentors: [
    {
      id: 'safe-mentor-id',
      name: 'Тестовый ментор',
      created: 3,
      pending: 2,
      contacted: 0,
      working: 0,
      done: 1,
      declined: 0,
      unavailable: 0,
      attention: 1,
    },
  ],
  declineReasons: [],
  attention: [
    {
      mentorId: 'safe-mentor-id',
      mentorName: 'Тестовый ментор',
      count: 1,
      oldestCreatedAt: '2026-11-02T00:00:00Z',
    },
  ],
}
const traffic = {
  status: 'not_configured',
  range: requests.range,
  generatedAt: requests.generatedAt,
  summary: null,
  daily: [],
  sources: [],
  devices: [],
  pages: [],
  events: [],
}
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 700,
    height: 270,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 700,
    bottom: 270,
    toJSON() {},
  })
})
beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => (String(input).includes('/traffic?') ? traffic : requests),
  })) as jest.Mock
})
function show() {
  render(
    <I18nProvider locale="ru">
      <AnalyticsDashboard />
    </I18nProvider>,
  )
}
it('renders source-specific unavailable traffic without inventing zero visits alongside real DB results', async () => {
  show()
  expect(await screen.findByText('Umami не подключён')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Заявки' })).toBeInTheDocument()
  expect(screen.getByText('Нет отметки об обработке более 3 дней')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Тестовый ментор' })[0]).toHaveAttribute(
    'href',
    '/admin/mentors/safe-mentor-id/requests',
  )
  expect(screen.getByText(/В расчёте: 2 из 3/)).toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Время в статусах' })).toHaveTextContent('—')
})
it('replaces the duplicate status chart with a full-history funnel and clear labels', async () => {
  show()
  await screen.findByText('Umami не подключён')
  expect(screen.getByRole('heading', { name: 'Где заявки сейчас' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'До каких этапов дошли заявки' })).toBeInTheDocument()
  const funnel = screen.getByRole('group', { name: 'Воронка заявок с полной историей' })
  await waitFor(() => expect(funnel.querySelector('.recharts-funnel-trapezoid')).toBeInTheDocument())
  const table = screen.getByRole('table', { name: 'Достигнутые этапы' })
  const first = within(table).getAllByRole('row')[1]
  expect(first).toHaveTextContent('Созданы')
  expect(within(first).getByText('2')).toBeInTheDocument()
  expect(within(first).getByText('100%')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Прохождение этапов' })).not.toBeInTheDocument()
})
it('shows accumulating history instead of a misleading zero funnel for legacy-only requests', async () => {
  const legacy = {
    ...requests,
    historyCoverage: { eligible: 0, total: 1 },
    funnel: [
      { status: 'pending', count: 0 },
      { status: 'contacted', count: 0 },
    ],
  }
  global.fetch = jest.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => (String(input).includes('/traffic?') ? traffic : legacy),
  })) as jest.Mock
  show()
  expect(await screen.findByText('История ещё накапливается')).toBeInTheDocument()
  expect(
    screen.queryByRole('group', { name: 'Воронка заявок с полной историей' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Достигнутые этапы' })).not.toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Распределение статусов' })).toBeInTheDocument()
})
it('reloads both sources with inclusive custom dates and rejects invalid range', async () => {
  show()
  await screen.findByText('Umami не подключён')
  fireEvent.change(screen.getByLabelText('С'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-11-05' } })
  fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('startDate=2026-11-01&endDate=2026-11-05'),
      expect.any(Object),
    ),
  )
  fireEvent.change(screen.getByLabelText('С'), { target: { value: '2026-11-09' } })
  fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Укажите период от 1 до 366 дней')
})
it('keeps traffic available when request analytics fails and offers retry', async () => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/requests?')) throw new Error('private database failure')
    return { ok: true, json: async () => traffic }
  }) as jest.Mock
  show()
  expect(await screen.findByText('Не удалось загрузить аналитику заявок')).toBeInTheDocument()
  expect(screen.getByText('Umami не подключён')).toBeInTheDocument()
  expect(screen.queryByText('private database failure')).not.toBeInTheDocument()
  const before = (global.fetch as jest.Mock).mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(before))
})
it('provides accessible raw numbers for charts and CSV export actions', async () => {
  show()
  await screen.findByText('Umami не подключён')
  const table = screen.getByRole('table', { name: 'Динамика заявок' })
  expect(within(table).getByText('3')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Скачать CSV/ }).length).toBeGreaterThan(1)
})
