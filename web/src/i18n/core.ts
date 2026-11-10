export type Locale = 'ru' | 'en'
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }
export type Message = string | PluralMessage
export type Messages = Record<string, { en: Message; ru?: Message }>
export type Values = Record<string, string | number>
export const locales = ['ru', 'en'] as const
export const defaultLocale: Locale = 'ru'
export const intlLocale = (locale: Locale): string => locale === 'ru' ? 'ru-RU' : 'en-US'

export function normalizeLocale(value?: string): Locale {
  return value?.toLowerCase().split('-')[0] === 'en' ? 'en' : defaultLocale
}

export function createTranslator<T extends Messages>(locale: Locale, messages: T): (key: keyof T & string, values?: Values) => string {
  return (key, values = {}) => {
    const entry = messages[key]
    if (!entry) return key
    const message = entry[locale] ?? entry.en
    const template = typeof message === 'string' ? message : message[new Intl.PluralRules(intlLocale(locale)).select(Number(values.count ?? 0))] ?? message.other
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] === undefined ? placeholder : String(values[name]))
  }
}

export function localizedPath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const clean = path.replace(/^\/en(?=\/|[?#]|$)/, '') || '/'
  return locale === 'ru' ? clean : `/en${clean === '/' ? '' : clean}`
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value)
}

export function formatDate(locale: Locale, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(value))
}
