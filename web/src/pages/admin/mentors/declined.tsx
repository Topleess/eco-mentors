import { NoIndexHead } from '@/components'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'
import { AdminAuthProvider, MentorModerationListPage } from '@/components/admin-moderation'

export default function DeclinedMentorsPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <AdminAuthProvider>
      <NoIndexHead title={t('declinedHead')} />
      <MentorModerationListPage status="declined" title={t('declinedTitle')} />
    </AdminAuthProvider>
  )
}
