import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/common'

interface KoalendarProps {
  url: string
}

export default function Koalendar({ url }: KoalendarProps): JSX.Element {
  const { t } = useTranslation(messages)
  const embedUrl = url + '?embed=true'

  return <iframe title={t('calendarTitle')} src={embedUrl} width="100%" height="800px" frameBorder="0"></iframe>
}
