import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/common'

interface CalendlabWidgetProps {
  url: string
}

export default function CalendlabWidget({ url }: CalendlabWidgetProps): JSX.Element {
  const { t } = useTranslation(messages)
  const embedUrl = url + '?embed=true'

  return <iframe title={t('calendarTitle')} src={embedUrl} width="100%" height="700px" frameBorder="0"></iframe>
}
