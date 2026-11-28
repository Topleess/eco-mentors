import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { TelegramPublish } from './TelegramPublish'
import { applyReparse, type ReparseCandidate } from './reparse'
import { CreatableDictionarySelect } from './CreatableDictionarySelect'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy, VacancyDictionaries, VacancyWrite } from '@/features/vacancies/model'

const blank: VacancyWrite = { slug: '', title: '', company: '', industryId: '', cityId: '', workFormat: 'remote', employment: 'fullTime', experience: 'junior', status: 'draft', salary: null, description: '', responsibilities: [], requirements: [], conditions: [], provenance: 'manual' }
const toWrite = (v: Vacancy): VacancyWrite => ({ slug: v.slug, title: v.title, company: v.company, industryId: v.industryId, cityId: v.cityId, workFormat: v.workFormat, employment: v.employment, experience: v.experience, status: v.status, salary: v.salary, description: v.description, responsibilities: v.responsibilities, requirements: v.requirements, conditions: v.conditions, provenance: v.provenance, version: v.version })

export function VacancyEditor({ vacancy, dictionaries, onSave, onCancel }: { vacancy?: Vacancy; dictionaries: VacancyDictionaries; onSave: (value: VacancyWrite) => Promise<Vacancy | void>; onCancel: () => void }): JSX.Element {
  const { t, intlLocale } = useTranslation(messages)
  const { t: e } = useTranslation(editorMessages)
  const initial = vacancy ? toWrite(vacancy) : blank
  const [value, setValue] = useState<VacancyWrite>(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const [saving, setSaving] = useState(false)
  const [telegramBusy, setTelegramBusy] = useState(false)
  const [reparse, setReparse] = useState<ReparseCandidate | null>(null)
  const [reparseBusy, setReparseBusy] = useState(false)
  const previewReparse = async () => {
    if (!vacancy || reparseBusy) return
    setReparseBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/vacancies/${encodeURIComponent(vacancy.id)}/telegram/reparse`)
      if (!response.ok) throw new Error('reparse failed')
      setReparse(await response.json() as ReparseCandidate)
    } catch { setError('Не удалось разобрать исходный пост. Попробуйте ещё раз.') } finally { setReparseBusy(false) }
  }
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
    if (status !== 'draft' && (!value.title.trim() || !value.company.trim() || !value.description.trim() || !value.industryId || !value.cityId || !value.workFormat || !value.employment || !value.experience)) { setError(e('required')); return }
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
    {vacancy?.telegramSource && <section className="rounded-panel border border-line bg-white p-5"><p>Импорт из Telegram — проверьте и заполните все обязательные поля перед публикацией.</p><p>Канал: {vacancy.telegramSource.channelId}; сообщение: {vacancy.telegramSource.messageId}</p>{vacancy.telegramSource.sourceUrl && <p>Источник: {vacancy.telegramSource.sourceUrl}</p>}<div className="flex flex-wrap gap-3">{vacancy.telegramSource.photoIds.length > 0 && <img src={`/api/admin/vacancies/${encodeURIComponent(vacancy.id)}/telegram/photos/${vacancy.telegramSource.photoIds.length - 1}`} alt="Фото из Telegram" className="max-h-48 max-w-48 object-contain" loading="lazy" />}</div><pre className="whitespace-pre-wrap">{vacancy.telegramSource.rawText}</pre></section>}
    {vacancy?.telegramSource && <section className="rounded-panel border border-line bg-white p-5"><button type="button" className="button-secondary" disabled={reparseBusy || saving || telegramBusy} onClick={() => { void previewReparse() }}>Разобрать исходный пост</button>{reparse && <div><p>Предпросмотр извлечённых данных. Подтверждение заполнит только пустые поля и заменит исходные заголовок и текст, если они не редактировались. Изменения будут только в форме до сохранения.</p><section aria-label={e('reparsePreview')} className="my-4 space-y-4 rounded-card border border-line p-4">
      <h3 className="text-base font-semibold">{e('reparsePreview')}</h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          [e('title'), reparse.title], [e('company'), reparse.company],
          [e('city'), options.cities.find(city => city.id === reparse.cityId)?.name],
          [t('workFormat'), (['remote', 'hybrid', 'office'] as const).find(item => item === reparse.workFormat) ? t(reparse.workFormat) : ''],
          [e('employment'), (['fullTime', 'partTime', 'internship'] as const).find(item => item === reparse.employment) ? t(reparse.employment) : ''],
          [e('reparseSalary'), (() => { const salary = reparse.salary; if (!salary || (salary.min == null && salary.max == null) || salary.currency !== 'RUB') return ''; const number = new Intl.NumberFormat(intlLocale); const amount = salary.min != null && salary.max != null ? `${number.format(salary.min)}–${number.format(salary.max)}` : salary.min != null ? t('salaryFrom', { amount: number.format(salary.min) }) : t('salaryTo', { amount: number.format(salary.max ?? 0) }); return `${amount} ${t('monthly')}` })()],
          [t('description'), reparse.description],
        ].map(([label, text]) => <div key={label} className="min-w-0"><dt className="text-sm font-medium text-ink-mute">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{text?.trim() || e('reparseMissing')}</dd></div>)}
      </dl>
      {(['responsibilities', 'requirements', 'conditions'] as const).map(key => { const items = (reparse[key] ?? []).filter(item => item.trim()); return <div key={key}><h4 className="text-sm font-medium text-ink-mute">{t(key)}</h4>{items.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words">{item}</li>)}</ul> : <p className="mt-1">{e('reparseMissing')}</p>}</div> })}
    </section><button type="button" className="button-secondary" disabled={saving || telegramBusy} onClick={() => { setValue(current => applyReparse(current, reparse)); setSaved(false); setReparse(null) }}>Подтвердить и заполнить пустые поля</button><button type="button" onClick={() => setReparse(null)}>Отмена</button></div>}</section>}
    {vacancy?.provenance === 'synthetic' && <p className="text-sm text-ink-mute">{e('provenance')}</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {saved && <p role="status" className="text-mint-ink">{e('saved')}</p>}
    <fieldset disabled={saving || telegramBusy} className="grid gap-4 rounded-panel border border-line bg-white p-5 sm:grid-cols-2">
      <legend className="font-semibold">{e('editor')}</legend>
      {(['title', 'company'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium">{e(key)}<input aria-label={e(key)} className="field min-h-11 w-full text-base" required value={value[key]} onChange={event => set(key, event.target.value)} /></label>)}
      {(['industryId', 'cityId'] as const).map(key => { const kind = key === 'industryId' ? 'industries' : 'cities'; return <CreatableDictionarySelect key={key} label={key === 'industryId' ? t('industry') : e('city')} kind={kind} items={options[kind]} value={value[key]} onChange={id => set(key, id)} onCreated={item => setOptions(current => ({ ...current, [kind]: [...current[kind], item] }))} onPending={setDictionaryPending} /> })}
      {([{ key: 'workFormat', label: t('workFormat'), options: ['remote', 'hybrid', 'office'] }, { key: 'employment', label: e('employment'), options: ['fullTime', 'partTime', 'internship'] }, { key: 'experience', label: e('experience'), options: ['junior', 'middle', 'senior'] }, { key: 'status', label: t('status'), options: ['draft', 'published', 'archived'] }] as const).map(({ key, label, options }) => <label key={key} className="grid gap-2 text-sm font-medium">{label}<select aria-label={label} className="field min-h-11 w-full text-base" value={value[key]} onChange={event => set(key, event.target.value as typeof value[typeof key])}><option value="">—</option>{options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select></label>)}
      {(['min', 'max'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium">{e(key)}<input aria-label={e(key)} type="number" min="0" className="field min-h-11 w-full text-base" value={value.salary?.[key] ?? ''} onChange={event => { const next = { min: value.salary?.min ?? null, max: value.salary?.max ?? null, currency: 'RUB' as const, [key]: event.target.value === '' ? null : Number(event.target.value) }; set('salary', next.min === null && next.max === null ? null : next) }} /></label>)}
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t('description')}<textarea aria-label={t('description')} required rows={5} className="field w-full text-base" value={value.description} onChange={event => set('description', event.target.value)} /></label>
      {(['responsibilities', 'requirements', 'conditions'] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium sm:col-span-2">{t(key)}<span className="text-xs font-normal text-ink-mute">{e('lines')}</span><textarea aria-label={t(key)} rows={4} className="field w-full text-base" value={value[key].join('\n')} onChange={event => set(key, event.target.value.split('\n'))} /></label>)}
    </fieldset>
    {vacancy && <TelegramPublish vacancy={vacancy} dirty={dirty || saving || dictionaryPending} onBusy={setTelegramBusy} />}
    <div className="flex flex-wrap gap-3"><button className="button min-h-11" disabled={saving || dictionaryPending || telegramBusy} type="submit">{e(saving ? 'saving' : 'save')}</button><button className="button-secondary min-h-11" disabled={saving || dictionaryPending || telegramBusy} type="button" onClick={cancel}>{e('cancel')}</button>{vacancy && vacancy.status !== 'archived' && <button className="button-ghost min-h-11" disabled={saving || dictionaryPending || telegramBusy} type="button" onClick={() => { if (window.confirm(e('archiveConfirm'))) void save('archived') }}>{e('archive')}</button>}</div>
  </form>
}
