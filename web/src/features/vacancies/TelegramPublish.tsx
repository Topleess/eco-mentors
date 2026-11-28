import { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy } from '@/features/vacancies/model'

export function TelegramPublish({ vacancy, dirty, onBusy }: { vacancy: Vacancy; dirty: boolean; onBusy: (busy: boolean) => void }): JSX.Element {
  const { t } = useTranslation(editorMessages)
  const [preview, setPreview] = useState<{ text: string; version: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'previewError' | 'missingTitle' | 'missingCompany' | 'missingBoth' | 'notFound' | 'unconfigured' | 'publishError' | 'success' | null>(null)
  useEffect(() => { setPreview(null); setResult(null) }, [dirty, vacancy.id, vacancy.version])
  const run = async (action: 'preview' | 'publish') => {
    if (busy || dirty || (action === 'publish' && (!preview || vacancy.status !== 'published'))) return
    if (action === 'preview' && (!vacancy.title.trim() || !vacancy.company.trim())) {
      setPreview(null)
      setResult(!vacancy.title.trim() && !vacancy.company.trim() ? 'missingBoth' : !vacancy.title.trim() ? 'missingTitle' : 'missingCompany')
      return
    }
    setBusy(true); onBusy(true); setResult(null)
    try {
      const response = await fetch(`/api/admin/vacancies/${encodeURIComponent(vacancy.id)}/telegram/${action}`, {
        method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'publish' ? { version: preview?.version } : {}),
      })
      if (!response.ok) {
        if (response.status === 404) { setPreview(null); setResult('notFound'); return }
        if (response.status === 503 && action === 'publish') { setResult('unconfigured'); return }
        throw new Error('Telegram request failed')
      }
      const data: unknown = await response.json()
      if (action === 'preview') {
        if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string' || !('version' in data) || typeof data.version !== 'number') throw new Error('Invalid preview')
        setPreview({ text: data.text, version: data.version })
      } else {
        if (!data || typeof data !== 'object' || !('messageId' in data) || typeof data.messageId !== 'number') throw new Error('Invalid publication response')
        setPreview(null); setResult('success')
      }
    } catch { setPreview(null); setResult(action === 'preview' ? 'previewError' : 'publishError') }
    finally { setBusy(false); onBusy(false) }
  }
  return <section className="space-y-3 rounded-panel border border-line bg-white p-5" aria-label={t('telegramTitle')}>
    <h2 className="font-semibold">{t('telegramTitle')}</h2>
    <p>{t('telegramSavedData')}</p>
    {vacancy.status !== 'published' && <p>{t('telegramRequiresPublished')}</p>}
    {dirty && <p>{t('telegramDirty')}</p>}
    {result && <p role={result === 'success' ? 'status' : 'alert'}>{t(result === 'success' ? 'telegramSuccess' : result === 'previewError' ? 'telegramUnavailable' : result === 'missingTitle' ? 'telegramMissingTitle' : result === 'missingCompany' ? 'telegramMissingCompany' : result === 'missingBoth' ? 'telegramMissingBoth' : result === 'notFound' ? 'telegramNotFound' : result === 'unconfigured' ? 'telegramUnconfigured' : 'telegramFailed')}</p>}
    <button className="button-secondary min-h-11" type="button" disabled={dirty || busy} onClick={() => { void run('preview') }}>{t('telegramPreview')}</button>
    {!dirty && preview && <><p className="whitespace-pre-wrap break-words">{preview.text}</p>{vacancy.status === 'published' && <button className="button min-h-11" type="button" disabled={busy} onClick={() => { void run('publish') }}>{t('telegramConfirm')}</button>}</>}
  </section>
}
