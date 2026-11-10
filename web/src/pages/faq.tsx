import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/public-pages'
import Head from 'next/head'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { pageTitle } from '@/config/seo'
import { reactNodeToText } from '@/lib/react-text'
import { jsonLdScriptProps } from '@/lib/json-ld'

interface FaqEntry {
  id: string
  q: string
  a: ReactNode
}

// Content lives here as data so the rendered page and the FAQPage JSON-LD
// (below) are derived from the same source instead of a hand-duplicated
// plain-text copy that could drift.
/**
 * One question + answer. Questions are h3 (Inter bold, not display CAPS —
 * full-sentence questions read better in mixed case) with a self-anchor so
 * individual answers can be linked directly (e.g. /faq#payments-mentor).
 */
function QA({ id, q, children }: { id: string; q: string; children: ReactNode }): JSX.Element {
  return (
    <div id={id} className="scroll-mt-24 border-b border-line py-6 last:border-b-0">
      <h3 className="my-0 text-[17px] font-bold leading-[1.35] tracking-[-0.01em] text-ink">
        <a href={`#${id}`} className="hover:text-brand-cobalt">
          {q}
        </a>
      </h3>
      <div className="mt-2.5 flex flex-col gap-2.5 text-[15px] leading-[1.6] text-ink-soft [&_a]:font-medium [&_a]:text-brand-cobalt [&_a]:underline [&_a]:decoration-brand-cobalt/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-brand-cobalt">
        {children}
      </div>
    </div>
  )
}

export default function Faq(): JSX.Element {
  const { t, locale } = useTranslation(messages)
const menteeFaqs: FaqEntry[] = [
  {
    id: 'find-a-mentor',
    q: t('howDoIFindAndContactA'),
    a: (
      <>
        <p className="my-0">
          {t('browseThe')}{' '}<Link href="/">{t('catalog')}</Link> {t('noAccountNeededFilterByTopicSearch')}</p>
        <p className="my-0">
          {t('thereIsNoChatSystemOrBooking')}</p>
      </>
    ),
  },
  {
    id: 'cost',
    q: t('howMuchDoesASessionCost'),
    a: (
      <p className="my-0">
        {t('everyMentorSetsTheirOwnPriceYou')}{' '}<strong>{t('forFree')}</strong> {t('communityHelpIsWhatThisPlatformWas')}</p>
    ),
  },
  {
    id: 'payments',
    q: t('howDoPaymentsWork'),
    a: (
      <>
        <p className="my-0">
          {t('theyDonTGoThroughUsAnd')}</p>
        <p className="my-0">
          {t('theHonestFlipSideBecauseWeDon')}</p>
      </>
    ),
  },
  {
    id: 'what-to-write',
    q: t('whatShouldIWriteInMyRequest'),
    a: (
      <p className="my-0">
        {t('beSpecificWhereYouAreNowWhere')}</p>
    ),
  },
  {
    id: 'no-reply',
    q: t('whatIfAMentorDoesnTReply'),
    a: (
      <p className="my-0">
        {t('mentorsArePractitionersWithDayJobsSo')}</p>
    ),
  },
  {
    id: 'reviews',
    q: t('canILeaveAReview'),
    a: (
      <p className="my-0">
        {t('yesWhenYourMentorMarksTheSession')}</p>
    ),
  },
  {
    id: 'really-free',
    q: t('isThisReallyFreeWhatSThe'),
    a: (
      <p className="my-0">
        {t('thereIsnTOneOpenmentorIsA')}{' '}<Link href="/donate">{t('donations')}</Link> {t('thatCoverServersAndEmailThatS')}</p>
    ),
  },
]

const mentorFaqs: FaqEntry[] = [
  {
    id: 'become-a-mentor',
    q: t('howDoIBecomeAMentor'),
    a: (
      <p className="my-0">
        {t('fillInThe')}{' '}<Link href="/bementor">{t('applicationForm')}</Link>{t('thenConfirmYourEmailYourProfileGoes')}</p>
    ),
  },
  {
    id: 'good-mentor',
    q: t('whoMakesAGoodMentorHere'),
    a: (
      <>
        <p className="my-0">
          {t('someoneWhoDoesTheWorkTheyMentor')}</p>
        <p className="my-0">
          {t('goodProfilesNameWhoTheyCanHelp')}</p>
      </>
    ),
  },
  {
    id: 'mentor-for-free',
    q: t('doIHaveToChargeCanI'),
    a: (
      <p className="my-0">
        {t('youNeverHaveToChargeAndMentoring')}</p>
    ),
  },
  {
    id: 'payments-mentor',
    q: t('howDoPaymentsWorkIfIDo'),
    a: (
      <>
        <p className="my-0">
          {t('directlyBetweenYouAndYourMenteeYou')}</p>
        <p className="my-0">
          {t('theTradeOffStatedHonestlyYouAlso')}</p>
      </>
    ),
  },
  {
    id: 'not-visible',
    q: t('whyIsnTMyProfileVisibleRight'),
    a: (
      <p className="my-0">
        {t('twoStepsHappenFirstYouConfirmYour')}</p>
    ),
  },
  {
    id: 'returned',
    q: t('myProfileWasReturnedForEditsWhat'),
    a: (
      <p className="my-0">
        {t('notARejectionTheReviewerLeftYou')}</p>
    ),
  },
  {
    id: 'login',
    q: t('howDoILogInINever'),
    a: (
      <p className="my-0">
        {t('thereAreNoPasswordsGoToThe')}{' '}<Link href="/mentor/login">{t('loginPage')}</Link>{t('enterTheEmailYouRegisteredWithAnd')}</p>
    ),
  },
  {
    id: 'requests',
    q: t('howDoRequestsWorkWhatAmI'),
    a: (
      <>
        <p className="my-0">
          {t('whenAMenteeContactsYouTheRequest')}</p>
        <p className="my-0">
          {t('oneAskFromUsKeepTheRequest')}</p>
      </>
    ),
  },
  {
    id: 'unanswered',
    q: t('whatHappensIfIDonTRespond'),
    a: (
      <p className="my-0">
        {t('weLlNudgeYouAReminderWhen')}</p>
    ),
  },
  {
    id: 'decline',
    q: t('canIDeclineARequest'),
    a: (
      <p className="my-0">
        {t('ofCourseNotEveryRequestIsA')}</p>
    ),
  },
  {
    id: 'mentor-reviews',
    q: t('howDoReviewsWork'),
    a: (
      <p className="my-0">
        {t('whenYouMarkASessionAsDone')}</p>
    ),
  },
  {
    id: 'pause',
    q: t('howDoIPauseMentoringForA'),
    a: (
      <p className="my-0">
        {t('flipTheVisibilityToggleInYourDashboard')}</p>
    ),
  },
  {
    id: 'calendar',
    q: t('canILinkMyCalendar'),
    a: (
      <p className="my-0">
        {t('yesAddABookingLinkCalendlyKoalendar')}</p>
    ),
  },
  {
    id: 'profile-link',
    q: t('canIChangeMyProfileLink'),
    a: (
      <p className="my-0">
        {t('yesYouPickYourLinkWhenYou')}<span className="font-mono text-[0.95em]">openmentor.io/mentor/your-name</span>{t('andCanChangeItLaterFromYour')}</p>
    ),
  },
  {
    id: 'account',
    q: t('howDoIChangeMyEmailOr'),
    a: (
      <p className="my-0">
        {t('writeTo')}{' '}<a href="mailto:hello@openmentor.io">hello@openmentor.io</a> {t('andWeLlSortItOutFor')}{' '}
        <Link href="/privacy">{t('privacyPolicy')}</Link> {t('orEmail')}{' '}
        <a href="mailto:privacy@openmentor.io">privacy@openmentor.io</a> {t('profilesAndDataAreRemovedOnRequest')}</p>
    ),
  },
  {
    id: 'getmentor',
    q: t('iHadAProfileOnGetmentorDev'),
    a: (
      <p className="my-0">
        {t('noYouCanMoveYourExistingProfile')}{' '}
        <Link href="/migrate">openmentor.io/migrate</Link> {t('withYourGetmentorSlugAndScheduleThe')}{' '}
        <Link href="/bementor">{t('registerAnew')}</Link>.
      </p>
    ),
  },
  {
    id: 'commission',
    q: t('doesOpenmentorTakeACut'),
    a: (
      <p className="my-0">
        {t('noNotFromMentorsNotFromMentees')}{' '}<Link href="/donate">{t('donations')}</Link> {t('alone')}</p>
    ),
  },
]

const allFaqs: FaqEntry[] = [...menteeFaqs, ...mentorFaqs]

const faqJsonLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: locale,
  mainEntity: allFaqs.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: reactNodeToText(entry.a),
    },
  })),
}


  return (
    <>
      <Head>
        <title>{pageTitle(t('faqTitle'))}</title>
        <script {...jsonLdScriptProps(faqJsonLd)} />
      </Head>

      <MetaHeader customTitle={t('frequentlyAskedQuestions')} />

      <NavHeader />

      <Section className="border-b border-line bg-surface" id="header">
        <div className="mx-auto max-w-[720px] py-4 text-center sm:py-8">
          <p className="meta-mono my-0 text-ink-mute">{t('openmentorIoHelp')}</p>
          <h1 className="my-0 mt-3 text-3xl sm:text-[40px]">{t('frequentlyAskedQuestions')}</h1>
          <p className="mb-0 mt-3 text-[15px] text-ink-soft">
            {t('howOpenmentorWorksAndWhyItWorks')}</p>
          <div className="mt-5 flex justify-center gap-2.5">
            <a href="#mentees" className="button-secondary px-5 py-2.5 text-sm">
              {t('forMentees')}</a>
            <a href="#mentors" className="button-secondary px-5 py-2.5 text-sm">
              {t('forMentors')}</a>
          </div>
        </div>
      </Section>

      <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-4 sm:pb-24 sm:pt-8">
        {/* ── For mentees ──────────────────────────────────────────────── */}
        <h2 id="mentees" className="mb-1 mt-8 scroll-mt-24 text-2xl sm:text-[28px]">
          {t('forMentees')}</h2>

        {menteeFaqs.map((entry) => (
          <QA key={entry.id} id={entry.id} q={entry.q}>
            {entry.a}
          </QA>
        ))}

        {/* ── For mentors ──────────────────────────────────────────────── */}
        <h2 id="mentors" className="mb-1 mt-12 scroll-mt-24 text-2xl sm:text-[28px]">
          {t('forMentors')}</h2>

        {mentorFaqs.map((entry) => (
          <QA key={entry.id} id={entry.id} q={entry.q}>
            {entry.a}
          </QA>
        ))}

        {/* ── Outro ────────────────────────────────────────────────────── */}
        <div className="mt-10 rounded-panel border border-line bg-surface px-5 py-5 text-center sm:px-8 sm:py-6">
          <p className="my-0 text-[15px] leading-[1.6] text-ink-soft">
            {t('somethingWeDidnTCoverWriteTo')}{' '}
            <a
              href="mailto:hello@openmentor.io"
              className="font-medium text-brand-cobalt underline decoration-brand-cobalt/30 underline-offset-2 hover:decoration-brand-cobalt"
            >
              hello@openmentor.io
            </a>{' '}
            {' '}{t('aHumanReadsEveryEmail')}</p>
        </div>
      </main>

      <Footer />
    </>
  )
}
