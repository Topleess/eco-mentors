import type { Locale } from './core'
import { messages } from './messages/admin'

/** Translate known interface errors at render time; preserve unknown server details. */
export function adminMessage(locale: Locale, value: string): string {
  const message = Object.values(messages).find((entry) => entry.en === value || entry.ru === value)
  return message ? message[locale] : value
}
