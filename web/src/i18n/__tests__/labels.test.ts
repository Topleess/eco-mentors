import { translateLabel } from '@/i18n/labels'
import filters from '@/config/filters'

describe('display-only localized labels', () => {
  it('translates categories, stored tags, prices and experience without changing canonical values', () => {
    expect(translateLabel('ru', 'Engineering')).toBe('Разработка')
    expect(translateLabel('ru', 'Backend')).toBe('Бэкенд')
    expect(translateLabel('ru', 'Free')).toBe('Бесплатно')
    expect(translateLabel('ru', '5-10 years')).toBe('5–10 лет')
    expect(filters.tags).toContain('Backend')
    expect(Object.keys(filters.byPrice)).toContain('Free')
  })
  it('preserves English and unknown user-created labels', () => {
    expect(translateLabel('en', 'Backend')).toBe('Backend')
    expect(translateLabel('ru', 'Собственная специализация')).toBe('Собственная специализация')
    expect(translateLabel('ru', '$50')).toBe('$50')
  })
})
