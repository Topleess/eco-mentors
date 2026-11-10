import { NoIndexHead } from '@/components'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'
import { AdminAuthProvider, MentorModerationListPage } from '@/components/admin-moderation'

export default function PendingMentorsPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <AdminAuthProvider>
      <NoIndexHead title={t('pendingHead')} />
      <MentorModerationListPage status="pending" title={t('pendingTitle')} />
    </AdminAuthProvider>
  )
}
