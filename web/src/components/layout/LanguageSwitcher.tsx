import { useState } from 'react'
import { useRouter } from 'next/compat/router'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/common'
import type { Locale } from '@/i18n/core'

export default function LanguageSwitcher(): JSX.Element | null {
  const router = useRouter()
  const { t, locale } = useTranslation(messages)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  if (!router) return null

  async function changeLanguage(next: Locale): Promise<void> {
    if (!router || next === locale) return
    setPending(true)
    setError(false)
    try {
      const changed = await router.replace({ pathname: router.pathname, query: router.query }, router.asPath, { locale: next, shallow: true, scroll: false })
      if (changed === false) return
      document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex shrink-0 flex-col gap-1">
      <select
        aria-label={t('language')}
        value={locale}
        disabled={pending}
        onChange={(event) => void changeLanguage(event.target.value as Locale)}
        className="rounded-field border border-line bg-white py-2 pl-2 pr-7 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand-cobalt"
      >
        <option value="ru" lang="ru">RU</option>
        <option value="en" lang="en">EN</option>
      </select>
      {error && <span role="alert" className="max-w-40 text-xs text-danger">{t('languageFailed')}</span>}
    </span>
  )
}
