import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createTranslator, intlLocale, normalizeLocale } from './core'
import type { Locale, Messages } from './core'

// Standalone components retain the upstream English baseline; the application
// always supplies the URL locale explicitly, with Russian as the default.
const LocaleContext = createContext<Locale>('en')

export function I18nProvider({ locale, children }: { locale?: string; children: ReactNode }): JSX.Element {
  return <LocaleContext.Provider value={normalizeLocale(locale)}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale { return useContext(LocaleContext) }

export function useTranslation<T extends Messages>(messages: T) {
  const locale = useLocale()
  const t = useMemo(() => createTranslator(locale, messages), [locale, messages])
  return { t, locale, intlLocale: intlLocale(locale) }
}
