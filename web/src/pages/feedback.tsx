import { Footer, MetaHeader, NavHeader } from '@/components'
import { useTranslation } from '@/i18n'

const messages = {
  title: { ru: 'Обратная связь', en: 'Feedback' },
  intro: {
    ru: 'Есть вопрос, предложение или замечание? Напишите нам на почту.',
    en: 'Have a question, suggestion, or comment? Email us.',
  },
  emailNote: {
    ru: 'При нажатии на адрес откроется почтовое приложение. Отправьте письмо из него или скопируйте адрес в свою почту.',
    en: 'Selecting the address opens your email app. Send your message there, or copy the address into your email service.',
  },
}

export default function Feedback(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <div className="flex min-h-screen flex-col">
      <MetaHeader customTitle={t('title')} />
      <NavHeader />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-12 sm:py-20">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{t('title')}</h1>
        <p className="mt-6 text-base leading-relaxed text-ink-soft">{t('intro')}</p>
        <a className="mt-4 inline-block break-all font-medium text-brand-cobalt underline underline-offset-4" href="mailto:ecocareerguide@yandex.ru">ecocareerguide@yandex.ru</a>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('emailNote')}</p>
      </main>
      <Footer />
    </div>
  )
}
