import Head from 'next/head'
import Link from 'next/link'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { useTranslation } from '@/i18n'
import { legalMessages } from '@/i18n/messages/legal'
import { pageTitle } from '@/config/seo'

export default function Terms(): JSX.Element {
  const { t, locale } = useTranslation(legalMessages)
  const title = pageTitle('Terms of Service')

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <MetaHeader customTitle="Terms of Service" />

      <NavHeader />

      <Section className="border-b border-line bg-surface" id="header">
        <div className="mx-auto max-w-[720px] py-4 text-center sm:py-8">
          <p className="meta-mono my-0 text-ink-mute">{t('termsOpenMentorIoLegal')}</p>
          <h1 className="my-0 mt-3 text-3xl sm:text-[40px]">{t('termsTermsOfService')}</h1>
          <p className="mb-0 mt-3 text-[15px] text-ink-soft">{t('termsForTheOpenMentorIoService')}</p>
        </div>
      </Section>

      {/* <main> gives content-extraction (Readability, LLM fetchers) a clean
          boundary around the legal body, apart from nav/header chrome. */}
      <main>
        <Section className="bg-white py-12">
          <div className="prose mx-auto max-w-[720px] px-4 prose-headings:font-display prose-headings:font-extrabold prose-headings:uppercase prose-h2:text-xl prose-h2:tracking-[-0.01em] prose-h3:text-base prose-hr:border-line">
            {locale === 'ru' && (
              <p className="text-sm text-ink-soft">
                {t('translationNotice')}{' '}
                <Link href="/terms" locale="en">{t('originalEnglish')}</Link>
              </p>
            )}
            <p>
              <strong>{t('termsLastUpdated')}</strong>{t('terms9July2026')}</p>

            <p>{t('termsTheseTermsOfServiceTermsGovernYour')}</p>

            <hr />

            <h2>{t('terms1WhatTheServiceIs')}</h2>

            <p>{t('termsOpenMentorIsAnOnlinePlatformThatProvides')}</p>

            <p>{t('termsOpenMentorIsA')}<strong>{t('termsTechnicalIntermediaryOnly')}</strong>{t('termsWeAreNotAPartyToAny')}</p>

            <h2>{t('terms2NoPaymentProcessing')}</h2>

            <p>{t('termsOpenMentorDoesNotProcessPaymentsAndDoes')}<strong>{t('termsDirectlyBetweenTheMentorAndTheMentee')}</strong>{t('termsOutsideTheServiceWeAreNotResponsible')}</p>

            <h2>{t('terms3ProfilesAndAccuracyOfInformation')}</h2>

            <p>{t('termsInformationPublishedByMentorsInTheirProfiles')}{' '}
              <strong>{t('termsIsNotVerifiedByTheService')}</strong>{t('termsItIsPublishedAsIsAndIs')}</p>

            <p>{t('termsYouAreResponsibleForTheAccuracyOf')}</p>

            <h2>{t('terms4CodeOfConduct')}</h2>

            <p>{t('termsWhenUsingTheServiceYouAgreeTo')}</p>

            <ul>
              <li>{t('termsTreatOtherUsersWithRespectAndProfessionalism')}</li>
              <li>{t('termsNotPostOrSendContentThatIs')}</li>
              <li>{t('termsNotImpersonateAnotherPersonOrMisrepresentYour')}</li>
              <li>{t('termsNotUseTheServiceForSpamAdvertising')}</li>
              <li>{t('termsNotAttemptToDisruptProbeOrCircumvent')}</li>
              <li>{t('termsNotScrapeOrHarvestOtherUsersPersonal')}</li>
              <li>{t('termsUseContactDetailsObtainedThroughTheService')}</li>
            </ul>

            <h2>{t('terms5ModerationAndRemoval')}</h2>

            <p>{t('termsWeReviewMentorApplicationsBeforePublicationAnd')}</p>

            <p>{t('termsYouMayStopUsingTheServiceAt')}{' '}
              <Link href="/privacy">{t('termsPrivacyPolicy')}</Link>{t('terms')}</p>

            <h2>{t('terms6NotForMedicalOrHealthInformation')}</h2>

            <p>{t('termsTheServiceIsIntendedForProfessionalAnd')}{' '}
              <strong>{t('termsNotIntendedForExchangingMedicalOrHealth')}</strong>{t('termsAndMustNotBeUsedToSeek')}</p>

            <h2>{t('terms7Disclaimers')}</h2>

            <p>{t('termsTheServiceIsProvidedFreeOfCharge')}</p>

            <ul>
              <li>{t('termsWeGive')}<strong>{t('termsNoGuarantees')}</strong>{t('termsRegardingTheQualityContentUsefulnessOrOutcome')}</li>
              <li>{t('termsAllClaimsDisagreementsAndDisputesBetweenA')}<strong>{t('termsExclusivelyBetweenThem')}</strong>{t('termsWithoutTheParticipationOfTheService')}</li>
              <li>{t('termsWeAreNotResponsibleForTheContent')}</li>
              <li>{t('termsWeDoNotWarrantThatTheService')}</li>
            </ul>

            <h2>{t('terms8LimitationOfLiability')}</h2>

            <p>{t('termsToTheMaximumExtentPermittedByApplicable')}</p>

            <h2>{t('terms9Privacy')}</h2>

            <p>{t('termsOurProcessingOfPersonalDataIsDescribed')}{' '}
              <Link href="/privacy">{t('termsPrivacyPolicy')}</Link>{t('terms')}</p>

            <h2>{t('terms10ChangesToTheServiceAndThese')}</h2>

            <p>{t('termsWeMayModifyOrDiscontinuePartsOf')}{' '}
              <Link href="/terms">{t('termsOpenmentorIoTerms')}</Link>{t('termsTogetherWithItsLastUpdatedDateFor')}</p>

            <h2>{t('terms11GoverningLawAndJurisdiction')}</h2>

            <p>{t('termsTheseTermsAreGovernedByTheLaws')}</p>

            <h2>{t('terms12Contact')}</h2>

            <p>{t('termsQuestionsAboutTheseTerms')}{' '}
              <a href="mailto:hello@openmentor.io">{t('termsHelloOpenmentorIo')}</a>{t('termsPrivacyMatters')}{' '}
              <a href="mailto:privacy@openmentor.io">{t('termsPrivacyOpenmentorIo')}</a>{t('terms')}</p>
          </div>
        </Section>
      </main>

      <Footer />
    </>
  )
}
