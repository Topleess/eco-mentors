import { useState } from 'react'
import { useTranslation } from '@/i18n'
import { SOURCE_REPOSITORY_URL } from '@/config/source'
import { messages } from '@/i18n/messages/common'
import LanguageSwitcher from './LanguageSwitcher'
import classNames from 'classnames'
import Link from 'next/link'
import BrandLogo from '@/components/brand/BrandLogo'
import GitHubIcon from '../ui/GitHubIcon'

/** Two-line identity; font is inherited from the shared Inter stack. */
export function Wordmark({ compact = false }: { compact?: boolean }): JSX.Element {
  return <span className={classNames('font-sans font-normal leading-[1.18] tracking-[-0.025em]', compact ? 'text-[15px]' : 'text-[18px]')}><span className="block">Лаборатория</span><span className="block">ЭкоКарьеры</span></span>
}

interface NavHeaderProps {
  className?: string
  /**
   * Contextual left-pointing link shown instead of the default nav items
   * (e.g. "← Back to mentors" on the mentor profile page).
   */
  backLink?: { href: string; label: string }
}

export default function NavHeader({ className, backLink }: NavHeaderProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation(messages)

  return (
    <header className={classNames('border-b border-line bg-white', className)}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5 lg:px-16">
        <Link href="/" aria-label="Лаборатория ЭкоКарьеры" className="mr-auto shrink-0">
          <BrandLogo />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-5 xl:flex">
          {backLink ? (
            <Link href={backLink.href} className="text-sm font-semibold text-brand-cobalt">
              ← {backLink.label}
            </Link>
          ) : (
            <>
              <Link
                href={SOURCE_REPOSITORY_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('github')}
                className="text-ink-soft transition-colors duration-120 hover:text-ink"
              >
                <GitHubIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/vacancies"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:text-brand-cobalt"
              >
                {t('vacancies')}
              </Link>
              <Link
                href="/research"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:text-brand-cobalt"
              >
                {t('research')}
              </Link>
              <Link
                href="/about"
                className="text-sm font-semibold text-ink hover:text-brand-cobalt"
              >
                {t('about')}
              </Link>
              <Link
                href="/mentor/login"
                className="text-sm font-semibold text-ink hover:text-brand-cobalt"
              >
                {t('login')}
              </Link>
            </>
          )}
          <Link
            href="/bementor"
            className="button whitespace-nowrap"
          >
            {t('becomeMentor')}
          </Link>
        </nav>

        <LanguageSwitcher />

        {/* mobile hamburger */}
        <button
          type="button"
          aria-label={open ? t('closeMenu') : t('openMenu')}
          aria-expanded={open}
          aria-controls="site-mobile-navigation"
          onClick={() => setOpen(!open)}
          className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] xl:hidden"
        >
          <span
            className={classNames(
              'h-0.5 w-5 rounded-full bg-ink transition-transform duration-180',
              open && 'translate-y-[7px] rotate-45',
            )}
          />
          <span
            className={classNames(
              'h-0.5 w-5 rounded-full bg-ink transition-opacity duration-120',
              open && 'opacity-0',
            )}
          />
          <span
            className={classNames(
              'h-0.5 w-5 rounded-full bg-ink transition-transform duration-180',
              open && '-translate-y-[7px] -rotate-45',
            )}
          />
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <nav id="site-mobile-navigation" className="flex animate-dropdown-in flex-col gap-1 border-t border-line px-5 py-4 xl:hidden">
          {backLink && (
            <Link
              href={backLink.href}
              className="rounded-field px-3 py-3 text-sm font-semibold text-brand-cobalt"
              onClick={() => setOpen(false)}
            >
              ← {backLink.label}
            </Link>
          )}
          <Link
            href={SOURCE_REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-field px-3 py-3 text-sm font-semibold text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            <GitHubIcon className="h-[18px] w-[18px] text-ink-soft" />
            GitHub
          </Link>
          <Link
            href="/vacancies"
            className="flex min-h-11 items-center rounded-field px-3 py-3 text-sm font-semibold text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            {t('vacancies')}
          </Link>
          <Link
            href="/research"
            className="flex min-h-11 items-center rounded-field px-3 py-3 text-sm font-semibold text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            {t('research')}
          </Link>
          <Link
            href="/about"
            className="rounded-field px-3 py-3 text-sm font-semibold text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            {t('about')}
          </Link>
          <Link
            href="/mentor/login"
            className="rounded-field px-3 py-3 text-sm font-semibold text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            {t('login')}
          </Link>
          <Link
            href="/bementor"
            className="button mt-2"
            onClick={() => setOpen(false)}
          >
            {t('becomeMentor')}
          </Link>
        </nav>
      )}
    </header>
  )
}
