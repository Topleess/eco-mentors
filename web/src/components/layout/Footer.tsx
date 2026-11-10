import Link from 'next/link'
import { useTranslation } from '@/i18n'
import { SOURCE_REPOSITORY_URL } from '@/config/source'
import { messages } from '@/i18n/messages/common'

import Image from 'next/image'
import GitHubIcon from '../ui/GitHubIcon'

/**
 * Redesign footer (design 01): navy band, white logomark + wordmark,
 * inline links, GitHub link + mono sign-off. `mt-auto` pins it to the
 * bottom of the viewport on short pages (the _app wrapper is a
 * min-h-screen flex column).
 */
export default function Footer(): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <footer className="mt-auto bg-brand-navy" data-section="footer">
      <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo/svg/logomark.svg"
            width={30}
            height={30}
            alt=""
            unoptimized
            className="brightness-0 invert"
          />
          <span className="font-display text-[15px] font-extrabold uppercase tracking-[-0.02em] text-white">
            openmentor.io
          </span>
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
          <Link href="/donate" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('donate')}
          </Link>
          <Link href="/bementor" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('becomeMentor')}
          </Link>
          <Link
            href="mailto:hello@openmentor.io"
            className="text-[13px] font-medium text-white/75 hover:text-white"
          >
            {t('email')}
          </Link>
          <Link href="/privacy" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="text-[13px] font-medium text-white/75 hover:text-white">
            {t('terms')}
          </Link>
        </nav>
        <span className="flex items-center gap-3">
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
          <span className="meta-mono text-white/50">{t('madeWith')}</span>
        </span>
      </div>
    </footer>
  )
}
