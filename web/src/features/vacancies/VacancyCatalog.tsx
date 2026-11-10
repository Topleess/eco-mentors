import { useState } from 'react'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy } from '@/features/vacancies/model'
import { VacancyCard } from '@/features/vacancies/VacancyCard'
import MentorsSearch from '@/components/mentors/MentorsSearch'
import { VacancyFilters } from '@/features/vacancies/VacancyFilters'

export function VacancyCatalog({ vacancies }: { vacancies: Vacancy[] }): JSX.Element {
  const { t } = useTranslation(messages)
  const { t: e } = useTranslation(editorMessages)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [workFormat, setWorkFormat] = useState('')
  const published = vacancies.filter(row => row.status === 'published')
  const query = search.trim().toLocaleLowerCase()
  const filtered = published.filter(row => (!industry || row.industry === industry) && (!workFormat || row.workFormat === workFormat) && `${row.title} ${row.company} ${row.location}`.toLocaleLowerCase().includes(query))
  const reset = () => { setSearch(''); setIndustry(''); setWorkFormat('') }
  return <>
    <h1 className="my-0 text-3xl sm:text-[40px]">{t('title')}</h1>
    <p className="mb-2 mt-4 text-sm font-semibold text-brand-cobalt">{t('notice')}</p>
    {published.some(row => row.provenance === 'synthetic') && <p className="mb-8 mt-0 max-w-2xl text-sm text-ink-mute">{e('sampleNote')}</p>}
    <div className="mt-6 space-y-4">
      <MentorsSearch value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} ariaLabel={t('search')} />
      <VacancyFilters vacancies={published} industry={industry} workFormat={workFormat} onIndustryChange={setIndustry} onWorkFormatChange={setWorkFormat} />
    </div>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="meta-mono my-0 text-ink-mute">{t('count', { count: filtered.length })}</p><button type="button" className="button-ghost min-h-11 px-3 text-sm" onClick={reset}>{t('reset')}</button></div>
    {filtered.length ? <div className="grid gap-4 lg:grid-cols-2">{filtered.map(vacancy => <VacancyCard key={vacancy.id} vacancy={vacancy} />)}</div> : <section className="py-10 text-center"><h2 className="text-xl">{t('empty')}</h2><p className="text-ink-mute">{t('emptyHelp')}</p></section>}
  </>
}
