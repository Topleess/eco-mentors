import type { Messages } from '@/i18n/core'

export const messages = {
  searchPlaceholder: { en: 'Role, skill, or company…', ru: 'Роль, навык или компания…' },
  searchLabel: { en: 'Search mentors by role, skill, or company', ru: 'Поиск менторов по роли, навыку или компании' },
  sort: { en: 'SORT', ru: 'СОРТИРОВКА' },
  relevance: { en: 'Relevance', ru: 'По релевантности' },
  sessions: { en: 'Most sessions', ru: 'Больше встреч' },
  newest: { en: 'Newest', ru: 'Сначала новые' },
  showMore: { en: 'Show more mentors', ru: 'Показать ещё менторов' },
  newMentor: { en: 'NEW', ru: 'НОВЫЙ' },
  free: { en: 'FREE', ru: 'БЕСПЛАТНО' },
  negotiable: { en: 'NEGOTIABLE', ru: 'ПО ДОГОВОРЁННОСТИ' },
  cardExperience: { en: '{experience}Y EXP', ru: '{experience} ЛЕТ ОПЫТА' },
  sessionCount: {
    en: { one: '{count} SESSION', other: '{count} SESSIONS' },
    ru: { one: '{count} ВСТРЕЧА', few: '{count} ВСТРЕЧИ', many: '{count} ВСТРЕЧ', other: '{count} ВСТРЕЧИ' },
  },
  allMentors: { en: 'All mentors', ru: 'Все менторы' },
  experience: { en: 'Experience', ru: 'Опыт' },
  price: { en: 'Price', ru: 'Цена' },
} satisfies Messages
