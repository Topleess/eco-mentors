import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useLocale } from '@/i18n'
import { RequestProgressFunnel } from './RequestProgressFunnel'
import { analyticsPreset, validAnalyticsDates, downloadCsv } from './model'
import type { DateRange, RequestsData, TrafficData, Metric } from './model'

function useSource<T>(source: string, range: DateRange, revision: number) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, loading: true, error: false })
    const query = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate })
    void fetch(`/api/admin/analytics/${source}?${query}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable')
        return (await response.json()) as T
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error: true })
      })
    return () => controller.abort()
  }, [source, range.startDate, range.endDate, revision])
  return state
}
const colors = ['#2F5EFF', '#0E7A70', '#E5484D']
export function AnalyticsDashboard(): JSX.Element {
  const locale = useLocale()
  const ru = locale === 'ru'
  const l = (r: string, e: string): string => (ru ? r : e)
  const [range, setRange] = useState<DateRange>(() => analyticsPreset(30))
  const [draft, setDraft] = useState<DateRange>(range)
  const [revision, setRevision] = useState(0)
  const [invalid, setInvalid] = useState(false)
  const requests = useSource<RequestsData>('requests', range, revision)
  const traffic = useSource<TrafficData>('traffic', range, revision)
  const r = requests.data
  const w = traffic.data
  const format = (value: number): string =>
    new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }).format(value)
  const day = (date: string): string =>
    new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: 'short',
    }).format(new Date(`${date.slice(0, 10)}T12:00:00+03:00`))
  const time = (date: string): string =>
    new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(date))
  const status = (value: string): string =>
    ({
      pending: l('Новая', 'New'),
      contacted: l('Контакт установлен', 'Contact recorded'),
      working: l('В работе', 'In progress'),
      done: l('Завершена', 'Completed'),
      declined: l('Отказ', 'Declined'),
      unavailable: l('Недоступна', 'Unavailable'),
      reschedule: l('Перенос (старый статус)', 'Reschedule (legacy)'),
      total: l('Полный цикл', 'Total cycle'),
    })[value] || value
  const reason = (value: string): string =>
    ({
      no_time: l('Недостаточно времени', 'Not enough time'),
      topic_mismatch: l('Тема вне специализации', 'Outside expertise'),
      helping_others: l('Работает с другими менти', 'Helping other mentees'),
      on_break: l('Временно не принимает заявки', 'On a break'),
      other: l('Другое', 'Other'),
      unspecified: l('Не указана', 'Unspecified'),
    })[value] || l('Не указана', 'Unspecified')
  const noData = l('Нет данных за выбранный период', 'No data for the selected period')
  const apply = (next: DateRange): void => {
    setInvalid(false)
    setDraft(next)
    setRange(next)
  }
  const change = (current: number, previous: number): string =>
    previous === 0
      ? l(`За предыдущий период: ${format(previous)}`, `Previous period: ${format(previous)}`)
      : `${current >= previous ? '+' : ''}${format(((current - previous) / previous) * 100)}% · ${l('к предыдущему периоду', 'vs previous period')}`
  function Panel({
    title,
    children,
    note,
  }: {
    title: string
    children: ReactNode
    note?: string
  }): JSX.Element {
    return (
      <section className="min-w-0 rounded-panel border border-line bg-white p-4 sm:p-6">
        <h2 className="mb-3 mt-0 text-lg text-ink">{title}</h2>
        {note && <p className="mb-5 mt-0 text-sm leading-relaxed text-ink-mute">{note}</p>}
        {children}
      </section>
    )
  }
  function Table({
    title,
    headers,
    rows,
    exportRows,
  }: {
    title: string
    headers: string[]
    rows: ReactNode[][]
    exportRows?: (string | number | null)[][]
  }): JSX.Element {
    return (
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="my-0 text-sm font-semibold text-ink">{title}</h3>
          {rows.length > 0 && (
            <button
              type="button"
              className="button-ghost px-2 py-2 text-xs"
              onClick={() =>
                downloadCsv(
                  `analytics-${range.startDate}-${range.endDate}.csv`,
                  headers,
                  exportRows ||
                    rows.map((row) =>
                      row.map((cell) =>
                        typeof cell === 'string' || typeof cell === 'number' ? cell : null,
                      ),
                    ),
                )
              }
            >
              {l('Скачать CSV', 'Download CSV')}
              <span className="sr-only">: {title}</span>
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-mute">{noData}</p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-field border border-line">
            <table aria-label={title} className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface">
                <tr>
                  {headers.map((header, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-3 font-semibold text-ink-soft">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-3 tabular-nums text-ink">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
  function Chart({
    title,
    data,
    lines,
    horizontal = false,
  }: {
    title: string
    data: Record<string, string | number>[]
    lines: { key: string; label: string }[]
    horizontal?: boolean
  }): JSX.Element {
    if (!data.length || !data.some((row) => lines.some((line) => Number(row[line.key]) > 0)))
      return <p className="py-6 text-sm text-ink-mute">{noData}</p>
    const axis = horizontal ? 'label' : 'date'
    return (
      <div role="group" aria-label={title} className="mb-5 min-w-0" style={{ height: 270 }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 700, height: 270 }}
        >
          {horizontal ? (
            <BarChart
              data={data}
              layout="vertical"
              accessibilityLayer
              margin={{ top: 12, right: 18, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#E3E7EF" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey={axis}
                width={155}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name={l('Заявки', 'Requests')}
                fill={colors[0]}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <LineChart
              data={data}
              accessibilityLayer
              margin={{ top: 12, right: 12, left: -12, bottom: 8 }}
            >
              <CartesianGrid stroke="#E3E7EF" vertical={false} />
              <XAxis dataKey={axis} tickFormatter={day} tick={{ fontSize: 11 }} minTickGap={28} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(value) => day(String(value))} />
              <Legend />
              {lines.map((line, i) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={data.length < 15}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }
  function MetricTable({
    title,
    items,
    label = l('Посетители', 'Visitors'),
  }: {
    title: string
    items: Metric[]
    label?: string
  }): JSX.Element {
    return (
      <Table
        title={title}
        headers={[l('Название', 'Name'), label]}
        rows={items.map((item) => [item.name, format(item.count)])}
      />
    )
  }
  function Stat({
    label,
    value,
    detail,
  }: {
    label: string
    value: number | undefined
    detail?: string
  }): JSX.Element {
    return (
      <div className="min-w-0 rounded-card border border-line bg-white p-4">
        <p className="mb-2 mt-0 text-sm text-ink-mute">{label}</p>
        <p className="my-0 font-name text-3xl tabular-nums text-ink">
          {value === undefined ? '—' : format(value)}
        </p>
        {detail && <p className="mb-0 mt-2 text-xs text-ink-mute">{detail}</p>}
      </div>
    )
  }
  const mentorLink = (id: string, name: string): ReactNode =>
    id ? (
      <Link
        className="font-semibold text-brand-cobalt hover:underline"
        href={`/admin/mentors/${encodeURIComponent(id)}/requests`}
      >
        {name || l('Ментор без имени', 'Unnamed mentor')}
      </Link>
    ) : (
      l('Ментор удалён', 'Deleted mentor')
    )
  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-panel border border-line bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meta-mono mb-2 mt-0 text-brand-cobalt">
              {l('Данные платформы', 'Platform data')}
            </p>
            <p className="my-0 text-sm text-ink-mute">
              {l(
                'Часовой пояс: Москва (UTC+3). Конечная дата включена.',
                'Timezone: Moscow (UTC+3). End date is inclusive.',
              )}
            </p>
          </div>
          <button
            type="button"
            className="button-secondary px-4 py-2 text-sm"
            onClick={() => setRevision((value) => value + 1)}
          >
            {l('Обновить', 'Refresh')}
          </button>
        </div>
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!validAnalyticsDates(draft.startDate, draft.endDate)) {
              setInvalid(true)
              return
            }
            apply(draft)
          }}
        >
          <div className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                className="button-ghost whitespace-nowrap px-3 py-3 text-sm"
                aria-pressed={JSON.stringify(range) === JSON.stringify(analyticsPreset(days))}
                onClick={() => apply(analyticsPreset(days))}
              >
                {days} {l('дней', 'days')}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink-soft">
            {l('С', 'From')}
            <input
              type="date"
              className="field w-full text-sm"
              value={draft.startDate}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              required
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink-soft">
            {l('По', 'To')}
            <input
              type="date"
              className="field w-full text-sm"
              value={draft.endDate}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              required
            />
          </label>
          <button type="submit" className="button px-4 py-3 text-sm">
            {l('Применить', 'Apply')}
          </button>
        </form>
        {invalid && (
          <p role="alert" className="mb-0 text-sm text-danger">
            {l('Укажите период от 1 до 366 дней', 'Choose a valid period of 1–366 days')}
          </p>
        )}
      </div>
      <section aria-label={l('Общая сводка', 'Overview')}>
        <h2 className="mb-3 mt-0 text-lg">{l('Общая сводка', 'Overview')}</h2>
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat
            label={l('Посетители', 'Visitors')}
            value={w?.summary?.visitors}
            detail={
              w?.summary
                ? change(w.summary.visitors, w.summary.previousVisitors)
                : l('Источник: Umami', 'Source: Umami')
            }
          />
          <Stat
            label={l('Посещения', 'Visits')}
            value={w?.summary?.visits}
            detail={w?.summary ? change(w.summary.visits, w.summary.previousVisits) : undefined}
          />
          <Stat
            label={l('Просмотры', 'Pageviews')}
            value={w?.summary?.views}
            detail={w?.summary ? change(w.summary.views, w.summary.previousViews) : undefined}
          />
          <Stat
            label={l('Новые заявки', 'New requests')}
            value={r?.summary.created}
            detail={
              r
                ? change(r.summary.created, r.summary.previousCreated)
                : l('Источник: БД', 'Source: database')
            }
          />
          <Stat
            label={l('Активные из выбранной когорты', 'Active in selected cohort')}
            value={r?.summary.active}
          />
          <Stat
            label={l('Требуют внимания · все даты', 'Need attention · all dates')}
            value={r?.summary.attention}
          />
        </div>
      </section>
      <Panel
        title={l('Посещаемость', 'Traffic')}
        note={l(
          'Источник: Umami. Посетители за период рассчитаны отдельно, а не сложением уникальных посетителей по дням. Данные обновляются с кэшем до 30 секунд.',
          'Source: Umami. Period visitors are calculated independently, not by adding daily unique visitors. Reports are cached for up to 30 seconds.',
        )}
      >
        {traffic.loading && <p role="status">{l('Загружаем посещаемость…', 'Loading traffic…')}</p>}
        {(traffic.error || w?.status === 'unavailable') && (
          <p role="alert" className="text-sm text-danger">
            {l(
              'Не удалось загрузить посещаемость. Попробуйте обновить данные.',
              'Traffic is unavailable. Try refreshing.',
            )}
          </p>
        )}
        {w?.status === 'not_configured' && (
          <div className="rounded-card bg-surface p-5">
            <h3 className="mt-0 text-base">{l('Umami не подключён', 'Umami is not configured')}</h3>
            <p className="mb-0 text-sm text-ink-mute">
              {l(
                'После подключения появятся посещения, источники и действия. Отсутствие подключения не означает нулевую посещаемость.',
                'Visits, sources and actions appear after setup. An unconfigured provider does not mean zero traffic.',
              )}
            </p>
          </div>
        )}
        {w?.status === 'connected' && (
          <>
            <Chart
              title={l('Динамика посещаемости', 'Traffic over time')}
              data={w.daily}
              lines={[
                { key: 'views', label: l('Просмотры', 'Pageviews') },
                { key: 'visitors', label: l('Посетители', 'Visitors') },
              ]}
            />
            <details className="mb-6">
              <summary className="cursor-pointer text-sm font-semibold text-brand-cobalt">
                {l('Числа на графике', 'Chart data')}
              </summary>
              <div className="mt-3">
                <Table
                  title={l('Динамика посещаемости', 'Traffic over time')}
                  headers={[
                    l('Дата', 'Date'),
                    l('Посетители', 'Visitors'),
                    l('Просмотры', 'Pageviews'),
                  ]}
                  rows={w.daily.map((item) => [item.date, item.visitors, item.views])}
                />
              </div>
            </details>
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <MetricTable
                title={l('Источники переходов', 'Referring sources')}
                items={w.sources}
              />
              <MetricTable title={l('Устройства', 'Devices')} items={w.devices} />
              <MetricTable title={l('Страницы · до 500', 'Pages · up to 500')} items={w.pages} />
              <MetricTable
                title={l('Действия', 'Actions')}
                items={w.events}
                label={l('События', 'Events')}
              />
              {w.campaigns && (
                <MetricTable title={l('UTM-кампании', 'UTM campaigns')} items={w.campaigns} />
              )}
            </div>
            <h3 className="mb-3 mt-7 text-base font-semibold">{l('По разделам', 'By content')}</h3>
            <p className="text-xs text-ink-mute">
              {l(
                'Уникальные посетители каждой страницы. Один человек может попасть в несколько строк; значения не складываются в общий итог.',
                'Unique visitors per page. A person may appear in multiple rows; counts must not be added into a total.',
              )}
            </p>
            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              {[
                ['/mentor/', l('Менторы', 'Mentors')],
                ['/vacancies/', l('Вакансии', 'Vacancies')],
                ['/research/', l('Исследования', 'Research')],
              ].map(([prefix, title]) => (
                <MetricTable
                  key={prefix}
                  title={title}
                  items={w.pages.filter((item) => item.name.startsWith(prefix))}
                />
              ))}
            </div>
            <p className="mb-0 mt-5 text-xs text-ink-mute">
              {l('Обновлено', 'Updated')}: {time(w.generatedAt)}
            </p>
          </>
        )}
      </Panel>
      <Panel
        title={l('Заявки', 'Requests')}
        note={l(
          'Источник: БД платформы. Статусы отражают отметки участников, а не независимо подтверждённое время общения.',
          'Source: platform database. Statuses reflect participant updates, not independently verified contact times.',
        )}
      >
        {requests.loading && <p role="status">{l('Загружаем заявки…', 'Loading requests…')}</p>}
        {requests.error && (
          <p role="alert" className="text-sm text-danger">
            {l('Не удалось загрузить аналитику заявок', 'Could not load request analytics')}
          </p>
        )}
        {r && (
          <div className="space-y-7">
            <div>
              <h3 className="mb-2 mt-0 text-base font-semibold">
                {l('Динамика заявок', 'Requests over time')}
              </h3>
              <p className="text-sm text-ink-mute">
                {l(
                  'Создания и зафиксированные переходы в завершение/отказ за каждый день. Завершённая заявка могла быть создана раньше выбранного периода.',
                  'Creations and recorded completion/decline transitions each day. A completed request may have been created before the selected period.',
                )}
              </p>
              <Chart
                title={l('Динамика заявок', 'Requests over time')}
                data={r.daily}
                lines={[
                  { key: 'created', label: l('Созданы', 'Created') },
                  { key: 'done', label: l('Завершены', 'Completed') },
                  { key: 'declined', label: l('Отказы', 'Declined') },
                ]}
              />
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand-cobalt">
                  {l('Числа на графике', 'Chart data')}
                </summary>
                <div className="mt-3">
                  <Table
                    title={l('Динамика заявок', 'Requests over time')}
                    headers={[
                      l('Дата', 'Date'),
                      l('Созданы', 'Created'),
                      l('Завершены', 'Completed'),
                      l('Отказы', 'Declined'),
                    ]}
                    rows={r.daily.map((item) => [
                      item.date,
                      item.created,
                      item.done,
                      item.declined,
                    ])}
                  />
                </div>
              </details>
            </div>
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mt-0 text-base font-semibold">
                  {l('Где заявки сейчас', 'Where requests are now')}
                </h3>
                <p className="text-sm text-ink-mute">
                  {l(
                    'Каждая заявка показана только в одном текущем статусе. Учитываем заявки, созданные за выбранный период.',
                    'Each request appears in its current status only. Includes requests created in the selected period.',
                  )}
                </p>
                <Chart
                  title={l('Где заявки сейчас', 'Where requests are now')}
                  data={r.statuses.map((item) => ({
                    label: status(item.status),
                    count: item.count,
                  }))}
                  lines={[{ key: 'count', label: l('Заявки', 'Requests') }]}
                  horizontal
                />
                <Table
                  title={l('Распределение статусов', 'Status distribution')}
                  headers={[l('Статус', 'Status'), l('Заявки', 'Requests')]}
                  rows={r.statuses.map((item) => [status(item.status), item.count])}
                />
              </div>
              <div>
                <h3 className="mt-0 text-base font-semibold">
                  {l('До каких этапов дошли заявки', 'How far requests have progressed')}
                </h3>
                {r.historyCoverage.eligible === 0 ? (
                  <div className="rounded-card border border-line bg-surface p-5">
                    <p className="my-0 font-semibold text-ink">
                      {l('История ещё накапливается', 'History is still accumulating')}
                    </p>
                    <p className="mb-0 mt-2 text-sm text-ink-mute">
                      {l(
                        'За выбранный период пока нет заявок с полной историей. Воронка появится, когда поступят новые заявки после начала записи истории. Старые заявки остаются в блоке слева.',
                        'No requests in this period have complete history yet. The funnel appears for new requests created after history recording began. Older requests remain in the current-status block.',
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ink-mute">
                      {l(
                        `В расчёте: ${r.historyCoverage.eligible} из ${r.historyCoverage.total} заявок — только с полной историей. Одна заявка учитывается на каждом этапе, которого достигла, даже если уже завершена.`,
                        `Included: ${r.historyCoverage.eligible} of ${r.historyCoverage.total} requests — complete history only. A request counts at every stage it reached, even after completion.`,
                      )}
                    </p>
                    <RequestProgressFunnel stages={r.funnel} total={r.historyCoverage.eligible} />
                    <Table
                      title={l('Достигнутые этапы', 'Reached stages')}
                      headers={[
                        l('Этап', 'Stage'),
                        l('Заявки', 'Requests'),
                        l('От созданных', 'Of created requests'),
                      ]}
                      rows={r.funnel.map((item, index) => [
                        `${index + 1}. ${item.status === 'pending' ? l('Созданы', 'Created') : item.status === 'contacted' ? l('Дошли до контакта', 'Reached contact') : item.status === 'working' ? l('Дошли до работы', 'Reached work') : l('Завершены', 'Completed')}`,
                        item.count,
                        `${format((item.count / r.historyCoverage.eligible) * 100)}%`,
                      ])}
                    />
                    <p className="mb-0 mt-3 text-xs text-ink-mute">
                      {l(
                        'Процент — от заявок с полной историей, а не от всех заявок. Администратор может пропускать этапы; это не всегда строгая последовательность.',
                        'Percentages use only requests with complete history, not all requests. Administrators can skip stages; progression is not always linear.',
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-ink-mute">
                {l(
                  'Время между отметками, только завершённые интервалы. Незавершённые заявки не считаются завершёнными наблюдениями. Медиана — середина наблюдений; p90 — срок, в который уложились 90% наблюдений.',
                  'Time between recorded updates, completed intervals only. Open requests are not completed samples. Median is the midpoint; p90 covers 90% of samples.',
                )}
              </p>
              <Table
                title={l('Время в статусах', 'Time in statuses')}
                headers={[
                  l('Этап', 'Stage'),
                  l('Медиана, ч', 'Median, h'),
                  'p90, ' + l('ч', 'h'),
                  l('Наблюдения', 'Samples'),
                ]}
                rows={r.durations.map((item) => [
                  status(item.stage),
                  item.medianHours === null ? '—' : format(item.medianHours),
                  item.p90Hours === null ? '—' : format(item.p90Hours),
                  item.sampleCount,
                ])}
              />
            </div>
            <Table
              title={l('По менторам', 'By mentor')}
              headers={[
                l('Ментор', 'Mentor'),
                l('Созданы', 'Created'),
                l('Новые', 'New'),
                l('Контакт', 'Contact'),
                l('В работе', 'Working'),
                l('Завершены', 'Done'),
                l('Отказы', 'Declined'),
              ]}
              rows={r.mentors.map((item) => [
                mentorLink(item.id, item.name),
                item.created,
                item.pending,
                item.contacted,
                item.working,
                item.done,
                item.declined,
              ])}
              exportRows={r.mentors.map((item) => [
                item.name,
                item.created,
                item.pending,
                item.contacted,
                item.working,
                item.done,
                item.declined,
              ])}
            />
            <Table
              title={l('Причины отказов', 'Decline reasons')}
              headers={[l('Причина', 'Reason'), l('Заявки', 'Requests')]}
              rows={r.declineReasons.map((item) => [reason(item.reason), item.count])}
            />
            <p className="mb-0 text-xs text-ink-mute">
              {l('История собирается с', 'History collected since')} {time(r.historyStartedAt)}.{' '}
              {l(
                'Отсутствующие прошлые переходы не восстановлены.',
                'Missing past transitions have not been reconstructed.',
              )}{' '}
              {l('Обновлено', 'Updated')}: {time(r.generatedAt)}.
            </p>
          </div>
        )}
      </Panel>
      <Panel
        title={l('Требуют внимания', 'Need attention')}
        note={l(
          'Нет отметки об обработке более 3 дней',
          'No processing update for more than 3 days',
        )}
      >
        <p className="mt-0 text-sm text-ink-mute">
          {l(
            'Все новые заявки, созданные не менее 72 часов назад и всё ещё в статусе «Новая», независимо от выбранного периода. Это повод проверить статус, а не доказательство отсутствия общения.',
            'All requests created at least 72 hours ago and still New, regardless of selected dates. This is a prompt to check the status, not proof that no contact occurred.',
          )}
        </p>
        {r ? (
          <Table
            title={l('Необработанные заявки по менторам', 'Pending requests by mentor')}
            headers={[
              l('Ментор', 'Mentor'),
              l('Заявки', 'Requests'),
              l('Самая ранняя создана', 'Oldest created'),
            ]}
            rows={r.attention.map((item) => [
              mentorLink(item.mentorId, item.mentorName),
              item.count,
              time(item.oldestCreatedAt),
            ])}
            exportRows={r.attention.map((item) => [
              item.mentorName,
              item.count,
              time(item.oldestCreatedAt),
            ])}
          />
        ) : (
          <p className="text-sm text-ink-mute">
            {l(
              'Данные появятся после загрузки аналитики заявок.',
              'Data appears when request analytics loads.',
            )}
          </p>
        )}
      </Panel>
    </div>
  )
}
