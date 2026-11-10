import Image from 'next/image'
import { MAX_IMAGE_FILE_BYTES, MAX_IMAGE_FILE_LABEL } from '@/config/uploads'
import { useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/research/messages'

export const uploadedCoverPattern = /^\/api\/research\/covers\/[a-f0-9-]{36}$/

export function isResearchCoverUrl(value: string): boolean {
  if (
    !value ||
    value.includes('\\') ||
    /%(?:2e|2f|5c)/i.test(value) ||
    value.split('/').some((part) => part === '.' || part === '..')
  )
    return false
  if (uploadedCoverPattern.test(value) || /^\/research-assets\/[a-zA-Z0-9_./-]+$/.test(value))
    return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function ResearchCoverUpload({
  value,
  alt,
  disabled,
  onChange,
  onPending,
}: {
  value: string
  alt: string
  disabled: boolean
  onChange: (url: string) => void
  onPending: (pending: boolean) => void
}): JSX.Element {
  const { t } = useTranslation(messages)
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [failedPreview, setFailedPreview] = useState('')
  const previewable = isResearchCoverUrl(value) && failedPreview !== value
  const [error, setError] = useState<keyof typeof messages | ''>('')
  async function upload(file: File) {
    if (disabled || pending) return
    setError('')
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size === 0 ||
      file.size > MAX_IMAGE_FILE_BYTES
    ) {
      setError('coverInvalidFile')
      if (input.current) input.current.value = ''
      return
    }
    setPending(true)
    onPending(true)
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
          typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read'))
        reader.onerror = () => reject(new Error('read'))
        reader.readAsDataURL(file)
      })
      const response = await fetch('/api/admin/research/covers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, contentType: file.type }),
      })
      if (!response.ok) {
        setError(
          response.status === 413
            ? 'coverTooLarge'
            : response.status === 400
              ? 'coverRejected'
              : 'coverUploadError',
        )
        return
      }
      const result = (await response.json()) as { coverUrl: string }
      if (typeof result.coverUrl !== 'string' || !uploadedCoverPattern.test(result.coverUrl))
        throw new Error('Invalid cover response')
      setFailedPreview('')
      onChange(result.coverUrl)
    } catch {
      setError('coverUploadError')
    } finally {
      setPending(false)
      onPending(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <section className="space-y-3 rounded-panel border border-line p-4">
      {!value && <p className="text-ink-mute">{t('coverEmpty')}</p>}
      {value && !previewable && <p className="text-ink-mute">{t('coverPreviewFailed')}</p>}
      {previewable && (
        <Image
          onError={() => setFailedPreview(value)}
          src={value}
          alt={alt || t('coverPreview')}
          unoptimized
          width={640}
          height={360}
          className="h-56 w-full object-contain"
        />
      )}
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label={t('chooseCover')}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      <button
        type="button"
        className="button-secondary min-h-11"
        disabled={disabled || pending}
        onClick={() => input.current?.click()}
      >
        {t(pending ? 'coverUploading' : value ? 'coverReplace' : 'coverUpload')}
      </button>
      {value && (
        <button
          type="button"
          className="button-ghost min-h-11"
          disabled={disabled || pending}
          onClick={() => {
            setError('')
            onChange('')
          }}
        >
          {t('coverRemove')}
        </button>
      )}
      <p className="text-sm text-ink-soft">{t('coverFileHelp', { limit: MAX_IMAGE_FILE_LABEL })}</p>
      {error && (
        <p role="alert" className="text-danger">
          {t(error)}
        </p>
      )}
      <p className="text-sm text-ink-soft">{t('coverSaveHint')}</p>
    </section>
  )
}
