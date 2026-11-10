import { createTranslator } from '@/i18n/core'
import { messages } from '@/i18n/messages/mentor'
import { STATUS_LABELS } from '@/types'
import type { RequestStatus } from '@/types'
import { intlLocale } from '@/i18n/core'
import type { Locale } from '@/i18n/core'

/**
 * Utility functions for Mentor Admin
 */

/**
 * Format date (e.g., "Jul 7, 2026")
 */
export function formatDate(dateString: string, locale: Locale = 'en'): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format date with time (e.g., "Jul 7, 2026, 10:30 AM")
 */
export function formatDateTime(dateString: string, locale: Locale = 'en'): string {
  const date = new Date(dateString)
  return date.toLocaleString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Pluralize a time unit and append "ago" (e.g., "2 days ago")
 */
function timeAgo(count: number, unit: Intl.RelativeTimeFormatUnit, locale: Locale): string {
  if (locale === 'ru') return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'always' }).format(-count, unit)
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

/**
 * Format relative time (e.g., "just now", "5 minutes ago", "yesterday")
 */
export function formatRelativeTime(dateString: string, locale: Locale = 'en'): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes < 1) return locale === 'ru' ? 'только что' : 'just now'
      return timeAgo(diffMinutes, 'minute', locale)
    }
    return timeAgo(diffHours, 'hour', locale)
  }

  if (diffDays === 1) return locale === 'ru' ? 'вчера' : 'yesterday'
  if (diffDays < 7) return timeAgo(diffDays, 'day', locale)
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return timeAgo(weeks, 'week', locale)
  }

  return formatDate(dateString, locale)
}

/**
 * Compact mono timestamp for request rows (design 07: "2H AGO", "1D AGO",
 * "MAR 2026"). Meant to be rendered in the .meta-mono style (CAPS).
 */
export function formatCompactTime(dateString: string, locale: Locale = 'en'): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) return locale === 'ru' ? 'СЕЙЧАС' : 'NOW'
  if (diffMinutes < 60) return locale === 'ru' ? `${diffMinutes} МИН НАЗАД` : `${diffMinutes}M AGO`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return locale === 'ru' ? `${diffHours} Ч НАЗАД` : `${diffHours}H AGO`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return locale === 'ru' ? `${diffDays} ДН НАЗАД` : `${diffDays}D AGO`
  if (diffDays < 30) return locale === 'ru' ? `${Math.floor(diffDays / 7)} НЕД НАЗАД` : `${Math.floor(diffDays / 7)}W AGO`

  return date
    .toLocaleDateString(intlLocale(locale), { month: 'short', year: 'numeric' })
    .toUpperCase()
}

/**
 * First letters of the first two name words ("Daria Kovalenko" -> "DK").
 */
export function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function statusLabel(status: RequestStatus, locale: Locale = 'en'): string {
  if (locale === 'en') return STATUS_LABELS[status] || status
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)
    ? createTranslator(locale, messages)(status as keyof typeof messages)
    : status
}

/** Translate known service messages only at the display boundary. */
export function mentorMessage(locale: Locale, value: string): string {
  const entry = Object.values(messages).find((message) => message.en === value || message.ru === value)
  if (entry) return entry[locale]
  return locale === 'ru' ? messages.somethingWentWrongPleaseTryAgain.ru : value
}
