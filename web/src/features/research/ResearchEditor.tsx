import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ResearchCoverUpload, isResearchCoverUrl } from '@/features/research/ResearchCoverUpload'
import { ApiError } from '@/lib/admin-moderation-api'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/research/messages'
import type { Research, ResearchWrite } from '@/features/research/model'
const empty: ResearchWrite = {
  slug: '',
  title: '',
  summary: '',
  category: '',
  author: '',
  publishedOn: '',
  readingMinutes: 5,
  coverUrl: '',
  coverAlt: '',
  pdfUrl: '',
  sections: [{ id: 'introduction', title: '', body: '' }],
  keyFindings: [],
  citation: '',
  status: 'draft',
  provenance: 'manual',
}
function validUrl(value: string): boolean {
  if (!value) return true
  if (
    value.includes('\\') ||
    /%(?:2e|2f|5c)/i.test(value) ||
    value.split('/').some((part) => part === '.' || part === '..')
  )
    return false
  if (/^\/research-assets\/[a-zA-Z0-9_./-]+$/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
export function ResearchEditor({
  research,
  onSave,
}: {
  research?: Research
  onSave: (value: ResearchWrite) => Promise<Research>
}): JSX.Element {
  const { t } = useTranslation(messages)
  const [value, setValue] = useState<ResearchWrite>(() =>
    research
      ? { ...research }
      : { ...empty, sections: empty.sections.map((section) => ({ ...section })), keyFindings: [] },
  )
  const [baseline, setBaseline] = useState(() => JSON.stringify(research ?? empty))
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const slug = useRef(research?.slug ?? '')
  const dirty = JSON.stringify(value) !== baseline
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (target && !(target as HTMLAnchorElement).hash && !window.confirm(t('unsaved'))) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [dirty, t])
  function update<K extends keyof ResearchWrite>(key: K, next: ResearchWrite[K]) {
    setValue((current) => ({ ...current, [key]: next }))
    setNotice('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || uploading) return
    setError('')
    setNotice('')
    if (
      !value.title.trim() ||
      !value.summary.trim() ||
      !value.category.trim() ||
      !value.author.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.publishedOn) ||
      Number.isNaN(Date.parse(value.publishedOn)) ||
      new Date(value.publishedOn).toISOString().slice(0, 10) !== value.publishedOn ||
      !Number.isInteger(value.readingMinutes) ||
      value.readingMinutes < 1 ||
      value.readingMinutes > 240 ||
      value.sections.length < 1 ||
      value.sections.length > 30 ||
      value.sections.some((s) => !s.title.trim() || !s.body.trim()) ||
      value.keyFindings.length > 20 ||
      value.keyFindings.some((finding) => finding.length > 2000) ||
      (Boolean(value.coverUrl) && !isResearchCoverUrl(value.coverUrl)) ||
      !validUrl(value.pdfUrl)
    ) {
      setError(t('invalid'))
      return
    }
    setBusy(true)
    try {
      if (!slug.current) slug.current = `research-${crypto.randomUUID()}`
      const saved = await onSave({ ...value, slug: slug.current })
      setValue(saved)
      setBaseline(JSON.stringify(saved))
      setNotice(t('saved'))
    } catch (error) {
      setError(t(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error'))
    } finally {
      setBusy(false)
    }
  }
  function move(index: number, delta: number) {
    const sections = [...value.sections]
    ;[sections[index], sections[index + delta]] = [sections[index + delta], sections[index]]
    update('sections', sections)
  }
  const fields = [
    'title',
    'summary',
    'category',
    'author',
    'publishedOn',
    'readingMinutes',
    'coverAlt',
    'pdfUrl',
    'citation',
  ] as const
  return (
    <form
      onSubmit={(event) => {
        void submit(event)
      }}
      className="space-y-6"
    >
      <fieldset disabled={busy || uploading} className="min-w-0 space-y-6">
        <ResearchCoverUpload value={value.coverUrl} alt={value.coverAlt} disabled={busy} onChange={(url) => update('coverUrl', url)} onPending={setUploading} />
        <details>
          <summary className="cursor-pointer text-ink-soft">{t('coverManual')}</summary>
          <label className="mt-3 block">{t('coverUrl')}
            <input className="field mt-2 min-h-11 w-full" maxLength={2048} value={value.coverUrl} onChange={(event) => update('coverUrl', event.target.value)} />
          </label>
        </details>
        <div className="grid gap-5 md:grid-cols-2">
          {fields.map((key) => (
            <label className="min-w-0" key={key}>
              {t(key === 'title' ? 'titleField' : key)}
              {key === 'summary' || key === 'citation' ? (
                <textarea
                  aria-label={t(key === 'summary' ? 'summary' : 'citation')}
                  className="field mt-2 min-h-28 w-full"
                  maxLength={2000}
                  required={key === 'summary'}
                  value={value[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              ) : (
                <input
                  className="field mt-2 min-h-11 w-full"
                  type={
                    key === 'publishedOn' ? 'date' : key === 'readingMinutes' ? 'number' : 'text'
                  }
                  required={[
                    'title',
                    'category',
                    'author',
                    'publishedOn',
                    'readingMinutes',
                  ].includes(key)}
                  min={key === 'readingMinutes' ? 1 : undefined}
                  max={key === 'readingMinutes' ? 240 : undefined}
                  maxLength={
                    key === 'category'
                      ? 120
                      : key === 'coverAlt'
                        ? 300
                        : key === 'pdfUrl'
                          ? 2048
                          : 240
                  }
                  value={value[key]}
                  onChange={(e) =>
                    update(
                      key,
                      key === 'readingMinutes' ? Number(e.target.value) : (e.target.value as never),
                    )
                  }
                />
              )}
            </label>
          ))}
        </div>
        <label className="block">
          {t('status')}
          <select
            aria-label={t('status')}
            className="field ml-3 min-h-11"
            value={value.status}
            onChange={(e) => update('status', e.target.value as ResearchWrite['status'])}
          >
            {(['draft', 'published', 'archived'] as const).map((s) => (
              <option value={s} key={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-4 font-bold">{t('sections')}</legend>
          {value.sections.map((section, index) => (
            <div className="mb-5 space-y-4 rounded-panel border border-line p-4" key={section.id}>
              <label className="block">
                {t('sectionTitle')}
                <input
                  required
                  maxLength={240}
                  className="field mt-2 min-h-11 w-full"
                  value={section.title}
                  onChange={(e) =>
                    update(
                      'sections',
                      value.sections.map((s, i) =>
                        i === index ? { ...s, title: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>
              <label className="block">
                {t('body')}
                <textarea
                  aria-label={t('body')}
                  required
                  maxLength={20000}
                  className="field mt-2 min-h-48 w-full"
                  value={section.body}
                  onChange={(e) =>
                    update(
                      'sections',
                      value.sections.map((s, i) =>
                        i === index ? { ...s, body: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="button-secondary min-h-11"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  {t('up')}
                </button>
                <button
                  type="button"
                  className="button-secondary min-h-11"
                  disabled={index === value.sections.length - 1}
                  onClick={() => move(index, 1)}
                >
                  {t('down')}
                </button>
                <button
                  type="button"
                  className="button-ghost min-h-11"
                  disabled={value.sections.length === 1}
                  onClick={() =>
                    update(
                      'sections',
                      value.sections.filter((_, i) => i !== index),
                    )
                  }
                >
                  {t('remove')}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={value.sections.length >= 30}
            className="button-secondary min-h-11"
            onClick={() =>
              update('sections', [
                ...value.sections,
                { id: `section-${crypto.randomUUID()}`, title: '', body: '' },
              ])
            }
          >
            {t('add')}
          </button>
        </fieldset>
        <label className="block">
          {t('findings')} — {t('findingHelp')}
          <textarea
            aria-label={`${t('findings')} — ${t('findingHelp')}`}
            className="field mt-2 min-h-32 w-full"
            value={value.keyFindings.join('\n')}
            onChange={(e) => update('keyFindings', e.target.value.split('\n'))}
          />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button className="button min-h-11" disabled={busy || uploading}>
        {t(busy ? 'saving' : 'save')}
      </button>
    </form>
  )
}
