import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import { loadAdminVacancies } from '@/features/vacancies/api'
import type { Vacancy } from '@/features/vacancies/model'
import { VacancyAdminShell } from '@/features/vacancies/VacancyAdminShell'

function AdminVacanciesContent(): JSX.Element {
  const { t } = useTranslation(messages)
  const { t: e } = useTranslation(editorMessages)
  const [rows, setRows] = useState<Vacancy[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    setError(false)
    void loadAdminVacancies().then(data => { if (active) setRows(data) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [attempt])
  const filtered = (rows ?? []).filter(row => (!status || row.status === status) && `${row.title} ${row.company} ${row.location}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <>
    <div className="mb-5 flex flex-wrap gap-3"><Link className="button min-h-11" href="/admin/vacancies/new">{e('new')}</Link></div>
    <p className="mb-6 text-sm text-ink-mute">{e('seedNote')}</p>
    {error && <div role="alert"><p>{e('loadError')}</p><button className="button-secondary" onClick={() => setAttempt(current => current + 1)}>{e('retry')}</button></div>}
    {!rows && !error && <p role="status">{e('loading')}</p>}
    <div className="mb-4 grid items-end gap-4 rounded-panel border border-line bg-white p-4 sm:grid-cols-[2fr_1fr]">
      <label className="grid gap-2 text-sm font-medium">{t('search')}<input aria-label={t('search')} type="search" className="field min-h-11 w-full text-base" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="grid gap-2 text-sm font-medium">{t('status')}<select aria-label={t('status')} className="field min-h-11 w-full text-base" value={status} onChange={event => setStatus(event.target.value)}><option value="">{t('all')}</option>{(['published', 'draft', 'archived'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    </div>
    {rows && !error && <><div className="my-4 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="meta-mono my-0 text-ink-mute">{t('count', { count: filtered.length })}</p><button type="button" className="button-ghost min-h-11 px-3 text-sm" onClick={() => { setSearch(''); setStatus('') }}>{t('reset')}</button></div>
    {!filtered.length && <section className="py-10 text-center"><h2 className="text-xl">{t('empty')}</h2><p className="text-ink-mute">{t('emptyHelp')}</p></section>}
    {!!filtered.length && <div className="max-w-full overflow-x-auto rounded-panel border border-line bg-white" role="region" aria-label={t('adminTitle')} tabIndex={0}>
      <table aria-label={t('adminTitle')} className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-surface text-ink-mute"><tr><th scope="col" className="px-5 py-4 font-medium">{t('vacancy')}</th><th scope="col" className="px-4 py-4 font-medium">{t('industry')}</th><th scope="col" className="px-4 py-4 font-medium">{t('locationFormat')}</th><th scope="col" className="px-5 py-4 font-medium">{t('status')}</th></tr></thead>
        <tbody>{filtered.map(vacancy => <tr key={vacancy.id} className="border-t border-line align-top transition-colors hover:bg-surface">
          <td className="px-5 py-3"><article><p className="my-0 text-xs text-ink-mute">{vacancy.company}</p><h2 className="my-0 font-name text-base normal-case tracking-normal"><Link className="inline-flex min-h-11 items-center text-brand-navy hover:text-brand-cobalt hover:underline" href={`/admin/vacancies/${vacancy.id}`}>{vacancy.title}</Link></h2>{vacancy.provenance === 'synthetic' && <p className="my-0 text-xs text-ink-mute">{e('sample')}</p>}{vacancy.status === 'published' && <Link className="inline-flex min-h-11 items-center text-xs text-brand-cobalt hover:underline" href={`/vacancies/${vacancy.slug}`}>{e('public')}</Link>}</article></td>
          <td className="px-4 py-5 text-ink-soft">{vacancy.industry}</td>
          <td className="px-4 py-5 text-ink-soft">{vacancy.location}<span className="mt-1 block text-xs text-ink-mute">{t(vacancy.workFormat)}</span></td>
          <td className="px-5 py-5"><span className={vacancy.status === 'published' ? 'font-medium text-mint-ink' : 'text-ink-mute'}>{t(vacancy.status)}</span></td>
        </tr>)}</tbody>
      </table>
    </div>}</>}
  </>
}
export function AdminVacanciesPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return <VacancyAdminShell title={t('adminTitle')}><AdminVacanciesContent /></VacancyAdminShell>
}
