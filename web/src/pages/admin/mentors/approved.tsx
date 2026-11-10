import { NoIndexHead } from '@/components'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'
import { AdminAuthProvider, MentorModerationListPage } from '@/components/admin-moderation'

export default function ApprovedMentorsPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <AdminAuthProvider>
      <NoIndexHead title={t('approvedHead')} />
      <MentorModerationListPage status="approved" title={t('approvedTitle')} />
    </AdminAuthProvider>
  )
}
