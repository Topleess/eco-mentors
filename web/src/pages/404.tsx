import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/public-pages'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect } from 'react'
import { Footer, MetaHeader, NavHeader } from '@/components'
import analytics from '@/lib/analytics'
import { pageTitle } from '@/config/seo'

export default function NotFound(): JSX.Element {
  const { t } = useTranslation(messages)
  const title = pageTitle(t('404PageNotFound'))

  useEffect(() => {
    analytics.event(analytics.events.NOT_FOUND_VIEWED, {
      path: window.location.pathname,
    })
  }, [])

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <MetaHeader customTitle={t('404PageNotFound')} noIndex />

      <NavHeader />

      <main className="flex flex-col items-center px-5 py-16 text-center sm:py-24">
        {/* Brand glyph: ring + cobalt stroke + mint node */}
        <div aria-hidden="true" className="relative h-[72px] w-[72px]">
          <div className="m-[7px] h-[58px] w-[58px] rounded-full border-8 border-brand-navy" />
          <div className="absolute -left-3 bottom-2.5 h-2 w-[34px] -rotate-[35deg] rounded-full bg-brand-cobalt" />
          <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-brand-mint" />
        </div>

        <p className="meta-mono mb-0 mt-6 text-ink-mute">{t('error404')}</p>

        <h1 className="mt-2 text-3xl sm:text-[40px]">{t('pageNotFound')}</h1>

        <p className="mb-0 mt-3 max-w-[420px] text-[15px] leading-[1.6] text-ink-soft">
          {t('looksLikeThisPageDoesnTExist')}</p>

        <Link href="/" className="button-secondary mt-8">
          {t('backToAllMentors')}</Link>
      </main>

      <Footer />
    </>
  )
}
