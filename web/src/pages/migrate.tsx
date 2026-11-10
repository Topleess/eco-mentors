import { useTranslation } from '@/i18n'
import { messages, translateFormError } from '@/i18n/messages/forms'
import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { pageTitle } from '@/config/seo'
import { GENERIC_SUBMIT_ERROR, upstreamErrorMessage } from '@/lib/upstream-error'
import type { ScheduleMigrationResponse } from '@/types'

type SubmitState = 'idle' | 'loading' | 'scheduled' | 'already' | 'error'

export default function Migrate(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const router = useRouter()
  const title = pageTitle(t('migrateTitle'))

  const rawSlug = router.query.slug
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? '').trim().toLowerCase()

  const [captchaToken, setCaptchaToken] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState(GENERIC_SUBMIT_ERROR)
  const turnstileRef = useRef<TurnstileInstance>(null)

  // The token is single-use and already spent upstream, so re-run the widget or
  // the button stays enabled on a stale token that siteverify will reject. state
  // goes 'error' -> 'loading' -> 'error', so this re-fires per failure.
  useEffect(() => {
    if (state === 'error') {
      turnstileRef.current?.reset()
      setCaptchaToken('')
    }
  }, [state])

  const handleSchedule = async (): Promise<void> => {
    setState('loading')
    try {
      const res = await fetch('/api/schedule-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, captchaToken }),
      })
      const data = (await res.json().catch(() => null)) as ScheduleMigrationResponse | null
      if (res.ok && data?.success) {
        setState(data.alreadyScheduled ? 'already' : 'scheduled')
      } else {
        // The proxy forwards the upstream 4xx body, so name the actual reason —
        // a spent captcha or a slug that is not a getmentor.dev profile.
        setErrorMessage(upstreamErrorMessage(res.status, data))
        setState('error')
      }
    } catch {
      setErrorMessage(GENERIC_SUBMIT_ERROR)
      setState('error')
    }
  }

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      {/* Personal opt-in links only — keep out of search results */}
      <MetaHeader customTitle={t('migrateTitle')} noIndex />

      <NavHeader />

      <Section id="migrate">
        <div className="mx-auto max-w-2xl pt-4 sm:pt-10">
          <p className="meta-mono my-0 text-ink-mute">getmentor.dev → openmentor.io</p>
          <h1 className="mt-3 text-[26px] leading-[1.08] sm:text-[34px]">{' '}{t('migrateHeading')}{' '}</h1>

          {router.isReady && !slug && (
            <div className="mt-8 rounded-panel border border-line bg-white p-6 sm:p-8">
              <p className="mt-0">{' '}{t('migrationMissingSlug')}{' '}</p>
              <p>{' '}{t('migrationPersonalLink')}{' '}{' '}
                <code>?slug=your-profile</code>{' '}{t('migrationLostLink')}{' '}{' '}
                <a className="link" href="mailto:hello@openmentor.io">
                  hello@openmentor.io
                </a>
                .
              </p>
            </div>
          )}

          {router.isReady && slug && (state === 'idle' || state === 'loading' || state === 'error') && (
            <div className="mt-8 rounded-panel border border-line bg-white p-6 sm:p-8">
              <p className="mt-0">{' '}{t('migrationProfileIntro')}{' '}</p>
              <p className="rounded-field border border-line bg-surface px-4 py-3 font-mono text-sm font-medium text-ink">
                getmentor.dev/mentor/{slug}
              </p>

              <p className="font-medium text-ink">{' '}{t('migrationSteps')}{' '}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
                <li>{' '}{t('migrationTranslation')}{' '}</li>
                <li>{' '}{t('migrationCurrency')}{' '}</li>
                <li>{' '}{t('migrationPhotoTags')}{' '}</li>
                <li>{' '}{t('migrationVisibilityPrefix')}{' '}<strong>{' '}{t('migrationVisibilityStrong')}{' '}</strong>{' '}{t('migrationVisibilitySuffix')}{' '}</li>
                <li>{' '}{t('migrationEmail')}{' '}</li>
              </ul>
              <p className="text-sm text-ink-soft">{' '}{t('migrationUnaffected')}{' '}</p>

              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
                onSuccess={setCaptchaToken}
                onExpire={(): void => setCaptchaToken('')}
                options={{ language: locale }}
              />

              {state === 'error' && (
                <div
                  role="alert"
                  className="mt-4 rounded-field border-[1.5px] border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
                >
                  {translateFormError(locale, errorMessage)}{' '}{t('migrationSupport')}{' '}{' '}
                  <a className="link" href="mailto:hello@openmentor.io">
                    hello@openmentor.io
                  </a>
                  .
                </div>
              )}

              <button
                className="button mt-6"
                type="button"
                onClick={handleSchedule}
                disabled={state === 'loading' || !captchaToken}
              >
                {state === 'loading' ? 'Scheduling…' : t('scheduleMigration')}
              </button>
            </div>
          )}

          {state === 'scheduled' && (
            <div className="mt-8 animate-rise-in rounded-panel border border-line bg-white p-6 shadow-card-hover sm:p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint">
                <svg width="16" height="13" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                  <path
                    d="M1 4.5L4 7.5L10 1"
                    stroke="#161A20"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="mt-0 font-display text-lg font-extrabold uppercase tracking-[-0.01em] text-ink">{' '}{t('migrationScheduled')}{' '}</p>
              <p>{' '}{t('migrationScheduledPrefix')}{' '}<span className="font-medium">{slug}</span>{' '}{t('migrationScheduledSuffix')}{' '}</p>
              <p className="text-sm text-ink-soft">{' '}{t('migrationChangedMind')}{' '}</p>
              <Link href="/" className="link">{' '}{t('browseMeanwhile')}{' '}</Link>
            </div>
          )}

          {state === 'already' && (
            <div className="mt-8 animate-rise-in rounded-panel border border-line bg-white p-6 sm:p-8">
              <p className="mt-0 font-display text-lg font-extrabold uppercase tracking-[-0.01em] text-ink">{' '}{t('migrationAlready')}{' '}</p>
              <p>
                <span className="font-medium">{slug}</span>{' '}{t('migrationAlreadySuffix')}{' '}</p>
              <p className="text-sm text-ink-soft">{' '}{t('migrationNoEmail')}{' '}{' '}
                <a className="link" href="mailto:hello@openmentor.io">
                  hello@openmentor.io
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </Section>

      <Footer />
    </>
  )
}
