import { analyticsPreset, validAnalyticsDates, analyticsCsv } from '@/features/analytics/model'

it('uses Moscow dates across the UTC midnight boundary and inclusive presets', () => {
  expect(analyticsPreset(7, new Date('2026-11-09T22:00:00Z'))).toEqual({
    startDate: '2026-11-04',
    endDate: '2026-11-10',
  })
  expect(validAnalyticsDates('2026-02-30', '2026-03-01')).toBe(false)
  expect(validAnalyticsDates('2026-11-10', '2026-11-01')).toBe(false)
  expect(validAnalyticsDates('2026-11-01', '2026-11-10')).toBe(true)
})
it('exports quoted UTF-8 tables and prevents spreadsheet formula injection', () => {
  const csv = analyticsCsv(
    ['Имя', 'Число'],
    [
      ['=HYPERLINK("secret")', 2],
      ['Текст, запятая', 0],
    ],
  )
  expect(csv.startsWith('\uFEFF')).toBe(true)
  expect(csv).toContain('"\'=HYPERLINK(""secret"")"')
  expect(csv).toContain('"Текст, запятая","0"')
})
