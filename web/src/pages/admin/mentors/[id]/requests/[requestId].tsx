/**
 * Admin — single mentee request.
 *
 * Read-only view of what the mentee sent plus the admin status override. The
 * override is deliberately unrestricted: unlike the mentor's own inbox it can
 * move a request BACK out of a terminal status ("done" / "declined" /
 * "unavailable"), which is the reason this page exists. It never emails the
 * mentee — the backend keeps admin edits silent.
 */

import { useTranslation } from '@/i18n'
import { translateLabel } from '@/i18n/labels'
import type { Locale } from '@/i18n/core'
import { messages } from '@/i18n/messages/admin-requests'
import { statusLabel } from '@/components/mentor-admin/utils'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch, faStar } from '@fortawesome/free-solid-svg-icons'
import type { AdminMentorDetails, MentorClientRequest, RequestStatus } from '@/types'
import { ALL_REQUEST_STATUSES } from '@/types'
import { AuthGateScreen, NoIndexHead } from '@/components'
import { AdminAuthProvider, AdminLayout, useAdminAuth } from '@/components/admin-moderation'
import {
  MetaItem,
  StatusBadge,
  formatDateTime,
  formatRelativeTime,
} from '@/components/mentor-admin'
import {
  getModerationMentorById,
  getModerationMentorRequest,
  updateModerationRequestStatus,
} from '@/lib/admin-moderation-api'

const labelClass = 'mb-1 block text-[13px] font-semibold text-ink'

/** statusChangedAt is NULL on rows that predate status tracking. */
function formatOptionalDateTime(value: string | null, locale: Locale): string {
  return value ? formatDateTime(value, locale) : '—'
}

function AdminRequestDetailsContent(): JSX.Element {
  const { t, locale } = useTranslation(messages)
  const router = useRouter()
  const { id, requestId } = router.query
  const mentorId = Array.isArray(id) ? id[0] : id
  const clientRequestId = Array.isArray(requestId) ? requestId[0] : requestId
  const { isAuthenticated, isLoading: authLoading, session } = useAdminAuth()

  const [mentor, setMentor] = useState<AdminMentorDetails | null>(null)
  const [request, setRequest] = useState<MentorClientRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | ''>('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<RequestStatus | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/admin/login')
      return
    }
    if (!authLoading && session && session.role !== 'admin') {
      router.replace('/admin/mentors/pending')
    }
  }, [authLoading, isAuthenticated, router, session])

  useEffect(() => {
    if (!isAuthenticated || session?.role !== 'admin' || !mentorId || !clientRequestId) return

    let mounted = true
    const load = async (): Promise<void> => {
      try {
        setIsLoading(true)
        setError(null)
        const [mentorData, requestData] = await Promise.all([
          getModerationMentorById(mentorId),
          getModerationMentorRequest(mentorId, clientRequestId),
        ])
        if (!mounted) return
        if (!requestData) {
          setError('requestNotFound')
          return
        }
        setMentor(mentorData)
        setRequest(requestData)
        setSelectedStatus(requestData.status)
      } catch {
        if (mounted) {
          setError('loadRequestError')
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [isAuthenticated, session, mentorId, clientRequestId])

  const onSaveStatus = async (): Promise<void> => {
    if (!request || !mentorId || !selectedStatus || selectedStatus === request.status) return

    setIsSaving(true)
    setStatusError(null)
    setSavedStatus(null)
    try {
      const updated = await updateModerationRequestStatus(mentorId, request.id, selectedStatus)
      setRequest(updated)
      setSelectedStatus(updated.status)
      setSavedStatus(updated.status)
    } catch {
      setStatusError('updateError')
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || !isAuthenticated || session?.role !== 'admin') {
    return <AuthGateScreen title={t('detailTitle')} />
  }

  const isDirty = Boolean(request && selectedStatus && selectedStatus !== request.status)

  return (
    <AdminLayout title={t('detailTitle')}>
      <NoIndexHead title={request ? t('namedTitle', { name: request.name }) : t('detailTitle')} />

      {mentorId && (
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Link
            href={`/admin/mentors/${encodeURIComponent(mentorId)}/requests`}
            className="text-sm font-semibold text-brand-cobalt transition-colors duration-120 hover:text-brand-navy"
          >
            {t('allRequests')}
          </Link>
          <Link
            href={`/admin/mentors/${encodeURIComponent(mentorId)}`}
            className="text-sm font-semibold text-brand-cobalt transition-colors duration-120 hover:text-brand-navy"
          >
            {t('mentorProfile')}
          </Link>
        </div>
      )}

      {isLoading && (
        <div role="status" aria-label={t('loading')} className="flex items-center justify-center py-12">
          <FontAwesomeIcon
            icon={faCircleNotch}
            className="animate-spin text-2xl text-brand-cobalt"
          />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-card border border-danger/40 bg-white p-4 text-sm font-medium text-danger">
          {t(error as keyof typeof messages)}
        </div>
      )}

      {!isLoading && !error && request && (
        <div className="max-w-[820px] space-y-3.5">
          {/* Header */}
          <div className="rounded-panel border border-line bg-white p-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="my-0 font-name text-xl font-bold normal-case tracking-[-0.015em] text-ink">
                {request.name}
              </h2>
              <StatusBadge status={request.status} />
            </div>
            <div className="mt-1 text-sm text-ink-soft">
              <a
                href={`mailto:${request.email}`}
                className="break-all text-brand-cobalt transition-colors duration-120 hover:text-brand-navy"
              >
                {request.email}
              </a>{' '}
              · {t('requested', { time: formatRelativeTime(request.createdAt, locale) })}
              {mentor ? t('forMentor', { name: mentor.name }) : ''}
            </div>
          </div>

          {/* Message */}
          <div className="rounded-panel border border-line bg-white p-5 sm:px-7 sm:py-6">
            <div className="mb-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.03em] text-ink">
              {t('message')}
            </div>
            <p className="my-0 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
              {request.details}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4 sm:gap-6">
              <MetaItem label={t('level')} value={request.level ? translateLabel(locale, request.level) : '—'} />
              <MetaItem
                label={t('email')}
                value={request.email}
                href={`mailto:${request.email}`}
                copyable
              />
              {request.contact ? (
                <MetaItem label={t('contact')} value={request.contact} copyable />
              ) : (
                <MetaItem label={t('contact')} value="—" />
              )}
              <MetaItem label={t('received')} value={formatDateTime(request.createdAt, locale)} />
            </div>
          </div>

          {/* Review, when the mentee left one */}
          {request.review && (
            <div className="rounded-panel border border-line bg-white p-5 sm:px-7 sm:py-6">
              <div className="mb-2.5 flex items-center gap-2 font-display text-[13px] font-extrabold uppercase tracking-[0.03em] text-ink">
                <FontAwesomeIcon icon={faStar} className="text-brand-mint" />
                {t('review')}
              </div>
              <p className="my-0 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
                {request.review}
              </p>
            </div>
          )}

          {/* Decline details, when the mentor declined */}
          {(request.declineReason || request.declineComment) && (
            <div className="rounded-panel border border-line bg-white p-5 sm:px-7 sm:py-6">
              <div className="mb-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.03em] text-ink">
                {t('declineDetails')}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MetaItem label={t('reason')} value={request.declineReason || '—'} />
              </div>
              {request.declineComment && (
                <p className="my-0 mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
                  {request.declineComment}
                </p>
              )}
            </div>
          )}

          {/* Status + admin override */}
          <div className="rounded-panel border border-line bg-white p-5 sm:px-7 sm:py-6">
            <div className="mb-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.03em] text-ink">
              {t('status')}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
              <MetaItem label={t('currentStatus')} value={statusLabel(request.status, locale)} />
              <MetaItem
                label={t('statusChanged')}
                value={formatOptionalDateTime(request.statusChangedAt, locale)}
              />
              {request.scheduledAt && (
                <MetaItem label={t('scheduled')} value={formatDateTime(request.scheduledAt, locale)} />
              )}
              <MetaItem label={t('lastModified')} value={formatDateTime(request.modifiedAt, locale)} />
            </div>

            <div className="border-t border-line pt-4">
              <label htmlFor="request-status" className={labelClass}>
                {t('changeStatus')}
              </label>
              <p className="my-0 mb-2 text-[13px] text-ink-soft">
                {t('statusHelp')}
              </p>
              <select
                id="request-status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as RequestStatus)
                  setStatusError(null)
                  setSavedStatus(null)
                }}
                disabled={isSaving}
                className="field"
              >
                {ALL_REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status, locale)}
                  </option>
                ))}
              </select>

              {statusError && (
                <p className="my-0 mt-2 text-sm font-medium text-danger" role="alert">
                  {t(statusError as keyof typeof messages)}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onSaveStatus}
                  disabled={!isDirty || isSaving}
                  className="button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <FontAwesomeIcon icon={faCircleNotch} className="mr-2 animate-spin" />
                      {t('updating')}
                    </>
                  ) : (
                    t('updateStatus')
                  )}
                </button>
                {savedStatus && !isDirty && (
                  <span className="text-sm font-medium text-mint-ink">
                    {t('statusSaved', { status: statusLabel(savedStatus, locale) })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="meta-mono text-ink-mute">{t('requestId', { id: request.id })}</div>
        </div>
      )}
    </AdminLayout>
  )
}

export default function AdminRequestDetailsPage(): JSX.Element {
  return (
    <AdminAuthProvider>
      <AdminRequestDetailsContent />
    </AdminAuthProvider>
  )
}
