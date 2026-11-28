import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import NoIndexHead from '@/components/layout/NoIndexHead'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation/AdminAuthContext'
import { feedbackMessages, feedbackPageSize, type FeedbackPage } from '@/features/feedback/model'
import { useTranslation } from '@/i18n'

const messages = {
  ...feedbackMessages,
  checking: { ru: 'Проверяем доступ…', en: 'Checking access…' },
  intro: { ru: 'Сообщения с сайта. Новые — вверху.', en: 'Messages from the website, newest first.' },
  loading: { ru: 'Загружаем сообщения…', en: 'Loading messages…' },
  empty: { ru: 'На этой странице нет сообщений.', en: 'No messages on this page.' },
  failed: { ru: 'Не удалось загрузить сообщения.', en: 'Could not load messages.' },
  retry: { ru: 'Попробовать ещё раз', en: 'Try again' },
  reply: { ru: 'Почта для ответа:', en: 'Reply email:' },
  previous: { ru: 'Назад', en: 'Previous' },
  next: { ru: 'Далее', en: 'Next' },
  page: { ru: 'Страница {n}', en: 'Page {n}' },
} as const

function FeedbackInbox(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ page: number; attempt: number; data?: FeedbackPage } | null>(null)
  const current = loaded?.page === page && loaded.attempt === attempt ? loaded : null
  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(`/api/admin/feedback?offset=${page * feedbackPageSize}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Feedback unavailable')
        const data = await response.json() as FeedbackPage
        if (!controller.signal.aborted) setLoaded({ page, attempt, data })
      } catch {
        if (!controller.signal.aborted) setLoaded({ page, attempt })
      }
    })()
    return () => controller.abort()
  }, [page, attempt])
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="max-w-3xl">
      <p className="mt-0 text-ink-soft">{t('intro')}</p>
      {!current && <p role="status">{t('loading')}</p>}
      {current && !current.data && <><p role="alert">{t('failed')}</p><button className="button-secondary min-h-11" onClick={() => setAttempt(value => value + 1)}>{t('retry')}</button></>}
      {current?.data?.items.length === 0 && <p>{t('empty')}</p>}
      {Boolean(current?.data?.items.length) && <ul className="m-0 grid list-none gap-3 p-0">
        {current?.data?.items.map(item => (
          <li key={item.id} className="min-w-0 rounded-panel border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="my-0 text-base">{t(item.category)}</h2>
              <time dateTime={item.createdAt} className="text-sm text-ink-soft">{formatter.format(new Date(item.createdAt))}</time>
            </div>
            <p className="mb-0 mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.message}</p>
            {item.email && <p className="mb-0 mt-3 break-all text-sm text-ink-soft">{t('reply')} <span className="font-medium text-ink">{item.email}</span></p>}
          </li>
        ))}
      </ul>}
      {(page > 0 || current?.data?.hasMore) && <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="button-secondary min-h-11" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>{t('previous')}</button>
        <span className="text-sm" aria-live="polite">{t('page', { n: page + 1 })}</span>
        <button type="button" className="button-secondary min-h-11" disabled={!current?.data?.hasMore} onClick={() => setPage(value => value + 1)}>{t('next')}</button>
      </div>}
    </section>
  )
}

function Content(): JSX.Element {
  const { t } = useTranslation(messages)
  const router = useRouter()
  const { isAuthenticated, isLoading, session } = useAdminAuth()
  const isAdmin = isAuthenticated && session?.role === 'admin'
  useEffect(() => {
    if (isLoading || isAdmin) return
    void router.replace(isAuthenticated ? '/admin/mentors/pending' : '/admin/login')
  }, [isLoading, isAuthenticated, isAdmin, router])
  return <>
    <NoIndexHead title={t('title')} />
    {isLoading || !isAdmin ? <p className="px-4 py-8" role="status">{t('checking')}</p> : <AdminLayout title={t('title')}><FeedbackInbox /></AdminLayout>}
  </>
}

export default function AdminFeedback(): JSX.Element {
  return <AdminAuthProvider><Content /></AdminAuthProvider>
}
