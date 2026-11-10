import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { VacancyAdminShell } from '@/features/vacancies/VacancyAdminShell'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/research/messages'
import { ResearchEditor } from '@/features/research/ResearchEditor'
import { loadResearch, loadResearchList, saveResearch } from '@/features/research/api'
import type { Research, ResearchWrite } from '@/features/research/model'
export function ResearchAdminList(): JSX.Element {
  const { t } = useTranslation(messages)
  const [rows, setRows] = useState<Research[] | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(false)
    void loadResearchList()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [attempt])
  return (
    <>
      <Link className="button mb-6 inline-flex min-h-11 items-center" href="/admin/research/new">
        {t('new')}
      </Link>
      {error ? (
        <div role="alert">
          {t('loadError')}
          <button
            className="button-secondary ml-3 min-h-11"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t('retry')}
          </button>
        </div>
      ) : rows === null ? (
        <p role="status">{t('loading')}</p>
      ) : !rows.length ? (
        <p>{t('empty')}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line p-5"
            >
              <div className="min-w-0">
                <Link
                  className="inline-flex min-h-11 items-center break-words text-lg font-bold text-brand-cobalt"
                  href={`/admin/research/${row.id}`}
                >
                  {row.title}
                </Link>
                <p className="text-sm text-ink-mute">
                  {t(row.status)} · {row.publishedOn}
                </p>
              </div>
              {row.status === 'published' && (
                <Link className="button-secondary min-h-11" href={`/research/${row.slug}`}>
                  {t('public')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
export function ResearchAdminPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <VacancyAdminShell title={t('title')}>
      <ResearchAdminList />
    </VacancyAdminShell>
  )
}
function EditorContent({ create }: { create: boolean }): JSX.Element {
  const router = useRouter(),
    { t } = useTranslation(messages)
  const id = typeof router.query.id === 'string' ? router.query.id : undefined
  const [loaded, setLoaded] = useState<{ research?: Research } | null>(create ? {} : null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (create || !id) return
    let active = true
    setError(false)
    setLoaded(null)
    void loadResearch(id)
      .then((research) => {
        if (active) setLoaded({ research })
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [create, id, attempt])
  async function save(value: ResearchWrite): Promise<Research> {
    const research = await saveResearch(value, loaded?.research?.id ?? (create ? undefined : id))
    setLoaded({ research })
    if (create) await router.replace(`/admin/research/${research.id}`)
    return research
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link className="button-ghost inline-flex min-h-11 items-center" href="/admin/research">
          ← {t('back')}
        </Link>
        {loaded?.research?.status === 'published' && (
          <Link className="button-secondary min-h-11" href={`/research/${loaded.research.slug}`}>
            {t('public')}
          </Link>
        )}
      </div>
      {error ? (
        <div role="alert">
          {t('loadError')}
          <button className="button-secondary min-h-11" onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </button>
        </div>
      ) : !loaded ? (
        <p role="status">{t('loading')}</p>
      ) : (
        <ResearchEditor key={create ? 'new' : id} research={loaded.research} onSave={save} />
      )}
    </>
  )
}
export function ResearchEditorPage({ create = false }: { create?: boolean }): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <VacancyAdminShell title={t(create ? 'new' : 'edit')}>
      <EditorContent create={create} />
    </VacancyAdminShell>
  )
}
