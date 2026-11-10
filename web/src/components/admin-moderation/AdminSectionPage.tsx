import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartSimple, faBriefcase, faFlask } from '@fortawesome/free-solid-svg-icons'
import NoIndexHead from '@/components/layout/NoIndexHead'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation/AdminAuthContext'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'

const sections = {
  analytics: {
    title: 'analytics',
    icon: faChartSimple,
    label: 'internalTool',
    description: 'analyticsDescription',
    empty: 'analyticsEmpty',
    detail: 'analyticsDetail',
  },
  vacancies: {
    title: 'vacancies',
    icon: faBriefcase,
    label: 'futureCatalog',
    description: 'vacanciesDescription',
    empty: 'vacanciesEmpty',
    detail: 'vacanciesDetail',
  },
  research: {
    title: 'research',
    icon: faFlask,
    label: 'futureCatalog',
    description: 'researchDescription',
    empty: 'researchEmpty',
    detail: 'researchDetail',
  },
} as const

type Section = keyof typeof sections

function SectionContent({ section }: { section: Section }): JSX.Element {
  const config = sections[section]
  const { t } = useTranslation(messages)
  const router = useRouter()
  const { isAuthenticated, isLoading, session } = useAdminAuth()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      void router.replace('/admin/login')
    } else if (session?.role !== 'admin') {
      void router.replace('/admin/mentors/pending')
    }
  }, [isLoading, isAuthenticated, session?.role, router])

  const head = <NoIndexHead title={t(config.title)} />
  if (isLoading || !isAuthenticated || session?.role !== 'admin') {
    return <>{head}<p role="status" className="px-4 py-8 text-ink-mute">{t('checkingAccess')}</p></>
  }

  return (
    <>
      {head}
      <AdminLayout title={t(config.title)}>
        <section aria-label={t(config.title)}>
          <p className="meta-mono mb-3 mt-0 text-brand-cobalt">{t(config.label)}</p>
          <p className="mb-8 mt-0 max-w-2xl text-sm leading-relaxed text-ink-soft">{t(config.description)}</p>
          <div className="rounded-panel border border-line bg-white p-6 sm:p-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-card bg-surface text-brand-cobalt">
              <FontAwesomeIcon icon={config.icon} className="h-5 w-5" />
            </div>
            <h2 className="my-0 text-lg text-ink">{t(config.empty)}</h2>
            <p className="mb-0 mt-3 max-w-2xl text-sm leading-relaxed text-ink-mute">{t(config.detail)}</p>
          </div>
        </section>
      </AdminLayout>
    </>
  )
}

export function AdminSectionPage({ section }: { section: Section }): JSX.Element {
  return <AdminAuthProvider><SectionContent section={section} /></AdminAuthProvider>
}
