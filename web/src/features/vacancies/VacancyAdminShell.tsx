import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/router'
import NoIndexHead from '@/components/layout/NoIndexHead'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation/AdminAuthContext'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'

function Gate({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  const router = useRouter()
  const { t } = useTranslation(messages)
  const { isLoading, isAuthenticated, session } = useAdminAuth()
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) void router.replace('/admin/login')
    else if (session?.role !== 'admin') void router.replace('/admin/mentors/pending')
  }, [isLoading, isAuthenticated, session?.role, router])
  return <><NoIndexHead title={title} />{isLoading || !isAuthenticated || session?.role !== 'admin' ? <p role="status" className="px-4 py-8 text-ink-mute">{t('checking')}</p> : <AdminLayout title={title}>{children}</AdminLayout>}</>
}
export function VacancyAdminShell({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return <AdminAuthProvider><Gate title={title}>{children}</Gate></AdminAuthProvider>
}
