import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { CreatableDictionarySelect } from './CreatableDictionarySelect'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy, VacancyDictionaries, VacancyWrite } from '@/features/vacancies/model'

const blank: VacancyWrite = { slug: '', title: '', company: '', industryId: '', cityId: '', workFormat: 'remote', employment: 'fullTime', experience: 'junior', status: 'draft', salary: null, description: '', responsibilities: [], requirements: [], conditions: [], provenance: 'manual' }
const toWrite = (v: Vacancy): VacancyWrite => ({ slug: v.slug, title: v.title, company: v.company, industryId: v.industryId, cityId: v.cityId, workFormat: v.workFormat, employment: v.employment, experience: v.experience, status: v.status, salary: v.salary, description: v.description, responsibilities: v.responsibilities, requirements: v.requirements, conditions: v.conditions, provenance: v.provenance, version: v.version })

export function VacancyEditor({ vacancy, dictionaries, onSave, onCancel }: { vacancy?: Vacancy; dictionaries: VacancyDictionaries; onSave: (value: VacancyWrite) => Promise<Vacancy | void>; onCancel: () => void }): JSX.Element {
  const { t } = useTranslation(messages)
  const { t: e } = useTranslation(editorMessages)
  const initial = vacancy ? toWrite(vacancy) : blank
  const [value, setValue] = useState<VacancyWrite>(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const [saving, setSaving] = useState(false)
  const [dictionaryPending, setDictionaryPending] = useState(false)
  const [options, setOptions] = useState(dictionaries)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const bypass = useRef(false)
  const generatedSlug = useRef<string | null>(null)
  const dirty = JSON.stringify(value) !== baseline
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const navigate = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (anchor.href === window.location.href || window.confirm(e('unsaved'))) return
      // Cancel before Next's link handler; throwing during routing opens the dev error overlay.
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty, e])
  const set = <K extends keyof VacancyWrite>(key: K, next: VacancyWrite[K]) => { setValue(current => ({ ...current, [key]: next })); setSaved(false) }
  const save = async (status = value.status) => {
    if (saving || dictionaryPending) return
    setError(''); setSaved(false)
    if (!value.title.trim() || !value.company.trim() || !value.description.trim() || !value.industryId || !value.cityId) { setError(e('required')); return }
    const salary = value.salary
    if (salary && ((salary.min !== null && (!Number.isFinite(salary.min) || salary.min < 0)) || (salary.max !== null && (!Number.isFinite(salary.max) || salary.max < 0)) || (salary.min !== null && salary.max !== null && salary.min > salary.max))) { setError(e('salaryError')); return }
    const clean = (items: string[]) => items.map(item => item.trim()).filter(Boolean)
    setSaving(true)
    try {
      const slug = value.slug || (generatedSlug.current ??= `vacancy-${crypto.randomUUID()}`)
      const payload = { ...value, slug, title: value.title.trim(), company: value.company.trim(), responsibilities: clean(value.responsibilities), requirements: clean(value.requirements), conditions: clean(value.conditions), status }
      bypass.current = true
      const verified = await onSave(payload)
      const next = verified ? toWrite(verified) : payload
      setValue(next); setBaseline(JSON.stringify(next)); setSaved(true)
    } catch (reason) {
      setError(e(reason instanceof Error && 'status' in reason && reason.status === 409 ? 'conflict' : 'failed'))
    } finally { bypass.current = false; setSaving(false) }
  }
  const cancel = () => { if (!dirty || window.confirm(e('unsaved'))) { bypass.current = true; onCancel() } }
  return <form aria-label={e('editor')} noValidate onSubmit={event => { event.preventDefault(); void save() }} className="max-w-4xl space-y-6">
    {vacancy?.provenance === 'synthetic' && <p className="text-sm text-ink-mute">{e('provenance')}</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {saved && <p role="status" className="text-mint-ink">{e('saved')}</p>}
    <fieldset disabled={saving} className="grid gap-4 rounded-panel border border-line bg-white p-5 sm:grid-cols-2">
      <legend className="font-semibold">{e('editor')}</legend>
      {(['title', 'company'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium">{e(key)}<input aria-label={e(key)} className="field min-h-11 w-full text-base" required value={value[key]} onChange={event => set(key, event.target.value)} /></label>)}
      {(['industryId', 'cityId'] as const).map(key => { const kind = key === 'industryId' ? 'industries' : 'cities'; return <CreatableDictionarySelect key={key} label={key === 'industryId' ? t('industry') : e('city')} kind={kind} items={options[kind]} value={value[key]} onChange={id => set(key, id)} onCreated={item => setOptions(current => ({ ...current, [kind]: [...current[kind], item] }))} onPending={setDictionaryPending} /> })}
      {([{ key: 'workFormat', label: t('workFormat'), options: ['remote', 'hybrid', 'office'] }, { key: 'employment', label: e('employment'), options: ['fullTime', 'partTime', 'internship'] }, { key: 'experience', label: e('experience'), options: ['junior', 'middle', 'senior'] }, { key: 'status', label: t('status'), options: ['draft', 'published', 'archived'] }] as const).map(({ key, label, options }) => <label key={key} className="grid gap-2 text-sm font-medium">{label}<select aria-label={label} className="field min-h-11 w-full text-base" value={value[key]} onChange={event => set(key, event.target.value as typeof value[typeof key])}>{options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select></label>)}
      {(['min', 'max'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium">{e(key)}<input aria-label={e(key)} type="number" min="0" className="field min-h-11 w-full text-base" value={value.salary?.[key] ?? ''} onChange={event => { const next = { min: value.salary?.min ?? null, max: value.salary?.max ?? null, currency: 'RUB' as const, [key]: event.target.value === '' ? null : Number(event.target.value) }; set('salary', next.min === null && next.max === null ? null : next) }} /></label>)}
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t('description')}<textarea aria-label={t('description')} required rows={5} className="field w-full text-base" value={value.description} onChange={event => set('description', event.target.value)} /></label>
      {(['responsibilities', 'requirements', 'conditions'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium sm:col-span-2">{t(key)}<span className="text-xs font-normal text-ink-mute">{e('lines')}</span><textarea aria-label={t(key)} rows={4} className="field w-full text-base" value={value[key].join('\n')} onChange={event => set(key, event.target.value.split('\n'))} /></label>)}
    </fieldset>
    <div className="flex flex-wrap gap-3"><button className="button min-h-11" disabled={saving || dictionaryPending} type="submit">{e(saving ? 'saving' : 'save')}</button><button className="button-secondary min-h-11" disabled={saving || dictionaryPending} type="button" onClick={cancel}>{e('cancel')}</button>{vacancy && vacancy.status !== 'archived' && <button className="button-ghost min-h-11" disabled={saving || dictionaryPending} type="button" onClick={() => { if (window.confirm(e('archiveConfirm'))) void save('archived') }}>{e('archive')}</button>}</div>
  </form>
}
