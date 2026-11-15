import fs from 'node:fs'
import path from 'node:path'
import filters from '@/config/filters'
import { ALL_TAGS, TAG_PAGES, tagBySlug, tagPath, isKnownTag } from '@/config/tags'
import { translateLabel } from '@/i18n/labels'

const groups = [
  ['Экология предприятий', ['Производственный экологический контроль', 'Экологическая отчётность']],
  ['Природоохранные проекты', ['Оценка воздействия на окружающую среду', 'Экологическое проектирование']],
  ['Климат', ['Углеродный учёт', 'Климатические проекты']],
  ['ESG и устойчивое развитие', ['Нефинансовая отчётность', 'Зелёные финансы']],
  ['Карьера и трудоустройство', ['Выбор карьерной траектории', 'Резюме и собеседования']],
  ['Исследования', ['Экологические исследования', 'ГИС и пространственные данные']],
] as const

test('offers exactly the client ecological groups and canonical tags, without IT aliases', () => {
  expect(filters.categories).toEqual(groups.map(([label, tags]) => ({ label, tags: [...tags] })))
  expect(filters.tags).toEqual(groups.flatMap(([, tags]) => [...tags]))
  expect(ALL_TAGS).toEqual(filters.tags)
  expect(isKnownTag('Backend')).toBe(false)
  for (const tag of ALL_TAGS) {
    expect(tagBySlug(TAG_PAGES[tag].slug)).toBe(tag)
    expect(tagPath(tag)).toBe(`/mentors/${TAG_PAGES[tag].slug}`)
    expect(translateLabel('ru', tag)).toBe(tag)
    expect(translateLabel('en', tag)).not.toBe(tag)
  }
  expect(new Set(ALL_TAGS.map(tag => TAG_PAGES[tag].slug)).size).toBe(12)
})

test('local synthetic fixtures select an ecological tag without reclassifying existing rows', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), '../infra/local/seed.sql'), 'utf8')
  expect(sql).toContain("tags.name = 'Экологическая отчётность'")
  expect(sql).not.toContain("tags.name = 'Backend'")
  expect(sql).toContain('NOT EXISTS (SELECT 1 FROM mentor_tags existing WHERE existing.mentor_id = mentor.id)')
})

test('adds the same canonical database seeds without remapping or deleting legacy data', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), '../api/migrations/000019_ecological_tags.up.sql'), 'utf8')
  expect(sql.startsWith('-- phase: expand\n')).toBe(true)
  for (const tag of filters.tags) expect(sql).toContain(`'${tag}'`)
  expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\s/i)
  expect(sql).not.toMatch(/INSERT INTO mentor_tags/i)
})
