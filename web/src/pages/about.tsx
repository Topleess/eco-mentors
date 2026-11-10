import { useTranslation } from '@/i18n'
import { SOURCE_REPOSITORY_URL } from '@/config/source'
import { messages } from '@/i18n/messages/public-pages'
import Head from 'next/head'
import Link from 'next/link'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { pageTitle } from '@/config/seo'

/** Manifesto section: display heading + quiet body copy. */
function Block({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="mt-10 first:mt-0 sm:mt-12">
      <h2 className="my-0 text-xl sm:text-2xl">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-[1.65] text-ink-soft [&_a]:font-medium [&_a]:text-brand-cobalt [&_a]:underline [&_a]:decoration-brand-cobalt/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-brand-cobalt">
        {children}
      </div>
    </section>
  )
}

export default function About(): JSX.Element {
  const { t } = useTranslation(messages)
  const title = pageTitle(t('aboutPageTitle'))

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <MetaHeader customTitle={t('aboutOpenmentor')} />

      <NavHeader />

      <Section className="border-b border-line bg-surface" id="header">
        <div className="mx-auto max-w-[720px] py-4 text-center sm:py-8">
          <p className="meta-mono my-0 text-ink-mute">{t('openmentorIoAbout')}</p>
          <h1 className="my-0 mt-3 text-3xl sm:text-[40px]">
            {t('peopleHelpingPeople')} <span className="text-brand-cobalt">{t('grow')}</span>
          </h1>
          <p className="mb-0 mt-3 text-[15px] text-ink-soft">{t('whatOpenmentorIsWhyItSFree')}</p>
        </div>
      </Section>

      <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-8 sm:pb-24 sm:pt-12">
        <Block title={t('whyThisExists')}>
          <p className="my-0">{t('almostEveryoneWhoGrewInTechCan')}</p>
          <p className="my-0">{t('openmentorMakesThoseConversationsEasyToStart')}</p>
        </Block>

        <Block title={t('communityFirst')}>
          <p className="my-0">{t('thisIsCommunityHelpOrganizedNotA')}</p>
          <p className="my-0">
            {t('theRunningCostsServersAndEmailEssentially')}{' '}
            <Link href="/donate">{t('donations')}</Link> {t('fromPeopleWhoFindThePlatformUseful')}
          </p>
        </Block>

        <Block title={t('lightweightByDesign')}>
          <p className="my-0">{t('ourJobIsToMakeTheConnection')}</p>
          <p className="my-0">{t('paymentsFollowTheSamePrincipleIfA')}</p>
        </Block>

        <Block title={t('realPractitioners')}>
          <p className="my-0">{t('theMentorsHereAreWorkingProfessionalsSharing')}</p>
          <p className="my-0">
            {t('soundLikeYou')} <Link href="/bementor">{t('becomeAMentor')}</Link>{' '}
            {t('freeMentoringIsWarmlyEncouraged')}
          </p>
        </Block>

        <Block title={t('openByNature')}>
          <p className="my-0">
            {t('openmentorIsACommunityProjectAndThe')}{' '}
            <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              {t('openSource')}
            </a>{' '}
            {t('agplTheCatalogTheDashboardThisVery')}{' '}
            <a href="https://getmentor.dev" target="_blank" rel="noopener noreferrer">
              getmentor.dev
            </a>
            {t('theRussianLanguageCommunityThatProvedThousands')}
          </p>
          <p className="my-0">
            {t('questionsIdeasOrSomethingBrokenWriteTo')}{' '}
            <a href="mailto:hello@openmentor.io">hello@openmentor.io</a>{' '}
            {t('aHumanReadsEveryEmailMorePractical')} <Link href="/faq">{t('faq')}</Link>.
          </p>
        </Block>

        {/* ── CTA band ─────────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-col items-center gap-3 rounded-panel bg-pastel-sky-grad px-5 py-7 text-center sm:mt-14 sm:px-8 sm:py-9">
          <h2 className="my-0 text-xl sm:text-2xl">{t('meetSomeoneWhoSBeenThere')}</h2>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/" className="button px-[26px] py-[13px] text-[15px]">
              {t('findAMentor')}
            </Link>
            <Link href="/bementor" className="button-secondary px-[26px] py-[13px] text-[15px]">
              {t('becomeAMentor')}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
