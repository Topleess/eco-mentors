import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import { loadAdminDictionaries, loadVacancy, saveVacancy } from '@/features/vacancies/api'
import { VacancyEditor } from '@/features/vacancies/VacancyEditor'
import { VacancyAdminShell } from '@/features/vacancies/VacancyAdminShell'
import type { Vacancy, VacancyDictionaries, VacancyWrite } from '@/features/vacancies/model'

function EditorContent({ create }: { create: boolean }): JSX.Element {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : undefined
  const { t } = useTranslation(editorMessages)
  const { t: v } = useTranslation(messages)
  const [data, setData] = useState<{ vacancy?: Vacancy; dictionaries: VacancyDictionaries } | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!create && !id) return
    let active = true
    setError(false); setData(null)
    void Promise.all([loadAdminDictionaries(), create ? Promise.resolve(undefined) : loadVacancy(id ?? '')]).then(([dictionaries, vacancy]) => { if (active) setData({ dictionaries, vacancy }) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [create, id, attempt])
  const save = async (value: VacancyWrite): Promise<Vacancy> => {
    const vacancy = await saveVacancy(value, create ? undefined : id)
    setData(current => current ? { ...current, vacancy } : current)
    if (create) await router.replace(`/admin/vacancies/${vacancy.id}`)
    return vacancy
  }
  return <><div className="mb-5 flex flex-wrap gap-3"><Link className="button-ghost inline-flex min-h-11 items-center px-3" href="/admin/vacancies">← {v('back')}</Link>{data?.vacancy?.status === 'published' && <Link className="button-secondary min-h-11" href={`/vacancies/${data.vacancy.slug}`}>{t('public')}</Link>}</div>{error ? <div role="alert"><p>{t('loadError')}</p><button className="button-secondary" onClick={() => setAttempt(current => current + 1)}>{t('retry')}</button></div> : !data ? <p role="status">{t('loading')}</p> : <VacancyEditor key={create ? 'new' : id} vacancy={data.vacancy} dictionaries={data.dictionaries} onSave={save} onCancel={() => { void router.push('/admin/vacancies') }} />}</>
}
export function VacancyEditorPage({ create = false }: { create?: boolean }): JSX.Element {
  const { t } = useTranslation(editorMessages)
  return <VacancyAdminShell title={t(create ? 'new' : 'editor')}><EditorContent create={create} /></VacancyAdminShell>
}
