import type { ServerResponse } from 'http'
import type { ParsedUrlQuery } from 'querystring'
import Head from 'next/head'
import { Footer, MetaHeader, NavHeader } from '@/components'
import { pageTitle } from '@/config/seo'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { VacancyDetail } from '@/features/vacancies/VacancyDetail'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
import type { Vacancy } from '@/features/vacancies/model'

export async function getServerSideProps({ params, res }: { params?: ParsedUrlQuery; res: Pick<ServerResponse, 'setHeader'> }) {
  res.setHeader('Cache-Control', 'no-store')
  if (typeof params?.slug !== 'string') return { notFound: true as const }
  try {
    const { vacancy } = await getGoApiClient().request<{ vacancy: Vacancy }>('GET', `/api/v1/vacancies/${encodeURIComponent(params.slug)}`)
    return vacancy.status === 'published' ? { props: { vacancy } } : { notFound: true as const }
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) return { notFound: true as const }
    throw error
  }
}

export default function VacancyPage({ vacancy }: { vacancy: Vacancy }): JSX.Element {
  const { t } = useTranslation(messages)
  return <><Head><title>{pageTitle(vacancy.title)}</title></Head><MetaHeader customTitle={vacancy.title} customDescription={t('notice')} noIndex /><NavHeader /><main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8 sm:pt-12"><VacancyDetail vacancy={vacancy} /></main><Footer /></>
}
