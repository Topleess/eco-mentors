import { useEffect, useId, useRef, useState } from 'react'

export function FilterPill({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string; count: number }[]
  onChange: (value: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [panelLeft, setPanelLeft] = useState(0)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent): void => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const selected = options.find(option => option.value === value)
  return <div ref={wrapper} className="relative min-w-0 max-w-full" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-pressed={Boolean(value)}
      className={`flex min-h-11 max-w-full items-center gap-[7px] rounded-field text-[13px] transition-colors duration-120 ${value ? 'bg-brand-navy px-4 py-2.5 font-bold text-white' : 'border-[1.5px] border-brand-cobalt/45 bg-white px-[15px] py-[8.5px] font-semibold text-brand-navy hover:bg-brand-cobalt/[0.06]'}`}
      onClick={() => {
        const left = wrapper.current?.getBoundingClientRect().left ?? 0
        const width = Math.min(300, window.innerWidth - 40)
        setPanelLeft(Math.min(0, window.innerWidth - 20 - left - width))
        setOpen(current => !current)
      }}>
      <span className="truncate">{value ? selected?.label ?? label : label}</span>
      <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" className={`shrink-0 transition-transform duration-120 ${open ? 'rotate-180' : ''}`}><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
    {open && <div id={panelId} style={{ left: panelLeft }} role="group" aria-label={label} className="absolute left-0 top-full z-20 mt-2 flex max-h-80 w-[min(300px,calc(100vw-40px))] max-w-[calc(100vw-40px)] animate-dropdown-in flex-col gap-0.5 overflow-y-auto rounded-card border border-line bg-white p-2 shadow-dropdown">
      {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
        className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-field px-3 py-[9px] text-left text-[13px] ${value === option.value ? 'bg-brand-cobalt font-semibold text-white' : 'font-medium text-ink hover:bg-surface'}`}
        onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus() }}>
        <span>{option.label}</span><span className={`font-mono text-[11px] font-medium ${value === option.value ? 'text-white/90' : 'text-ink-mute'}`}>{option.count}</span>
      </button>)}
    </div>}
  </div>
}
