import Head from 'next/head'
import { Footer, MetaHeader, NavHeader } from '@/components'
import { pageTitle } from '@/config/seo'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { VacancyCatalog } from '@/features/vacancies/VacancyCatalog'
import type { ServerResponse } from 'http'
import { getGoApiClient } from '@/lib/go-api-client'
import type { Vacancy } from '@/features/vacancies/model'

export async function getServerSideProps({ res }: { res: Pick<ServerResponse, 'setHeader'> }) {
  res.setHeader('Cache-Control', 'no-store')
  const { vacancies } = await getGoApiClient().request<{ vacancies: Vacancy[] }>('GET', '/api/v1/vacancies')
  return { props: { vacancies: vacancies.filter(row => row.status === 'published') } }
}

export default function Vacancies({ vacancies }: { vacancies: Vacancy[] }): JSX.Element {
  const { t } = useTranslation(messages)
  return <><Head><title>{pageTitle(t('title'))}</title></Head><MetaHeader customTitle={t('title')} customDescription={t('notice')} noIndex /><NavHeader /><main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:pt-12"><VacancyCatalog vacancies={vacancies} /></main><Footer /></>
}
