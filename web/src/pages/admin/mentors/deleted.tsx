import { NoIndexHead } from '@/components'
import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/admin'
import { AdminAuthProvider, MentorModerationListPage } from '@/components/admin-moderation'

/**
 * Admin-only tab listing every deleted profile in one place (D70), most
 * recently deleted first. From here an admin can open a profile and restore it
 * — the only way out of the deleted state — until the retention window closes
 * and the purge job erases it for good.
 */
export default function DeletedMentorsPage(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <AdminAuthProvider>
      <NoIndexHead title={t('deletedHead')} />
      <MentorModerationListPage status="deleted" title={t('deletedTitle')} />
    </AdminAuthProvider>
  )
}
