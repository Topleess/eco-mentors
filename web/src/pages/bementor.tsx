import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/public-pages'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Footer, MetaHeader, NavHeader } from '@/components'
import RegisterMentorForm from '@/components/forms/RegisterMentorForm'
import analytics from '@/lib/analytics'
import { captureException } from '@/lib/posthog'
import { pageTitle } from '@/config/seo'
import type { RegisterMentorRequest, RegisterMentorResponse } from '@/types/api'

export default function Bementor(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    analytics.event(analytics.events.MENTOR_REGISTRATION_PAGE_VIEWED)
  }, [])

  const handleSubmit = async (data: RegisterMentorRequest): Promise<void> => {
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      analytics.event(analytics.events.MENTOR_REGISTRATION_SUBMITTED, {
        outcome: 'submitted',
        experience: data.experience,
        price: data.price,
        tags_count: data.tags.length,
        has_calendar_url: Boolean(data.calendarUrl),
      })

      const response = await fetch('/api/register-mentor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: RegisterMentorResponse = await response.json()

      if (response.ok && result.success) {
        setSubmitStatus('success')
        window.scrollTo({ top: 0 })
        analytics.event(analytics.events.MENTOR_REGISTRATION_SUBMITTED, {
          outcome: 'success',
          mentor_id: result.mentorId,
        })
      } else {
        setSubmitStatus('error')
        setErrorMessage(locale === 'en' && result.error ? result.error : t('applicationError'))
        analytics.event(analytics.events.MENTOR_REGISTRATION_SUBMITTED, {
          outcome: 'error',
          error_type: 'api_error',
          status_code: response.status,
        })
      }
    } catch (error) {
      setSubmitStatus('error')
      setErrorMessage(
        t('applicationRetryError'),
      )
      if (error instanceof Error) {
        captureException(error, { page: 'bementor' })
      }
      analytics.event(analytics.events.MENTOR_REGISTRATION_SUBMITTED, {
        outcome: 'error',
        error_type: error instanceof Error ? error.name : 'unknown',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = pageTitle(t('becomeAMentor'))

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <MetaHeader customTitle={t('becomeAMentor')} />

      <NavHeader backLink={{ href: '/', label: t('backToMentors') }} />

      <main className="mx-auto w-full max-w-[1160px] px-5 pb-16 pt-6 sm:px-8 sm:pt-8 lg:px-10 lg:pb-20 lg:pt-12">
        {/* Desktop shows the small-caps rail title instead (design 04);
            mobile gets the display heading. */}
        <h1 className="mb-6 text-2xl lg:sr-only">{t('becomeAMentor')}</h1>

        {submitStatus === 'success' && (
          <div className="mx-auto max-w-[620px] animate-rise-in rounded-panel border border-line bg-white p-6 shadow-card-hover sm:p-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-mint">
              <svg width="18" height="14" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                <path
                  d="M1 4.5L4 7.5L10 1"
                  stroke="#161A20"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h2 className="mb-0 mt-5 text-[22px] leading-[1.1] tracking-[-0.01em]">
              {t('thankYouForYourApplication')}</h2>

            <p className="mt-4 leading-[1.6] text-ink-soft">
              {t('thanksWeVeReceivedYourApplicationA')}{' '}
              <a className="link" href="mailto:hello@openmentor.io">
                hello@openmentor.io
              </a>
              .
            </p>

            <p className="rounded-field border border-brand-mint/60 bg-brand-mint/10 px-4 py-3 leading-[1.6] text-ink">
              {t('importantCheckYourInboxAndClickThe')}{' '}
              <a className="link" href="mailto:hello@openmentor.io">
                {t('dropUsALine')}</a>{' '}
              {' '}{t('andWeLlSortItOut')}</p>

            <p className="mb-0 font-semibold text-ink">{t('goodLuck')}</p>
          </div>
        )}

        {submitStatus !== 'success' && (
          <>
            {/* Who we're looking for: sets expectations before the form —
                real practitioners, free encouraged, requests answered. */}
            <div className="mb-8 rounded-panel border border-line bg-surface p-5 sm:p-6 lg:ml-[276px] lg:max-w-[620px]">
              <p className="my-0 text-[15px] font-bold leading-[1.4] text-ink">
                {t('whoWeReLookingFor')}</p>
              <p className="mb-0 mt-2 text-sm leading-[1.6] text-ink-soft">
                {t('peopleWhoDoTheWorkTheyMentor')}{' '}<span className="font-semibold text-mint-ink">{t('forFree')}</span> {t('isWarmlyEncouragedCommunityHelpIsWhat')}{' '}
                <Link className="link" href="/faq#mentors">
                  {t('mentorFaq')}</Link>
                .
              </p>
            </div>

            {submitStatus === 'error' && (
              <div className="mb-8 rounded-panel border-[1.5px] border-danger/40 bg-danger/5 p-5 sm:p-6 lg:ml-[276px] lg:max-w-[620px]">
                <p className="my-0 font-bold text-danger">{t('failedToSubmitYourApplication')}</p>
                <p className="mb-0 mt-1.5 text-sm leading-[1.6] text-ink">{errorMessage}</p>
              </div>
            )}

            <RegisterMentorForm
              isLoading={isSubmitting}
              isError={submitStatus === 'error'}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </main>

      <Footer />
    </>
  )
}
