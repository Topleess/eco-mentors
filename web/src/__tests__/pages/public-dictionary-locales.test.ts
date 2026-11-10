import { createTranslator } from '@/i18n/core'
import { messages } from '@/i18n/messages/public-pages'
import { ALL_TAGS, TAG_PAGES } from '@/config/tags'

it('keeps a Russian and English translation for every public message', () => {
  for (const entry of Object.values(messages)) {
    expect(entry.en).toBeTruthy()
    expect(entry.ru).toBeTruthy()
  }
})

it('translates every topic description without changing the English original', () => {
  for (const tag of ALL_TAGS) {
    expect(createTranslator('en', messages)(tag)).toBe(TAG_PAGES[tag].blurb)
    expect(createTranslator('ru', messages)(tag)).toMatch(/[А-Яа-я]/)
  }
})

it.each([[1,'1 ментор'],[2,'2 ментора'],[5,'5 менторов'],[21,'21 ментор'],[22,'22 ментора'],[111,'111 менторов']])('uses Russian mentor plurals for %s', (count, expected) => {
  expect(createTranslator('ru', messages)('mentorCount', {count})).toBe(expected)
})

it('uses a natural Russian experience label for range values', () => {
  expect(createTranslator('ru', messages)('experienceYears', {count:'10+'})).toBe('10+ лет')
})
