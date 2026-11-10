import { createTranslator, normalizeLocale, localizedPath, formatNumber, formatDate } from '@/i18n/core'

const messages = {
  greeting: { en: 'Hello, {name}!', ru: 'Здравствуйте, {name}!' },
  count: { en: { one: '{count} mentor', other: '{count} mentors' }, ru: { one: '{count} ментор', few: '{count} ментора', many: '{count} менторов', other: '{count} ментора' } },
  fallback: { en: 'English fallback' },
}

describe('locale and translation primitives', () => {
  it('defaults unknown languages to Russian and accepts RU/EN region codes', () => {
    expect(normalizeLocale(undefined)).toBe('ru')
    expect(normalizeLocale('de')).toBe('ru')
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('ru-RU')).toBe('ru')
  })
  it('interpolates plain text without interpreting user HTML', () => {
    expect(createTranslator('ru', messages)('greeting', { name: '<b>Анна</b>' })).toBe('Здравствуйте, <b>Анна</b>!')
  })
  it.each([[1, '1 ментор'], [2, '2 ментора'], [5, '5 менторов'], [11, '11 менторов'], [21, '21 ментор'], [22, '22 ментора'], [0, '0 менторов']])('uses Russian plurals for %s', (count, result) => {
    expect(createTranslator('ru', messages)('count', { count })).toBe(result)
  })
  it('uses English plurals and English fallback for untranslated entries', () => {
    expect(createTranslator('en', messages)('count', { count: 2 })).toBe('2 mentors')
    expect(createTranslator('ru', messages)('fallback')).toBe('English fallback')
  })
  it('keeps query strings, hashes and stable dynamic slugs when localizing URLs', () => {
    expect(localizedPath('/mentor/alex?mode=preview#about', 'en')).toBe('/en/mentor/alex?mode=preview#about')
    expect(localizedPath('/en/mentor/alex?mode=preview#about', 'ru')).toBe('/mentor/alex?mode=preview#about')
    expect(localizedPath('/', 'en')).toBe('/en')
  })
  it('formats dates and numbers using the active locale', () => {
    expect(formatNumber('ru', 1234)).toBe(new Intl.NumberFormat('ru-RU').format(1234))
    expect(formatDate('ru', '2026-10-19', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })).toContain('октября')
  })
})
