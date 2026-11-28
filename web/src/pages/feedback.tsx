import { Footer, MetaHeader, NavHeader } from '@/components'
import { FeedbackForm } from '@/features/feedback/FeedbackForm'
import { feedbackMessages } from '@/features/feedback/model'
import { useTranslation } from '@/i18n'

const messages = {
  ...feedbackMessages,
  intro: {
    ru: 'Предложите улучшение, сообщите о проблеме или задайте вопрос команде платформы.',
    en: 'Suggest an improvement, report a problem, or ask the platform team a question.',
  },
}

export default function Feedback(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <div className="flex min-h-screen flex-col">
      <MetaHeader customTitle={t('title')} customDescription={t('intro')} />
      <NavHeader />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{t('title')}</h1>
        <p className="mt-6 text-base leading-relaxed text-ink-soft">{t('intro')}</p>
        <FeedbackForm />
      </main>
      <Footer />
    </div>
  )
}
