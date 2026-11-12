import Link from 'next/link'
import { useTranslation } from '@/i18n'
import { SOURCE_REPOSITORY_URL } from '@/config/source'
import { messages } from '@/i18n/messages/common'

import BrandLogo from '@/components/brand/BrandLogo'
import GitHubIcon from '../ui/GitHubIcon'

export default function Footer(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <footer className="mt-auto bg-brand-navy" data-section="footer">
      <div className="flex flex-col gap-4 px-5 py-6 xl:flex-row xl:items-center xl:justify-between sm:px-8 sm:py-10 lg:px-16">
        <Link href="/" aria-label="Лаборатория ЭкоКарьеры" className="shrink-0 text-white">
          <BrandLogo />
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/mentors" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('allMentors')}
          </Link>
          <Link href="/about" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('about')}
          </Link>
          <Link href="/faq" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('faq')}
          </Link>
          <Link href="/bementor" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('becomeMentor')}
          </Link>
          <Link href="/privacy" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('terms')}
          </Link>
        </nav>
        <span className="flex shrink-0 flex-col items-start gap-3">
          <Link
            href={SOURCE_REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('github')}
            className="inline-flex items-center gap-2 text-white/75 transition-colors duration-120 hover:text-white"
          >
            <GitHubIcon className="h-[18px] w-[18px]" />
            <span className="text-[13px] font-medium">{t('sourceCode')}</span>
          </Link>
          <span className="text-xs text-white/75">OpenMentor · AGPL-3.0</span>
        </span>
      </div>
    </footer>
  )
}
