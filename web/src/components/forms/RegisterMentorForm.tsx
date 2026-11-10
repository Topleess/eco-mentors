import { translateLabel } from '@/i18n/labels'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/forms'
import Select, { type MultiValue, type StylesConfig } from 'react-select'
import Image from 'next/image'
import classNames from 'classnames'
import { useForm, Controller } from 'react-hook-form'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import Wysiwyg from './Wysiwyg'
import PriceField from './PriceField'
import { formatPrice, isValidPrice, type PriceValue } from '@/lib/price'
import filters from '@/config/filters'
import { MAX_IMAGE_FILE_BYTES, MAX_IMAGE_FILE_LABEL } from '@/config/uploads'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { Tooltip } from 'react-tooltip'
import Link from 'next/link'
import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react'
import type { RegisterMentorRequest, ProfilePictureData } from '@/types/api'
import {
  slugifyUsername,
  isUsernameFormatValid,
  useUsernameAvailability,
  USERNAME_MAX_LENGTH,
} from '@/lib/username'
import { isValidCalendarUrl } from '@/lib/safe-url'

interface TagOption {
  value: string
  label: string
}

interface RegisterFormData {
  name: string
  email: string
  contact: string
  username: string
  job: string
  workplace: string
  experience: string
  /**
   * Edited as a {kind, amount} pair and serialized to its canonical string on
   * submit — "fixed with no amount yet" is a state the stored string has no
   * spelling for. Null until the mentor picks one; nothing is preselected.
   */
  price: PriceValue | null
  tags: string[]
  about: string
  description: string
  competencies: string
  calendarUrl?: string
}

interface RegisterMentorFormProps {
  isLoading: boolean
  isError: boolean
  onSubmit: (data: RegisterMentorRequest) => void
}

// react-select restyled to the design system: 1.5px line border with 12px
// radius, cobalt focus ring, navy chips (design 04 — tag multi-select).
const selectStyles: StylesConfig<TagOption, true> = {
  control: (base, state) => ({
    ...base,
    padding: '5px 6px',
    borderWidth: '1.5px',
    borderColor: state.isFocused ? '#2F5EFF' : '#DEDBD1', // cobalt / --om-line
    borderRadius: '12px',
    boxShadow: state.isFocused ? '0 0 0 3px rgb(47 94 255 / 0.13)' : 'none',
    transition: 'border-color 120ms ease-out, box-shadow 120ms ease-out',
    '&:hover': {
      borderColor: state.isFocused ? '#2F5EFF' : '#DEDBD1',
    },
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: '999px',
    backgroundColor: '#132A52', // brand navy
    transition: 'background-color 120ms ease-in-out',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'white',
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: '1.25rem',
    padding: '0.1875rem 0.25rem 0.1875rem 0.625rem',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'white',
    borderRadius: '0 999px 999px 0',
    paddingRight: '0.5rem',
    '&:hover': {
      backgroundColor: '#0E2140', // navy, one step darker
      color: 'white',
    },
  }),
  option: (base, state) => ({
    ...base,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    padding: '0.5rem 0.75rem',
    color: state.isSelected ? 'white' : '#161A20', // ink
    backgroundColor: state.isSelected ? '#2F5EFF' : state.isFocused ? '#F7F6F2' : 'white',
    '&:active': {
      backgroundColor: '#EDEBE4', // surface-deep
    },
  }),
  menu: (base) => ({
    ...base,
    border: '1px solid #DEDBD1', // --om-line
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 16px 36px -12px rgb(19 42 82 / 0.25)', // shadow-dropdown
  }),
  input: (base) => ({
    ...base,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: '0.875rem',
    color: '#5B6270', // ink-soft
  }),
}

// Convert string array to option array for react-select
const tagsToOptions = (tags: string[], locale: 'ru' | 'en'): TagOption[] =>
  tags.map((tag) => ({ value: tag, label: translateLabel(locale, tag) }))
const MAX_TAGS = 5

interface RailSection {
  id: string
  label: string
  complete: boolean
}

/**
 * Progress rail dot: outline while the section is incomplete, fills mint
 * with a 150ms scale pop once it completes (design 04 MOTION note).
 */
function RailDot({ complete, onNavy }: { complete: boolean; onNavy: boolean }): JSX.Element {
  return (
    <span className="relative h-2 w-2 flex-none" aria-hidden="true">
      <span
        className={classNames(
          'absolute inset-0 rounded-full border-2',
          complete ? 'border-transparent' : onNavy ? 'border-white/40' : 'border-line'
        )}
      />
      <span
        className={classNames(
          'absolute inset-0 rounded-full bg-brand-mint transition-transform duration-150 ease-pop',
          complete ? 'scale-100' : 'scale-0'
        )}
      />
    </span>
  )
}

export default function RegisterMentorForm({
  isLoading,
  isError,
  onSubmit,
}: RegisterMentorFormProps): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const {
    control,
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>()

  // Username auto-fills from the name (slugified) until the mentor edits it
  // manually, after which we stop overwriting their choice.
  const [usernameEdited, setUsernameEdited] = useState(false)
  const nameValue = watch('name')
  const usernameValue = watch('username') || ''

  useEffect(() => {
    if (usernameEdited) return
    setValue('username', slugifyUsername(nameValue || ''))
  }, [nameValue, usernameEdited, setValue])

  const usernameAvailability = useUsernameAvailability(usernameValue, '/api/username-availability')

  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<keyof typeof messages | ''>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const turnstileRef = useRef<TurnstileInstance>(null)

  // Turnstile tokens are single-use and are consumed by the backend even when
  // registration is rejected for a recoverable reason (e.g. the username was
  // taken between the live check and submit). Reset the widget on every failed
  // attempt so a retry sends a FRESH token instead of the spent one — the
  // parent flips submitStatus back to 'idle' before each submit, so isError
  // toggles and this effect re-fires per failure.
  useEffect(() => {
    if (isError) {
      turnstileRef.current?.reset()
      setCaptchaToken('')
    }
  }, [isError])

  const processImageFile = (file: File | undefined): void => {
    setImageError('') // Clear any previous errors

    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setImageError('imageTypeError')
      return
    }

    // The limit is the RAW file; the request that carries it is ~4/3 bigger
    // because the photo goes out base64-encoded inside JSON. See config/uploads.
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setImageError('imageSizeError')
      return
    }

    setSelectedImage(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>): void => {
    processImageFile(e.target.files?.[0])
  }

  const handleImageDrop = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault()
    setIsDragOver(false)
    processImageFile(e.dataTransfer.files?.[0])
  }

  const handleCancelImage = (): void => {
    setSelectedImage(null)
    setImagePreview(null)
    setImageError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCaptchaOnSuccess = (token: string): void => {
    setCaptchaToken(token)
  }

  const handleCaptchaOnExpire = (): void => {
    setCaptchaToken('')
  }

  const handleFormSubmit = (data: RegisterFormData): void => {
    if (!selectedImage || !imagePreview) {
      setImageError('profilePhotoRequired')
      return
    }

    // Don't submit a username we already know is taken/invalid — the server
    // rechecks, but this saves a round-trip and keeps the user on the field.
    if (usernameAvailability.status === 'unavailable') {
      document.getElementById('username')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!captchaToken) {
      return
    }

    const profilePicture: ProfilePictureData = {
      image: imagePreview,
      fileName: selectedImage.name,
      contentType: selectedImage.type,
    }

    // The Controller's rule already blocks an incomplete price, so a null here
    // means that rule and formatPrice disagree — drop the submit rather than
    // register a mentor at a price they did not choose.
    const price = data.price === null ? null : formatPrice(data.price)
    if (price === null) return

    onSubmit({
      ...data,
      price,
      username: data.username?.trim() || undefined,
      profilePicture,
      captchaToken,
    })
  }

  // ── Progress rail: best-effort section completion from form state ─────
  const values = watch()
  const hasRichText = (html?: string): boolean => {
    if (!html) return false
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return Boolean(doc.body.textContent?.trim())
  }

  const sections: RailSection[] = [
    {
      id: 'reg-contact',
      label: t('contactSection'),
      complete:
        Boolean(values.name?.trim()) &&
        /^\S+@\S+$/i.test(values.email || '') &&
        isUsernameFormatValid((values.username || '').trim()),
    },
    {
      id: 'reg-profile',
      label: t('profileSection'),
      complete: Boolean(
        selectedImage &&
          values.job?.trim() &&
          values.workplace?.trim() &&
          values.experience &&
          // Not just "a kind is chosen": "Set an amount" with an empty box
          // would otherwise mark the section complete and send the mentor on to
          // a submit the Controller's rule then blocks.
          values.price !== null &&
          isValidPrice(values.price)
      ),
    },
    {
      id: 'reg-expertise',
      label: t('expertiseSection'),
      complete:
        (values.tags?.length ?? 0) >= 1 &&
        hasRichText(values.about) &&
        hasRichText(values.description) &&
        Boolean(values.competencies?.trim()),
    },
    {
      id: 'reg-scheduling',
      label: t('scheduling'),
      complete: Boolean(captchaToken) && isValidCalendarUrl(values.calendarUrl),
    },
  ]
  const currentIndex = sections.findIndex((section) => !section.complete)
  const completeCount = sections.filter((section) => section.complete).length

  const requiredText = t('required')

  const requiredMark = <span className="text-danger"> *</span>

  const fieldError = (message: string): JSX.Element => (
    <div className="mt-2 text-sm font-medium text-danger" role="alert">
      {message}
    </div>
  )

  const labelClass = 'mb-1.5 block text-sm font-semibold text-ink'
  const sectionHeadingClass = 'mb-0 text-[22px] leading-[1.1] tracking-[-0.01em]'

  return (
    <div className="lg:flex lg:items-start lg:gap-14">
      {/* ── Section rail: desktop-only, sticky (design 04) ─────────────── */}
      <nav
        aria-label={t('formSections')}
        className="hidden w-[220px] flex-none flex-col gap-0.5 lg:sticky lg:top-6 lg:flex"
      >
        <div className="mb-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-ink">{' '}{t('becomeMentor')}{' '}</div>
        {sections.map((section, index) => {
          const isCurrent = index === currentIndex
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={classNames(
                'flex items-center gap-2.5 rounded-[11px] px-3.5 py-[11px] text-[13px] transition-colors duration-120',
                isCurrent
                  ? 'bg-brand-navy font-semibold !text-white'
                  : 'font-medium text-ink-mute hover:bg-surface hover:text-ink'
              )}
            >
              <RailDot complete={section.complete} onNavy={isCurrent} />
              {section.label}
            </a>
          )
        })}
        <p className="mb-0 mt-3.5 px-3.5 text-xs leading-[1.55] text-ink-soft">{' '}{t('editableHint')}{' '}</p>
      </nav>

      <div className="min-w-0 flex-1 lg:max-w-[620px]">
        {/* ── Mobile: rail becomes a slim progress bar (design 04 mobile) ── */}
        <div className="mb-7 lg:hidden" aria-hidden="true">
          <div className="flex gap-[5px]">
            {sections.map((section, index) => (
              <span
                key={section.id}
                className={classNames(
                  'h-[5px] flex-1 rounded-full transition-colors duration-180',
                  section.complete
                    ? 'bg-brand-mint'
                    : index === currentIndex
                    ? 'bg-brand-cobalt'
                    : 'bg-line'
                )}
              />
            ))}
          </div>
          <div className="meta-mono mt-1.5 text-[10px] text-ink-mute">
            {completeCount}{' '}{t('sectionsCompleteSuffix')}{' '}</div>
        </div>

        <form className="space-y-9" onSubmit={handleSubmit(handleFormSubmit)}>
          <section id="reg-contact" className="scroll-mt-6 space-y-5">
            <h2 className={sectionHeadingClass}>{' '}{t('contactSectionNumbered')}{' '}</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelClass}>{' '}{t('fullName')}{' '}{requiredMark}
                </label>

                <input
                  type="text"
                  {...register('name', { required: true, maxLength: 100 })}
                  id="name"
                  autoComplete="name"
                  className={classNames('field', errors.name && 'field-error')}
                />

                {errors.name && fieldError(requiredText)}
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>{' '}{t('email')}{' '}{requiredMark}{' '}
                  <span className="font-normal text-ink-soft">{' '}{t('emailPrivate')}{' '}</span>
                </label>

                <input
                  type="email"
                  {...register('email', { required: true, pattern: /^\S+@\S+$/i, maxLength: 255 })}
                  id="email"
                  autoComplete="email"
                  className={classNames('field', errors.email && 'field-error')}
                />

                {errors.email && errors.email.type === 'required' && fieldError(requiredText)}
                {errors.email &&
                  errors.email.type === 'pattern' &&
                  fieldError(t('emailValidation'))}
              </div>
            </div>

            <div>
              <label htmlFor="contact" className={labelClass}>{' '}{t('registrationContact')}{' '}</label>

              <input
                type="text"
                {...register('contact', { maxLength: 100 })}
                id="contact"
                className={classNames('field', errors.contact && 'field-error')}
              />

              {errors.contact && fieldError(t('contactMaxLength'))}

              <p className="mb-0 mt-2 text-sm text-ink-soft">{' '}{t('registrationContactHint')}{' '}</p>
            </div>

            <div>
              <label htmlFor="username" className={labelClass}>{' '}{t('profileLink')}{' '}</label>

              <div
                className={classNames(
                  'flex items-center overflow-hidden rounded-xl border-[1.5px] bg-white transition-colors focus-within:border-brand-cobalt focus-within:ring-[3px] focus-within:ring-brand-cobalt/[0.13]',
                  usernameAvailability.status === 'unavailable' ? 'border-danger' : 'border-line'
                )}
              >
                <span className="select-none whitespace-nowrap py-2.5 pl-3.5 pr-0 font-mono text-sm text-ink-soft">
                  openmentor.io/mentor/
                </span>
                <input
                  type="text"
                  id="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={USERNAME_MAX_LENGTH}
                  {...register('username', {
                    maxLength: USERNAME_MAX_LENGTH,
                    onChange: (e: ChangeEvent<HTMLInputElement>) => {
                      setUsernameEdited(true)
                      // Keep the value URL-safe as they type (spaces/uppercase
                      // become hyphens/lowercase); the server is authoritative.
                      const cleaned = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, '-')
                        .replace(/-{2,}/g, '-')
                      if (cleaned !== e.target.value) {
                        setValue('username', cleaned)
                      }
                    },
                  })}
                  className="w-full min-w-0 border-0 bg-transparent py-2.5 pl-0 pr-3.5 font-mono text-sm text-ink outline-none placeholder:text-ink-soft/60"
                  placeholder={t('usernamePlaceholder')}
                />
              </div>

              <div className="mt-2 min-h-[1.25rem] text-sm" role="status" aria-live="polite">
                {usernameAvailability.status === 'checking' && (
                  <span className="text-ink-soft">
                    <FontAwesomeIcon icon={faCircleNotch} spin className="mr-1.5" />{' '}{t('usernameChecking')}{' '}</span>
                )}
                {usernameAvailability.status === 'available' && (
                  <span className="font-medium text-mint-ink">{' '}{t('usernameAvailable')}{' '}</span>
                )}
                {usernameAvailability.status === 'unavailable' && (
                  <span className="font-medium text-danger">
                    {usernameAvailability.reason === 'taken'
                      ? t('usernameTaken')
                      : usernameAvailability.reason === 'reserved'
                        ? t('usernameReserved')
                        : t('usernameFormat')}
                  </span>
                )}
                {usernameAvailability.status === 'idle' && (
                  <span className="text-ink-soft">{' '}{t('profileLinkHint')}{' '}</span>
                )}
              </div>
            </div>
          </section>

          <section id="reg-profile" className="scroll-mt-6 space-y-5">
            <h2 className={sectionHeadingClass}>{' '}{t('profileSectionNumbered')}{' '}</h2>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="w-full sm:w-[180px] sm:flex-none">
                <label htmlFor="profilePicture" className={labelClass}>{' '}{t('profilePhoto')}{' '}{requiredMark}
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  id="profilePicture"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />

                {/* Dropzone (design 04): dashed cobalt border, cobalt tint;
                    the photo lands with a 200ms scale-in preview. */}
                <label
                  htmlFor="profilePicture"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleImageDrop}
                  className={classNames(
                    'flex h-[190px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-3.5 text-center transition-colors duration-120',
                    isDragOver
                      ? 'border-brand-cobalt bg-brand-cobalt/[0.08]'
                      : 'border-brand-cobalt/50 bg-brand-cobalt/[0.04] hover:bg-brand-cobalt/[0.08]'
                  )}
                >
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt={t('preview')}
                      className="h-[130px] w-[130px] animate-rise-in rounded-card object-cover"
                      unoptimized
                      width={130}
                      height={130}
                    />
                  ) : (
                    <>
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="text-brand-cobalt"
                      >
                        <path
                          d="M12 16V5M12 5l-4 4M12 5l4 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="text-[13px] font-semibold text-brand-cobalt">{' '}{t('uploadPhoto')}{' '}</span>
                      <span className="text-[11px] leading-[1.45] text-ink-soft">{' '}{t('photoBackgroundHint')}{' '}</span>
                    </>
                  )}
                </label>

                <p className="meta-mono mb-0 mt-2 text-[10px] text-ink-mute">{' '}{t('photoFormats')}{' '}{MAX_IMAGE_FILE_LABEL}
                </p>

                {selectedImage && (
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="min-w-0 break-words text-xs text-mint-ink">{' '}{t('photoSelected')}{' '}{selectedImage.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelImage}
                      className="text-xs font-semibold text-ink-soft underline hover:text-ink"
                    >{' '}{t('cancel')}{' '}</button>
                  </div>
                )}

                {imageError && fieldError(t(imageError, { size: MAX_IMAGE_FILE_LABEL }))}
              </div>

              <div className="min-w-0 flex-1 space-y-5">
                <div>
                  <label htmlFor="job" className={labelClass}>{' '}{t('jobTitle')}{' '}{requiredMark}
                  </label>

                  <input
                    type="text"
                    {...register('job', { required: true, maxLength: 200 })}
                    id="job"
                    autoComplete="organization-title"
                    className={classNames('field', errors.job && 'field-error')}
                  />

                  {errors.job && fieldError(requiredText)}
                </div>

                <div>
                  <label htmlFor="workplace" className={labelClass}>{' '}{t('company')}{' '}{requiredMark}{' '}
                    <a data-tooltip-id="workplace-tip">
                      <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                    </a>
                    <Tooltip id="workplace-tip" place="right" className="z-50">
                      <span>{' '}{t('companyHint')}{' '}</span>
                    </Tooltip>
                  </label>

                  <input
                    type="text"
                    {...register('workplace', { required: true, maxLength: 200 })}
                    id="workplace"
                    autoComplete="organization"
                    className={classNames('field', errors.workplace && 'field-error')}
                  />

                  {errors.workplace && fieldError(requiredText)}
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="experience" className={labelClass}>{' '}{t('experience')}{' '}{requiredMark}
                </label>

                <select
                  {...register('experience', { required: true })}
                  id="experience"
                  className={classNames('field', errors.experience && 'field-error')}
                >
                  <option value="">{' '}{t('selectExperience')}{' '}</option>
                  {Object.keys(filters.experience).map((item) => (
                    <option
                      key={filters.experience[item as keyof typeof filters.experience]}
                      value={filters.experience[item as keyof typeof filters.experience]}
                    >
                      {translateLabel(locale, item)}
                    </option>
                  ))}
                </select>

                {errors.experience && fieldError(requiredText)}
              </div>

              <div>
                <Controller
                  control={control}
                  name="price"
                  defaultValue={null}
                  rules={{ validate: (value) => value !== null && isValidPrice(value) }}
                  render={({ field }) => (
                    <PriceField
                      value={field.value}
                      onChange={field.onChange}
                      inputRef={field.ref}
                      label={t('priceLabel')}
                      labelClassName={labelClass}
                      requiredMark={requiredMark}
                      invalid={Boolean(errors.price)}
                      error={
                        errors.price
                          ? t('priceValidation')
                          : undefined
                      }
                    />
                  )}
                />
              </div>
            </div>
          </section>

          <section id="reg-expertise" className="scroll-mt-6 space-y-5">
            <h2 className={sectionHeadingClass}>{' '}{t('expertiseSectionNumbered')}{' '}</h2>

            <div>
              <label htmlFor="tags" className={labelClass}>{' '}{t('specialization')}{' '}{requiredMark}{' '}
                <a data-tooltip-id="tags-tip">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                </a>
                <Tooltip id="tags-tip" place="right" className="z-50">
                  <span>{' '}{t('specializationHint')}{' '}<br />{' '}{t('tagsSearchHint')}{' '}<br />{' '}{t('tagsProfileHint')}{' '}<br />{' '}{t('tagsValidation')}{' '}</span>
                </Tooltip>
              </label>

              <p className="mb-1.5 mt-0 text-[13px] text-ink-soft">{' '}{t('tagsMaxPrefix')}{' '}{MAX_TAGS}{' '}{t('tagsMaxSuffix')}{' '}</p>

              <Controller
                name="tags"
                control={control}
                defaultValue={[]}
                rules={{
                  required: true,
                  validate: (value) =>
                    (value.length >= 1 && value.length <= 5) || t('tagsChoiceValidationStem'),
                }}
                render={({ field }) => (
                  <Select<TagOption, true>
                    instanceId="register-mentor-tags"
                    isMulti
                    value={tagsToOptions(field.value || [], locale)}
                    onChange={(newValue: MultiValue<TagOption>) => {
                      if (newValue.length <= MAX_TAGS) {
                        field.onChange(newValue.map((opt) => opt.value))
                      }
                    }}
                    options={tagsToOptions(filters.tags, locale)}
                    closeMenuOnSelect={false}
                    placeholder={t('selectTags')}
                    noOptionsMessage={() => t('noOptions')}
                    styles={selectStyles}
                    classNamePrefix="react-select"
                  />
                )}
              />

              {errors.tags && errors.tags.type !== 'validate' && fieldError(requiredText)}
              {errors.tags && errors.tags.type === 'validate' && fieldError(t('tagsChoiceValidation'))}
            </div>

            <div>
              <label htmlFor="about" className={labelClass}>{' '}{t('about')}{' '}{requiredMark}{' '}
                <a data-tooltip-id="about-tip">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                </a>
                <Tooltip id="about-tip" place="right" className="z-50">
                  <span>{' '}{t('aboutHintPrefix')}{' '}<br />{' '}{t('aboutHintSuffix')}{' '}</span>
                </Tooltip>
              </label>

              <Controller
                name="about"
                control={control}
                defaultValue=""
                rules={{ required: true }}
                render={({ field }) => (
                  <Wysiwyg
                    content={field.value}
                    onUpdate={(editor) => field.onChange(editor.getHTML())}
                  />
                )}
              />

              {errors.about && fieldError(requiredText)}
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>{' '}{t('help')}{' '}{requiredMark}{' '}
                <a data-tooltip-id="description-tip">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                </a>
                <Tooltip id="description-tip" place="right" className="z-50">
                  <span>{' '}{t('helpHint')}{' '}<br />
                  </span>
                  <em>
                    <span>{' '}{t('helpExampleIntro')}{' '}</span>
                    <ul>
                      <li>{' '}{t('helpExampleKubernetes')}{' '}</li>
                      <li>{' '}{t('helpExampleProcesses')}{' '}</li>
                      <li>{' '}{t('helpExampleStartup')}{' '}</li>
                    </ul>
                  </em>
                  <br />
                  <span>{' '}{t('menteeLevelsHint')}{' '}<em>{' '}{t('menteeLevelsExample')}{' '}</em>
                  </span>
                </Tooltip>
              </label>

              <Controller
                name="description"
                control={control}
                defaultValue=""
                rules={{ required: true }}
                render={({ field }) => (
                  <Wysiwyg
                    content={field.value}
                    onUpdate={(editor) => field.onChange(editor.getHTML())}
                  />
                )}
              />

              {errors.description && fieldError(requiredText)}
            </div>

            <div>
              <label htmlFor="competencies" className={labelClass}>{' '}{t('skills')}{' '}{requiredMark}{' '}
                <a data-tooltip-id="competencies-tip">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                </a>
                <Tooltip id="competencies-tip" place="right" className="z-50">
                  <span>{' '}{t('skillsHint')}{' '}</span>
                </Tooltip>
              </label>

              <input
                type="text"
                {...register('competencies', { required: true, maxLength: 5000 })}
                id="competencies"
                className={classNames('field', errors.competencies && 'field-error')}
              />

              {errors.competencies && fieldError(requiredText)}
            </div>
          </section>

          <section id="reg-scheduling" className="scroll-mt-6 space-y-5">
            <h2 className={sectionHeadingClass}>{' '}{t('schedulingSection')}{' '}</h2>

            <div>
              <label htmlFor="calendarUrl" className={labelClass}>{' '}{t('calendarLabelPrefix')}{' '}<Link
                  href="https://koalendar.com"
                  target="_blank"
                  className="link"
                  rel="noreferrer"
                >
                  Koalendar
                </Link>
                ,{' '}
                <Link href="https://calendly.com" target="_blank" className="link" rel="noreferrer">
                  Calendly
                </Link>{' '}{' '}{t('calendarLabelSuffix')}{' '}{' '}
                <a data-tooltip-id="calendar-tip">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-ink-soft" />
                </a>
                <Tooltip id="calendar-tip" place="right" className="z-50">
                  <span>{' '}{t('registerCalendarHint')}{' '}</span>
                </Tooltip>
              </label>

              <input
                type="text"
                {...register('calendarUrl', {
                  // Trim first: a pasted booking link often carries
                  // surrounding whitespace, which the API's https_url tag
                  // rejects.
                  setValueAs: (value: string) => value.trim(),
                  validate: {
                    checkUrl: isValidCalendarUrl,
                  },
                  maxLength: 500,
                })}
                id="calendarUrl"
                className={classNames('field', errors.calendarUrl && 'field-error')}
              />

              {errors.calendarUrl && fieldError(t('calendarValidation'))}
            </div>

            <div>
              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
                onSuccess={handleCaptchaOnSuccess}
                onExpire={handleCaptchaOnExpire}
                options={{ language: locale }}
              />

              {!captchaToken && errors.name && (
                <div className="mt-2 text-sm font-medium text-danger">{' '}{t('captchaConfirm')}{' '}</div>
              )}
            </div>
          </section>

          {isError && (
            <div className="rounded-field border-[1.5px] border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">{' '}{t('submitError')}{' '}</div>
          )}

          <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              className="button px-[30px] py-[15px] text-[15px]"
              disabled={isLoading || !captchaToken}
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon className="animate-spin" icon={faCircleNotch} />
                  <span className="ml-2">{' '}{t('submitting')}{' '}</span>
                </>
              ) : (
                <span>{' '}{t('createProfile')}{' '}</span>
              )}
            </button>

            <span className="text-[13px] leading-[1.5] text-ink-soft">{' '}{t('magicLinkHint')}{' '}</span>
          </div>
        </form>
      </div>
    </div>
  )
}
