import Head from 'next/head'
import Link from 'next/link'
import { Footer, MetaHeader, NavHeader, Section } from '@/components'
import { useTranslation } from '@/i18n'
import { legalMessages } from '@/i18n/messages/legal'
import { pageTitle } from '@/config/seo'

export default function Privacy(): JSX.Element {
  const { t, locale } = useTranslation(legalMessages)
  const title = pageTitle('Privacy Policy')

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <MetaHeader customTitle="Privacy Policy" />

      <NavHeader />

      <Section className="border-b border-line bg-surface" id="header">
        <div className="mx-auto max-w-[720px] py-4 text-center sm:py-8">
          <p className="meta-mono my-0 text-ink-mute">{t('privacyOpenMentorIoLegal')}</p>
          <h1 className="my-0 mt-3 text-3xl sm:text-[40px]">{t('privacyPrivacyPolicy')}</h1>
          <p className="mb-0 mt-3 text-[15px] text-ink-soft">{t('privacyForTheOpenMentorIoService')}</p>
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
                <Link href="/privacy" locale="en">{t('originalEnglish')}</Link>
              </p>
            )}
            <p>
              <strong>{t('privacyLastUpdated')}</strong>{t('privacy6August2026')}</p>

            <p>
              <strong>{t('privacyDataController')}</strong>
              <br />{t('privacyGeorgiyMogelashviliAnIndividualSoleOperatorOf')}</p>

            <p>
              <strong>{t('privacyWebsite')}</strong> <a href="https://openmentor.io">{t('privacyHttpsOpenmentorIo')}</a>
              <br />
              <strong>{t('privacyPrivacyContact')}</strong>{' '}
              <a href="mailto:privacy@openmentor.io">{t('privacyPrivacyOpenmentorIo')}</a>
              <br />
              <strong>{t('privacyGeneralContact')}</strong>{' '}
              <a href="mailto:hello@openmentor.io">{t('privacyHelloOpenmentorIo')}</a>
            </p>

            <p>{t('privacyThisPolicyExplainsWhatPersonalDataOpenMentor')}</p>

            <hr />

            <h2>{t('privacy1WhatOpenMentorDoes')}</h2>

            <p>{t('privacyOpenMentorIsAnOnlinePlatformThatConnects')}</p>

            <hr />

            <h2>{t('privacy2WhatDataWeCollect')}</h2>

            <h3>{t('privacy21MentorProfiles')}</h3>

            <p>{t('privacyWhenYouRegisterAsAMentorAnd')}</p>

            <ul>
              <li>{t('privacyNameOrDisplayName')}</li>
              <li>{t('privacyEmailAddress')}</li>
              <li>{t('privacyPhotoAvatar')}</li>
              <li>{t('privacyJobTitleWorkplaceExperienceSpecializationAndProfile')}</li>
              <li>{t('privacySessionPriceInformation')}</li>
              <li>{t('privacyLinksToExternalResourcesAndAnOptional')}</li>
              <li>{t('privacyCalendarBookingLinkIfProvided')}</li>
              <li>{t('privacyAnyOtherInformationYouVoluntarilyAddTo')}</li>
            </ul>

            <p>{t('privacyExceptForYourEmailAddressThisInformation')}{' '}
              <strong>{t('privacyPublishedOnTheSite')}</strong>{t('privacyAndBecomesPubliclyAvailableAtYourOwn')}</p>

            <h3>{t('privacy22MenteeContactRequests')}</h3>

            <p>{t('privacyWhenYouSendARequestToA')}</p>

            <ul>
              <li>{t('privacyName')}</li>
              <li>{t('privacyEmailAddress')}</li>
              <li>{t('privacyAnOptionalFreeTextPreferredContactAny')}</li>
              <li>{t('privacyTheTextOfYourMessageToThe')}</li>
              <li>{t('privacyYourSelfAssessedExperienceLevelIfProvided')}</li>
            </ul>

            <h3>{t('privacy23SessionReviews')}</h3>

            <p>{t('privacyIfYouLeaveAReviewAfterA')}</p>

            <h3>{t('privacy24AuthenticationData')}</h3>

            <p>{t('privacyWeUsePasswordlessMagicLinkAuthenticationFor')}</p>

            <h3>{t('privacy25AnalyticsDataOnlyWithYour')}</h3>

            <p>{t('privacyWithYourConsentSeeSection8We')}</p>

            <h3>{t('privacy26AntiAbuseAndTechnicalData')}</h3>

            <p>{t('privacyToProtectTheServiceAgainstSpamBots')}</p>

            <hr />

            <h2>{t('privacy3PurposesAndLawfulBases')}</h2>

            <ul>
              <li>
                <strong>{t('privacyOperatingTheMentorCatalogAndDeliveringRequests')}</strong>{t('privacyPublishingMentorProfilesPassingAMenteeS')}</li>
              <li>
                <strong>{t('privacyAuthenticationAndAccountAccess')}</strong>{t('privacyMagicLinksSessionsPerformanceOfAContract')}</li>
              <li>
                <strong>{t('privacySessionReviewsAndQualityFeedback')}</strong>{t('privacyOurLegitimateInterestInMaintainingTheQuality')}</li>
              <li>
                <strong>{t('privacyProductAnalytics')}</strong>{t('privacyYourConsentArt61AGDPR')}</li>
              <li>
                <strong>{t('privacySecurityAntiAbuseLoggingAndObservability')}</strong>{t('privacyOurLegitimateInterestInKeepingTheService')}</li>
            </ul>

            <p>{t('privacyWeDoNotSendMarketingOrAdvertising')}</p>

            <hr />

            <h2>{t('privacy4WhoWeShareDataWith')}</h2>

            <p>{t('privacy41WhenYouSendARequest')}{' '}
              <strong>{t('privacySharedWithTheMentorYouSelected')}</strong>{t('privacySolelySoThatTheMentorCanRespond')}</p>

            <p>{t('privacy42WeUseTheFollowingService')}</p>

            <ul>
              <li>{t('privacyHetznerHostingAndInfrastructureGermanyEU')}</li>
              <li>{t('privacyAmazonWebServicesSESTransactionalEmailDelivery')}</li>
              <li>{t('privacyAmazonWebServicesS3StorageOfProfile')}</li>
              <li>{t('privacyPostHogProductAnalyticsEUCloudOnlyWith')}</li>
              <li>{t('privacyGoogleTagManagerLoadingOfAnalyticsTags')}</li>
              <li>{t('privacyCloudflareTurnstileSpamAndBotProtectionOn')}</li>
              <li>{t('privacyGrafanaCloudLoggingMonitoringAndErrorTracking')}</li>
              <li>{t('privacyCloudflareDNSAndContentDelivery')}</li>
            </ul>

            <p>{t('privacy43IfAMentorEmbedsA')}</p>

            <p>{t('privacy44WeDoNotSellPersonal')}</p>

            <hr />

            <h2>{t('privacy5InternationalTransfers')}</h2>

            <p>{t('privacyOurPrimaryHostingIsLocatedInThe')}</p>

            <hr />

            <h2>{t('privacy6HowLongWeKeepData')}</h2>

            <p>{t('privacyWeRetainPersonalDataForAsLong')}</p>

            <ul>
              <li>
                <strong>{t('privacyMentorProfiles')}</strong>{t('privacyKeptWhileTheProfileIsOnThe')}</li>
              <li>
                <strong>{t('privacyDeletedMentorProfiles')}</strong>{t('privacyRetainedForAShortRecoveryWindowCurrently')}<strong>{t('privacy30Days')}</strong>{t('privacySoThatADeletionMadeInError')}<strong>{t('privacyPermanentlyErased')}</strong>{t('privacyByAnAutomatedProcessErasureRemovesThe')}</li>
              <li>
                <strong>{t('privacyMenteeContactRequestsAndReviews')}</strong>{t('privacyKeptWhileTheyRemainRelevantToThe')}</li>
              <li>
                <strong>{t('privacyLoginTokens')}</strong>{t('privacyExpireWithinMinutesOfIssuanceSessionsExpire')}</li>
              <li>
                <strong>{t('privacyServerLogsAndObservabilityData')}</strong>{t('privacyApproximately30Days')}</li>
              <li>
                <strong>{t('privacyAnalyticsData')}</strong>{t('privacyPerTheRetentionSettingsOfTheAnalytics')}</li>
            </ul>

            <p>
              <strong>{t('privacyBackups')}</strong>{t('privacyDeletedDataMayPersistInEncryptedBackups')}</p>

            <hr />

            <h2>{t('privacy7YourRights')}</h2>

            <p>{t('privacyUnderTheGDPRYouHaveTheRight')}</p>

            <ul>
              <li>{t('privacyAccessThePersonalDataWeHoldAbout')}</li>
              <li>{t('privacyHaveInaccurateDataCorrected')}</li>
              <li>{t('privacyHaveYourDataErasedRightToBe')}</li>
              <li>{t('privacyRestrictOrObjectToProcessingBasedOn')}</li>
              <li>{t('privacyReceiveYourDataInAPortableFormat')}</li>
              <li>{t('privacyWithdrawConsentAtAnyTimeForConsent')}</li>
              <li>{t('privacyLodgeAComplaintWithADataProtection')}{' '}
                <a href="https://www.autoriteitpersoonsgegevens.nl/en">{t('privacyAutoriteitPersoonsgegevens')}</a>{t('privacyYouMayAlsoComplainToTheSupervisory')}</li>
            </ul>

            <p>
              <strong>{t('privacyErasingYourMentorProfileYourself')}</strong>{t('privacyYouDoNotNeedToEmailUs')}{' '}
              <strong>{t('privacyDeleteProfile')}</strong>{t('privacyOnYourProfilePageTheProfileLeaves')}</p>

            <p>{t('privacyToExerciseAnyOfTheseRightsEmail')}{' '}
              <strong>
                <a href="mailto:privacy@openmentor.io">{t('privacyPrivacyOpenmentorIo')}</a>
              </strong>{t('privacyWeMayAskYouToVerifyYour')}</p>

            <hr />

            <h2>{t('privacy8CookiesAndAnalytics')}</h2>

            <p>{t('privacyWeUseTwoKindsOfCookiesAnd')}</p>

            <ul>
              <li>
                <strong>{t('privacyEssentialCookies')}</strong>{t('privacyRequiredForTheServiceToWorkSession')}</li>
              <li>
                <strong>{t('privacyAnalyticsCookies')}</strong>{t('privacySetByPostHogProductAnalyticsAndBy')}{' '}
                <strong>{t('privacyOnlyIfYouAcceptThemInThe')}</strong>{t('privacyShownOnYourFirstVisitYouCan')}</li>
            </ul>

            <hr />

            <h2>{t('privacy9SpecialCategoriesOfData')}</h2>

            <p>{t('privacyTheServiceDoesNotRequestAndDoes')}</p>

            <hr />

            <h2>{t('privacy10HowWeProtectData')}</h2>

            <p>{t('privacyWeApplyAppropriateTechnicalAndOrganizationalMeasures')}</p>

            <ul>
              <li>{t('privacyTLSEncryptionForAllConnections')}</li>
              <li>{t('privacyPasswordlessMagicLinkAuthenticationNoStoredPasswords')}</li>
              <li>{t('privacyHttpOnlySecureSessionCookies')}</li>
              <li>{t('privacyRateLimitingAndCloudflareTurnstileOnPublic')}</li>
              <li>{t('privacyRestrictedAccessToAdministrativeInterfacesAndAPIs')}</li>
              <li>{t('privacySecurityMonitoringAndEventLogging')}</li>
              <li>{t('privacyRegularUpdatesOfSoftwareComponentsAndDependencies')}</li>
            </ul>

            <hr />

            <h2>{t('privacy11ChangesToThisPolicy')}</h2>

            <p>{t('privacyWeMayUpdateThisPolicyFromTime')}{' '}
              <Link href="/privacy">{t('privacyOpenmentorIoPrivacy')}</Link>{t('privacyForSignificantChangesWeWillProvideNotice')}</p>
          </div>
        </Section>
      </main>

      <Footer />
    </>
  )
}
