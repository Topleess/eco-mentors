import { FilterPill } from '@/components/ui/FilterPill'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/vacancies/messages'
import type { Vacancy } from '@/features/vacancies/model'

interface VacancyFiltersProps {
  vacancies: Vacancy[]
  industry: string
  workFormat: string
  onIndustryChange: (value: string) => void
  onWorkFormatChange: (value: string) => void
}


export function VacancyFilters({ vacancies, industry, workFormat, onIndustryChange, onWorkFormatChange }: VacancyFiltersProps): JSX.Element {
  const { t } = useTranslation(messages)
  const options = (key: 'industry' | 'workFormat') => [
    { value: '', label: t('all'), count: vacancies.length },
    ...Array.from(new Set(vacancies.map(row => row[key]))).map(value => ({
      value,
      label: key === 'workFormat' ? t(value as Vacancy['workFormat']) : value,
      count: vacancies.filter(row => row[key] === value).length,
    })),
  ]
  return <div className="flex flex-wrap items-center gap-2">
    <FilterPill label={t('industry')} value={industry} options={options('industry')} onChange={onIndustryChange} />
    <FilterPill label={t('workFormat')} value={workFormat} options={options('workFormat')} onChange={onWorkFormatChange} />
  </div>
}
