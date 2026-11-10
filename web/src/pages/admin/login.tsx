import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { AuthGateScreen, NoIndexHead } from '@/components'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation'
import analytics from '@/lib/analytics'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'
import { adminMessage } from '@/i18n/admin'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

interface LoginFormData {
  email: string
}

function LoginForm(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, requestLogin } = useAdminAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const { expired, callback_error } = router.query

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/admin/mentors/pending')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    analytics.event(analytics.events.ADMIN_AUTH_LOGIN_REQUESTED, {
      outcome: 'login_page_viewed',
    })
  }, [])

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsSubmitting(true)
    setSubmitError(null)
    analytics.event(analytics.events.ADMIN_AUTH_LOGIN_REQUESTED, {
      outcome: 'submitted',
    })

    try {
      const result = await requestLogin(data.email)
      if (result.success) {
        setSubmitSuccess(true)
        analytics.event(analytics.events.ADMIN_AUTH_LOGIN_REQUESTED, {
          outcome: 'success',
        })
      } else {
        setSubmitError(result.message || 'Something went wrong. Please try again.')
        analytics.event(analytics.events.ADMIN_AUTH_LOGIN_REQUESTED, {
          outcome: 'error',
          error_type: 'api_error',
        })
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      analytics.event(analytics.events.ADMIN_AUTH_LOGIN_REQUESTED, {
        outcome: 'error',
        error_type: 'network_error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return <AuthGateScreen title={t('loginTitle')} />
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-surface px-5 py-12">
      <NoIndexHead title={t('loginTitle')} />

      <div className="mx-auto w-full max-w-[440px]">
        <div className="rounded-[20px] border border-line bg-white p-7 shadow-[0_20px_50px_-24px_rgba(19,42,82,0.22)] sm:p-10">
          <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
          <div className="mb-5 flex items-center gap-2.5">
            <Image
              src="/brand/logo/svg/logomark.svg"
              width={38}
              height={38}
              alt=""
              unoptimized
            />
            <span className="font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-brand-navy">
              openmentor<span className="text-brand-cobalt">.io</span>
            </span>
          </div>

          <h1 className="text-[26px] tracking-[-0.02em] text-ink">{t('moderation')}</h1>
          <p className="my-0 mb-5 mt-2 text-sm leading-normal text-ink-soft">
            {t('loginHint')}
          </p>

          {expired === 'true' && (
            <div className="mb-5 rounded-field border border-line bg-surface p-3.5">
              <p className="my-0 text-sm text-ink">
                {t('sessionExpired')}
              </p>
            </div>
          )}

          {callback_error && (
            <div className="mb-5 rounded-field border border-danger/40 bg-danger/5 p-3.5">
              <p className="my-0 text-sm text-danger">
                {callback_error === 'invalid_token'
                  ? t('invalidLinkHint')
                  : t('genericError')}
              </p>
            </div>
          )}

          {submitSuccess ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-mint/15">
                <FontAwesomeIcon icon={faEnvelope} className="text-mint-ink" />
              </div>
              <h2 className="mb-2 text-lg text-ink">{t('checkEmail')}</h2>
              <p className="my-0 mb-4 text-sm text-ink-soft">
                {t('loginSent')}
              </p>
              <button
                onClick={() => setSubmitSuccess(false)}
                className="text-[13px] font-semibold text-brand-cobalt transition-colors duration-120 hover:text-brand-navy"
              >
                {t('sendAgain')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[13px] font-semibold text-ink">
                  {t('email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="moderator@openmentor.io"
                  {...register('email', {
                    required: t('emailRequired'),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: t('emailInvalid'),
                    },
                  })}
                  className={errors.email ? 'field field-error animate-shake' : 'field'}
                />
                {errors.email && (
                  <p className="my-0 text-xs font-medium text-danger" role="alert">
                    {adminMessage(locale, errors.email.message ?? '')}
                  </p>
                )}
              </div>

              {submitError && (
                <p className="my-0 text-sm font-medium text-danger" role="alert">
                  {adminMessage(locale, submitError)}
                </p>
              )}

              <button type="submit" disabled={isSubmitting} className="button w-full text-[15px]">
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon={faCircleNotch} className="mr-2 animate-spin" />
                    {t('sending')}
                  </>
                ) : (
                  t('sendLogin')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage(): JSX.Element {
  return (
    <AdminAuthProvider>
      <LoginForm />
    </AdminAuthProvider>
  )
}
