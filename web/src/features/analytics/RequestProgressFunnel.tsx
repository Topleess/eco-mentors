import { ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip } from 'recharts'
import { useLocale } from '@/i18n'

interface Stage {
  status: string
  count: number
}
export function RequestProgressFunnel({
  stages,
  total,
}: {
  stages: Stage[]
  total: number
}): JSX.Element {
  const ru = useLocale() === 'ru'
  const labels: Record<string, string> = ru
    ? {
        pending: 'Созданы',
        contacted: 'Дошли до контакта',
        working: 'Дошли до работы',
        done: 'Завершены',
      }
    : {
        pending: 'Created',
        contacted: 'Reached contact',
        working: 'Reached work',
        done: 'Completed',
      }
  const fills = ['#2F5EFF', '#132A52', '#0E7A70', '#132A52']
  const number = new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 })
  const data = stages.map((stage, index) => ({
    ...stage,
    name: `${index + 1}. ${labels[stage.status] || stage.status}`,
    fill: fills[index % fills.length],
    valueLabel: `${stage.status === 'contacted' ? (ru ? 'Контакт' : 'Contact') : stage.status === 'working' ? (ru ? 'В работе' : 'Work') : labels[stage.status] || stage.status}: ${number.format(stage.count)}`,
  }))
  return (
    <div
      role="group"
      aria-label={ru ? 'Воронка заявок с полной историей' : 'Full-history request funnel'}
      className="mb-5 min-w-0"
      style={{ height: 270 }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 700, height: 270 }}
      >
        <FunnelChart accessibilityLayer margin={{ top: 12, right: 20, bottom: 12, left: 20 }}>
          <Tooltip
            formatter={(value, name) => [
              `${number.format(Number(value))} · ${number.format(total > 0 ? (Number(value) / total) * 100 : 0)}%`,
              name,
            ]}
          />
          <Funnel
            data={data}
            dataKey="count"
            nameKey="name"
            isAnimationActive={false}
            lastShapeType="rectangle"
            stroke="#ffffff"
            strokeWidth={2}
          >
            <LabelList
              dataKey="valueLabel"
              position="center"
              fill="#ffffff"
              fontSize={13}
              fontWeight={600}
              pointerEvents="none"
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  )
}
