import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import { saveDictionary } from './api'
import type { DictionaryEntry } from './model'

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export function CreatableDictionarySelect({ label, kind, items, value, onChange, onCreated, onPending }: { label: string; kind: 'cities' | 'industries'; items: DictionaryEntry[]; value: string; onChange: (id: string) => void; onCreated: (item: DictionaryEntry) => void; onPending: (pending: boolean) => void }): JSX.Element {
  const { t } = useTranslation(editorMessages)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const name = query.trim().replace(/\s+/g, ' ')
  const known = items.find(item => normalize(item.name) === normalize(name))
  const visible = items.filter((item, index) => items.findIndex(other => normalize(other.name) === normalize(item.name)) === index && normalize(item.name).includes(normalize(query)))
  const canCreate = !!name && !known
  const count = visible.length + Number(canCreate)
  const selected = items.find(item => item.id === value)
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus() }
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, id])
  const choose = async (index: number) => {
    if (lock.current) return
    const item = visible[index]
    if (item) { if (item.active) { onChange(item.id); close(true) }; return }
    if (!canCreate || index !== visible.length) return
    lock.current = true; setPending(true); onPending(true); setError('')
    try {
      const created = await saveDictionary(kind, { name, slug: `entry-${crypto.randomUUID()}`, active: true })
      onCreated(created); onChange(created.id); close(true)
    } catch { setError(t('createFailed')) }
    finally { lock.current = false; setPending(false); onPending(false) }
  }
  return <div ref={root} className="relative grid gap-2 text-sm font-medium" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) close() }}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} className="field flex min-h-11 w-full items-center justify-between gap-2 text-left text-base" onClick={() => { if (open) close(); else { if (!error && !pending) setQuery(''); setActive(-1); setOpen(true) } }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(-1) } }}><span>{selected ? `${selected.name}${!selected.active ? ` (${t('inactive')})` : ''}` : t('choose')}</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-panel border border-line bg-white p-2 shadow-dropdown motion-safe:animate-dropdown-in">
      <input ref={input} role="combobox" aria-label={`${t('search')}: ${label}`} aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-list`} aria-activedescendant={active >= 0 && active < count ? `${id}-option-${active}` : undefined} disabled={pending} className="field min-h-11 w-full text-base" value={query} onChange={event => { setQuery(event.target.value); setActive(-1); setError('') }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(true) }
        if (event.key === 'Tab') close()
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(current => count ? (current < 0 ? (event.key === 'ArrowDown' ? 0 : count - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + count) % count) : -1) }
        if (event.key === 'Enter') { event.preventDefault(); void choose(active >= 0 ? active : 0) }
      }} />
      <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} aria-busy={pending} className="mt-2 max-h-60 overflow-y-auto overscroll-contain">
        {visible.map((item, index) => <li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={item.id === value} aria-disabled={!item.active || pending} className={`flex min-h-11 cursor-pointer items-center rounded-field transition-colors duration-120 motion-reduce:transition-none px-3 py-2 text-base ${active === index ? 'bg-pastel-sky' : 'hover:bg-surface'} ${!item.active ? 'text-ink-mute' : ''}`} onMouseDown={event => event.preventDefault()} onClick={() => { void choose(index) }}>{item.name}{!item.active && ` — ${t('inactiveChoice')}`}</li>)}
        {canCreate && <li id={`${id}-option-${visible.length}`} role="option" aria-selected="false" aria-disabled={pending} className={`flex min-h-11 cursor-pointer items-center rounded-field transition-colors duration-120 motion-reduce:transition-none px-3 py-2 text-base ${active === visible.length ? 'bg-pastel-sky' : 'hover:bg-surface'}`} onMouseDown={event => event.preventDefault()} onClick={() => { void choose(visible.length) }}>+ {t('add')} «{name}»</li>}
      </ul>
      {!count && <p className="p-3 text-ink-mute">{t('typeToCreate')}</p>}
      {pending && <p role="status" className="p-2">{t('saving')}</p>}
      {error && <p role="alert" className="p-2 text-danger">{error}</p>}
    </div>}
  </div>
}
