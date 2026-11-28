import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Captcha, { type CaptchaInstance } from '@/components/forms/Captcha'
import { feedbackCategories, feedbackMessageLimit, feedbackMessages } from '@/features/feedback/model'
import { useTranslation } from '@/i18n'

const messages = {
  ...feedbackMessages,
  category: { ru: 'Категория', en: 'Category' },
  choose: { ru: 'Выберите категорию', en: 'Choose a category' },
  message: { ru: 'Сообщение', en: 'Message' },
  hint: { ru: 'Не указывайте пароли и чужие контактные данные.', en: 'Do not include passwords or other people’s contact details.' },
  email: { ru: 'Почта для ответа (необязательно)', en: 'Reply email (optional)' },
  private: { ru: 'Сообщение и почту увидят только администраторы платформы.', en: 'Only platform administrators can see your message and email.' },
  consent: { ru: 'Согласен на обработку данных сообщения. Подробнее — в', en: 'I agree to the processing of this message and its data. See the' },
  privacy: { ru: 'политике конфиденциальности', en: 'privacy policy' },
  captcha: { ru: 'Пройдите проверку, чтобы отправить сообщение.', en: 'Complete the verification to send your message.' },
  send: { ru: 'Отправить', en: 'Send feedback' },
  sending: { ru: 'Отправляем…', en: 'Sending…' },
  sent: { ru: 'Сообщение отправлено', en: 'Message sent' },
  another: { ru: 'Написать ещё', en: 'Send another message' },
  invalid: { ru: 'Проверьте категорию, сообщение и почту для ответа.', en: 'Check the category, message and reply email.' },
  failed: { ru: 'Не удалось отправить сообщение. Пройдите проверку и попробуйте ещё раз.', en: 'Could not send the message. Complete the verification and try again.' },
  limited: { ru: 'Слишком много попыток. Попробуйте позже.', en: 'Too many attempts. Try again later.' },
} as const

type FeedbackError = '' | 'invalid' | 'failed' | 'limited'

export function FeedbackForm(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const captcha = useRef<CaptchaInstance>(null)
  const pending = useRef(false)
  const lastSubmission = useRef<{ payload: string; id: string } | null>(null)
  const [token, setToken] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<FeedbackError>('')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!token || !consent || pending.current) return
    const form = new FormData(event.currentTarget)
    const category = String(form.get('category') ?? '')
    const message = String(form.get('message') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    if (!feedbackCategories.some(value => value === category) || !message || message.length > feedbackMessageLimit) {
      setError('invalid')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const data = { category, message, ...(email ? { email } : {}), consent }
      const payload = JSON.stringify(data)
      if (lastSubmission.current?.payload !== payload) lastSubmission.current = { payload, id: crypto.randomUUID() }
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, submissionId: lastSubmission.current.id, captchaToken: token }),
      })
      if (response.status === 201 && (await response.json() as { success?: boolean }).success === true) {
        lastSubmission.current = null
        setConsent(false)
        setSent(true)
      } else {
        if (response.status === 409) lastSubmission.current = null
        setError(response.status === 429 ? 'limited' : 'failed')
      }
    } catch {
      setError('failed')
    } finally {
      setToken('')
      captcha.current?.reset()
      pending.current = false
      setBusy(false)
    }
  }

  if (sent) return (
    <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-7">
      <p role="status" className="my-0 text-lg font-semibold text-ink">{t('sent')}</p>
      <button type="button" className="button-secondary mt-4 min-h-11" onClick={() => setSent(false)}>{t('another')}</button>
    </section>
  )
  return (
    <form onSubmit={submit} className="mt-8 rounded-panel border border-line bg-white p-5 sm:p-7" aria-busy={busy}>
      <fieldset className="grid min-w-0 gap-4" disabled={busy}>
        <div className="grid gap-1.5">
          <label htmlFor="feedback-category" className="text-sm font-semibold">{t('category')}</label>
          <select id="feedback-category" name="category" required defaultValue="" className="field min-h-11 w-full">
            <option value="" disabled>{t('choose')}</option>
            {feedbackCategories.map(category => <option value={category} key={category}>{t(category)}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="feedback-message" className="text-sm font-semibold">{t('message')}</label>
          <textarea id="feedback-message" name="message" required maxLength={feedbackMessageLimit} rows={5} aria-describedby="feedback-hint" className="field w-full" />
          <p id="feedback-hint" className="my-0 text-sm text-ink-soft">{t('hint')}</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="feedback-email" className="text-sm font-semibold">{t('email')}</label>
          <input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={254} className="field min-h-11 w-full" />
        </div>
        <p className="my-0 text-sm text-ink-soft">{t('private')}</p>
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-cobalt" required checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>{t('consent')} <Link href="/privacy" className="font-medium text-brand-cobalt underline underline-offset-4">{t('privacy')}</Link>.</span>
        </label>
        {!token && <p className="my-0 text-sm text-ink-soft">{t('captcha')}</p>}
        <Captcha ref={captcha} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} options={{ language: locale }} onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />
        {error && <p role="alert" className="my-0 text-sm text-danger">{t(error)}</p>}
        <button type="submit" className="button min-h-11 w-full sm:w-fit" disabled={!token || !consent || busy}>{t(busy ? 'sending' : 'send')}</button>
      </fieldset>
    </form>
  )
}
