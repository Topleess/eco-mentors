import { useEffect } from 'react'
import { useRouter } from 'next/router'
import NoIndexHead from '@/components/layout/NoIndexHead'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation/AdminAuthContext'
import { AnalyticsDashboard } from '@/features/analytics/AnalyticsDashboard'
import { useLocale } from '@/i18n'

function Content(): JSX.Element {
  const router = useRouter()
  const { isAuthenticated, isLoading, session } = useAdminAuth()
  const locale = useLocale()
  const title = locale === 'ru' ? 'Аналитика' : 'Analytics'
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) void router.replace('/admin/login')
    else if (session?.role !== 'admin') void router.replace('/admin/mentors/pending')
  }, [isLoading, isAuthenticated, session?.role, router])
  const head = <NoIndexHead title={title} />
  if (isLoading || !isAuthenticated || session?.role !== 'admin')
    return (
      <>
        {head}
        <p role="status" className="px-4 py-8 text-ink-mute">
          {locale === 'ru' ? 'Проверяем доступ…' : 'Checking access…'}
        </p>
      </>
    )
  return (
    <>
      {head}
      <AdminLayout title={title}>
        <AnalyticsDashboard />
      </AdminLayout>
    </>
  )
}
export default function AnalyticsPage(): JSX.Element {
  return (
    <AdminAuthProvider>
      <Content />
    </AdminAuthProvider>
  )
}
