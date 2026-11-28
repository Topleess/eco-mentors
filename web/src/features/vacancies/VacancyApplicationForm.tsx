import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Captcha, { type CaptchaInstance } from '@/components/forms/Captcha'
import type { VacancyDictionaries } from '@/features/vacancies/model'

export function VacancyApplicationForm(): JSX.Element {
  const [dict, setDict] = useState<VacancyDictionaries | null>(null)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const captcha = useRef<CaptchaInstance>(null)
  useEffect(() => { let active = true; void fetch('/api/vacancies/dictionaries').then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<VacancyDictionaries> }).then(data => { if (active) setDict(data) }).catch(() => { if (active) setError('Не удалось загрузить справочники. Обновите страницу.') }); return () => { active = false } }, [])
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!token || !consent || !dict || busy) return
    const values = new FormData(event.currentTarget)
    const text = (key: string) => String(values.get(key) || '').trim()
    const lines = (key: string) => text(key).split('\n').map(line => line.trim()).filter(Boolean)
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/vacancies/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: text('title'), company: text('company'), industryId: text('industryId'), cityId: text('cityId'), workFormat: text('workFormat'), experience: text('experience'), employment: text('employment'), description: text('description'), responsibilities: lines('responsibilities'), requirements: lines('requirements'), conditions: lines('conditions'), contact: text('contact'), captchaToken: token, consent }) })
      if (!response.ok) throw new Error()
      setDone(true)
    } catch { setError('Не удалось отправить заявку. Проверьте данные и попробуйте снова.') }
    finally { setToken(''); captcha.current?.reset(); setBusy(false) }
  }
  if (done) return <p role="status">Заявка отправлена. Она появится в каталоге после проверки.</p>
  return <form onSubmit={submit} className="grid max-w-2xl gap-4">
    {error && <p role="alert">{error}</p>}
    <label>Название вакансии<input className="field w-full" name="title" required maxLength={200} /></label>
    <label>Компания<input className="field w-full" name="company" required maxLength={200} /></label>
    <label>Отрасль<select className="field w-full" name="industryId" required defaultValue=""><option value="">Выберите отрасль</option>{dict?.industries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Город<select className="field w-full" name="cityId" required defaultValue=""><option value="">Выберите город</option>{dict?.cities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Формат работы<select className="field w-full" name="workFormat"><option value="office">Офис</option><option value="remote">Удалённо</option><option value="hybrid">Гибрид</option></select></label>
    <label>Опыт<select className="field w-full" name="experience"><option value="junior">Начинающий</option><option value="middle">Средний</option><option value="senior">Опытный</option></select></label>
    <label>Занятость<select className="field w-full" name="employment"><option value="fullTime">Полная</option><option value="partTime">Частичная</option><option value="internship">Стажировка</option></select></label>
    <label>Описание<textarea className="field w-full" name="description" maxLength={30000} rows={5} /></label>
    {([['responsibilities', 'Обязанности'], ['requirements', 'Требования'], ['conditions', 'Условия']] as const).map(([name, label]) => <label key={name}>{label} (по одному пункту в строке)<textarea className="field w-full" name={name} rows={4} /></label>)}
    <label>Контакт для связи<input className="field w-full" name="contact" aria-label="Контакт для связи" required maxLength={500} /><span className="block text-sm">Только для редакции, не публикуется.</span></label>
    <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required /> Согласен на обработку персональных данных согласно <Link href="/privacy">политике конфиденциальности</Link>.</label>
    <Captcha ref={captcha} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} options={{ language: 'ru' }} />
    <button className="button min-h-11" type="submit" disabled={!token || !consent || !dict || busy}>{busy ? 'Отправка…' : 'Отправить заявку'}</button>
  </form>
}
