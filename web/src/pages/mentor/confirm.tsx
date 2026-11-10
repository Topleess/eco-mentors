import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/forms'
import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { pageTitle } from '@/config/seo'
import analytics from '@/lib/analytics'
import type { ConfirmMentorEmailResponse } from '@/types'

type ConfirmState =
  | 'confirming'
  | 'success'
  | 'already'
  | 'invalid'
  | 'expired'
  | 'resending'
  | 'resent'
  | 'error'

export default function ConfirmMentorEmail(): JSX.Element {
  const { t } = useTranslation(messages)
  const router = useRouter()
  const title = pageTitle(t('confirmTitle'))

  const rawToken = router.query.token
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken ?? '').trim()

  const [state, setState] = useState<ConfirmState>('confirming')
  const confirmStarted = useRef(false)

  // SECURITY (M10): strip the one-time confirmation token from the address bar
  // so it isn't captured by telemetry or leaked via referrer. router.query.token
  // (and the derived `token`) stay intact because replaceState doesn't touch
  // Next's router state.
  useEffect(() => {
    if (!router.isReady) return
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [router.isReady])

  useEffect(() => {
    if (!router.isReady || confirmStarted.current) {
      return
    }
    confirmStarted.current = true

    // Page-view only — confirmation outcomes are tracked by the backend.
    analytics.event(analytics.events.MENTOR_CONFIRM_PAGE_VIEWED, {
      has_token: token.length > 0,
    })

    if (!token) {
      setState('invalid')
      return
    }

    const confirm = async (): Promise<void> => {
      try {
        const res = await fetch('/api/mentor/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await res.json()) as ConfirmMentorEmailResponse
        if (data.success) {
          setState(data.already ? 'already' : 'success')
        } else if (res.status === 410 || data.code === 'token_expired') {
          setState('expired')
        } else if (res.status === 400 || data.code === 'invalid_token') {
          setState('invalid')
        } else {
          setState('error')
        }
      } catch {
        setState('error')
      }
    }
    void confirm()
  }, [router.isReady, token])

  const handleResend = async (): Promise<void> => {
    setState('resending')
    try {
      const res = await fetch('/api/mentor/confirm-resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as ConfirmMentorEmailResponse
      if (data.success) {
        setState(data.already ? 'already' : 'resent')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  const supportLink = (
    <a className="link" href="mailto:hello@openmentor.io">
      hello@openmentor.io
    </a>
  )

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      {/* Personal confirmation links only — keep out of search results */}
      <MetaHeader customTitle={t('confirmTitle')} noIndex />

      <NavHeader />

      <Section id="confirm">
        <div className="mx-auto max-w-2xl pt-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{' '}{t('confirmTitle')}{' '}</h1>

          {state === 'confirming' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirming')}{' '}</p>
              <p className="text-ink-soft">{' '}{t('confirmWait')}{' '}</p>
            </div>
          )}

          {state === 'success' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirmSuccess')}{' '}</p>
              <p>{' '}{t('confirmSuccessText')}{' '}</p>
              <Link href="/" className="link">{' '}{t('browseMeanwhile')}{' '}</Link>
            </div>
          )}

          {state === 'already' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirmAlready')}{' '}</p>
              <p>{' '}{t('confirmAlreadyText')}{' '}</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirmInvalid')}{' '}</p>
              <p>{' '}{t('confirmInvalidPrefix')}{' '}{supportLink}{' '}{t('supportSuffix')}{' '}</p>
            </div>
          )}

          {(state === 'expired' || state === 'resending') && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirmExpired')}{' '}</p>
              <p>{' '}{t('confirmExpiredText')}{' '}</p>
              <button
                className="button mt-4"
                type="button"
                onClick={handleResend}
                disabled={state === 'resending'}
              >
                {state === 'resending' ? 'Sending…' : t('confirmResend')}
              </button>
            </div>
          )}

          {state === 'resent' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('confirmResent')}{' '}</p>
              <p>{' '}{t('confirmResentPrefix')}{' '}{supportLink}.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
              <p className="mt-0 text-lg font-medium text-ink">{' '}{t('genericError')}{' '}</p>
              <p>{' '}{t('confirmErrorPrefix')}{' '}{supportLink}{' '}{t('supportSuffix')}{' '}</p>
            </div>
          )}
        </div>
      </Section>

      <Footer />
    </>
  )
}
