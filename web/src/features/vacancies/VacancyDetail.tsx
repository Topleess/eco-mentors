import Link from 'next/link'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy } from '@/features/vacancies/model'
import { VacancyFacts } from '@/features/vacancies/VacancyCard'

export function VacancyDetail({ vacancy }: { vacancy: Vacancy }): JSX.Element {
  const { t } = useTranslation(messages)
  const { t: e } = useTranslation(editorMessages)
  return <>
    <Link href="/vacancies" className="button-ghost mb-6 inline-flex min-h-11 items-center px-3 text-sm"><span aria-hidden="true">←</span> {t('back')}</Link>
    <p className="mb-2 mt-0 text-ink-mute">{vacancy.company}</p>
    <h1 className="my-0 mb-5 text-3xl sm:text-[40px]">{vacancy.title}</h1>
    <VacancyFacts vacancy={vacancy} />
    <div className="my-8 rounded-panel border border-line bg-surface p-5"><p className="my-0 text-sm font-semibold text-brand-cobalt">{t('notice')}</p>{vacancy.provenance === 'synthetic' && <p className="mb-0 mt-2 text-sm text-ink-mute">{e('provenance')}</p>}</div>
    <section><h2 className="text-xl">{t('description')}</h2><p className="leading-relaxed text-ink-soft">{vacancy.description}</p></section>
    {(['responsibilities', 'requirements', 'conditions'] as const).map(key => <section key={key} className="mt-8"><h2 className="text-xl">{t(key)}</h2><ul className="list-disc space-y-2 pl-5 leading-relaxed text-ink-soft">{vacancy[key].map(item => <li key={item}>{item}</li>)}</ul></section>)}
  </>
}
