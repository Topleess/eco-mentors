import Link from 'next/link'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import { editorMessages } from '@/i18n/messages/vacancies-admin'
import type { Vacancy } from '@/features/vacancies/model'

export function VacancyFacts({ vacancy }: { vacancy: Vacancy }): JSX.Element {
  const { t, intlLocale } = useTranslation(messages)
  const number = new Intl.NumberFormat(intlLocale)
  const salary = vacancy.salary
  const amount = salary?.min != null && salary.max != null ? `${number.format(salary.min)}–${number.format(salary.max)}` : salary?.min != null ? t('salaryFrom', { amount: number.format(salary.min) }) : salary?.max != null ? t('salaryTo', { amount: number.format(salary.max) }) : null
  return <>
    <p className="my-0 text-sm text-ink-soft">{vacancy.location} · {t(vacancy.workFormat)} · {t(vacancy.employment)}</p>
    <p className="mb-0 mt-2 text-sm text-ink-mute">{vacancy.industry} · {t(vacancy.experience)}</p>
    <p className="mb-0 mt-4 font-semibold text-brand-navy">{amount ? `${amount} ${t('monthly')}` : t('salaryUnknown')}</p>
  </>
}

export function VacancyCard({ vacancy }: { vacancy: Vacancy }): JSX.Element {
  const { t } = useTranslation(editorMessages)
  return <article className="rounded-card border border-line bg-white p-5 sm:p-6">
    <p className="mb-1 mt-0 text-sm text-ink-mute">{vacancy.company}</p>
    <h2 className="my-0 mb-3 font-name text-xl normal-case tracking-normal"><Link className="inline-flex min-h-11 items-center text-brand-navy underline-offset-4 hover:text-brand-cobalt hover:underline" href={`/vacancies/${vacancy.slug}`}>{vacancy.title}</Link></h2>
    <VacancyFacts vacancy={vacancy} />
    {vacancy.provenance === 'synthetic' && <p className="mb-0 mt-3 text-xs text-ink-mute">{t('sample')}</p>}
  </article>
}
