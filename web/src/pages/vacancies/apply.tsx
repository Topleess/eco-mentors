import Head from 'next/head'
import { Footer, NavHeader } from '@/components'
import { VacancyApplicationForm } from '@/features/vacancies/VacancyApplicationForm'
export default function Apply(): JSX.Element {
  return <><Head><title>Предложить вакансию</title><meta name="robots" content="noindex" /></Head><NavHeader /><main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8"><h1>Предложить вакансию</h1><p>Расскажите о вакансии — редакция проверит её перед публикацией.</p><VacancyApplicationForm /></main><Footer /></>
}
