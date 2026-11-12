import filters from '@/config/filters'
import type { MentorTag } from '@/types'

export interface TagPage {
  /**
   * URL segment for /mentors/<slug>. PERMANENT once shipped — changing one
   * retires an indexed URL, so rename the label rather than the slug.
   */
  slug: string
  /**
   * What this expertise covers, in one line. Feeds the landing page intro and
   * its meta description, so it has to read as a sentence, not a keyword list.
   */
  blurb: string
}

/**
 * Landing-page metadata for every mentor tag.
 *
 * Typed `Record<MentorTag, TagPage>` deliberately: adding a tag to the union
 * without giving it a slug fails the type check. That is the same drift guard
 * D30 put on the taxonomy itself, after `Security` shipped in the UI but not
 * the database and was silently dropped.
 */
export const TAG_PAGES: Record<MentorTag, TagPage> = {
  'Производственный экологический контроль': {
    slug: 'environmental-monitoring',
    blurb: 'Plan and carry out environmental monitoring at industrial facilities.',
  },
  'Экологическая отчётность': {
    slug: 'environmental-reporting',
    blurb: 'Prepare environmental reports and organise the data they require.',
  },
  'Оценка воздействия на окружающую среду': {
    slug: 'impact-assessment',
    blurb: 'Assess how planned activities may affect the environment.',
  },
  'Экологическое проектирование': {
    slug: 'environmental-design',
    blurb: 'Develop environmental project documentation and protection measures.',
  },
  'Углеродный учёт': {
    slug: 'carbon-accounting',
    blurb: 'Measure greenhouse gas emissions and prepare carbon accounts.',
  },
  'Климатические проекты': {
    slug: 'climate-projects',
    blurb: 'Develop and assess projects that reduce emissions or support climate adaptation.',
  },
  'Нефинансовая отчётность': {
    slug: 'non-financial-reporting',
    blurb: 'Prepare non-financial reports on environmental and social performance.',
  },
  'Зелёные финансы': {
    slug: 'green-finance',
    blurb: 'Understand financing for environmental and sustainable development projects.',
  },
  'Выбор карьерной траектории': {
    slug: 'career-path',
    blurb: 'Explore environmental careers and choose your next professional step.',
  },
  'Резюме и собеседования': {
    slug: 'cv-interviews',
    blurb: 'Prepare a CV and practise interviews for environmental roles.',
  },
  'Экологические исследования': {
    slug: 'environmental-research',
    blurb: 'Design environmental studies, collect evidence and interpret results.',
  },
  'ГИС и пространственные данные': {
    slug: 'gis',
    blurb: 'Work with geographic information systems and analyse spatial environmental data.',
  },

}

/** Every tag, in taxonomy order. */
export const ALL_TAGS = Object.keys(TAG_PAGES) as MentorTag[]

const BY_SLUG = new Map<string, MentorTag>(
  ALL_TAGS.map((tag) => [TAG_PAGES[tag].slug, tag] as const)
)

/** Resolve a /mentors/<slug> segment back to its tag, or null if unknown. */
export function tagBySlug(slug: string): MentorTag | null {
  return BY_SLUG.get(slug) ?? null
}

/** The public URL path for a tag's landing page. */
export function tagPath(tag: MentorTag): string {
  return `/mentors/${TAG_PAGES[tag].slug}`
}

/**
 * Does this string name a tag with a landing page?
 *
 * Needed because tags reach the UI as plain `string`: `mentor.tags` comes from
 * the API, and `FilterCategory.tags` is declared `string[]`. A tag that drifted
 * out of the taxonomy (a rename, or a DB row the union no longer lists — the
 * failure mode D30 was written about) must render as plain text, never as a
 * link to a page that would 404.
 */
export function isKnownTag(tag: string): tag is MentorTag {
  return Object.prototype.hasOwnProperty.call(TAG_PAGES, tag)
}

/**
 * The catalog's six taxonomy groups, narrowed to tags that actually have a
 * landing page. Single source for every "browse by topic" block, so the type
 * guard lives here rather than being repeated at each call site.
 */
export const TAG_CATEGORIES: { label: string; tags: MentorTag[] }[] = filters.categories.map(
  (category) => ({
    label: category.label,
    tags: category.tags.filter(isKnownTag),
  })
)
