# Postbox mail readiness

Repository preparation does not enable delivery. Do not start a worker against a live database
as a configuration test: cron and queued HTTP jobs can email real recipients. Cron disabled
alone does not disable HTTP-triggered delivery.

## Operator prerequisites (outside this repository change)

- Obtain client approval of a sender mailbox, display name and moderation mailbox. Verify the
  sender/domain with the chosen SESv2-compatible provider and complete its required DNS setup.
- Obtain the provider endpoint, region and scoped credentials through the operator's secret
  channel. Do not put credentials into tracked files, shell history or support messages.
- Set `SES_ENDPOINT`, `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`,
  `SES_FROM_EMAIL`, `SES_FROM_NAME` and `MODERATORS_EMAIL` in the operator-managed environment.
  Use bare mailboxes, not `Name <mailbox>`. Cyrillic display names are supported.
  Production and any custom endpoint reject missing identities and upstream `openmentor.io`
  sender/moderator mailboxes. Legacy defaults are only for non-production without an endpoint.
- Set the approved HTTPS `BASE_URL` on **both API and worker**, without a trailing slash:
  API constructs mentor/admin callback links; worker supplies template footer/logo URLs and
  other transactional links. The old default remains upstream for compatibility; do not rely
  on it for Eco Mentors. Check matching frontend domain, cookies and proxy settings.
- Leave `DEV_EMAIL_OVERRIDE` empty in production (startup rejects otherwise). In an isolated
  non-production delivery test it can reroute every recipient to an approved test inbox.

## Safe repository checks

`cd api && make ci` runs lint and race tests; DB-backed cases skip without a dedicated test DSN.
Do not provide a live DSN. Tests construct provider inputs or use fakes; they do not send mail.
`cd infra && make ENV_FILE=.env.example compose-config` only renders configuration.
`make env-allowlist` uses a local `.env` if present; when private files must not be read,
run it from an isolated copy of tracked infra files with only templates.
Render checks do not prove sender verification, provider permissions or deliverability.

## Controlled delivery gate (separate operator authorization required)

Use an isolated database and synthetic accounts, no imported user queue, approved test recipients
and a restricted non-production provider identity. Inspect rendered HTML/text: sender display
name/mailbox, mentor/admin callback origin, footer and logo origin. Only after explicit approval
perform a controlled send; verify delivery, spam placement and one-time login behavior.
Reconcile provider request IDs with existing redacted SES success/failure logs and worker job
metrics. No new metric labels are needed for identity configuration; never log credentials,
addresses or login tokens. Startup validation reports variable names, not configured values.

Deploy worker image **and** compose/allowlist updates together via the operator-owned process;
normal frontend/backend-only deploy does not sync infra. Existing production environments must
supply the new fields and non-upstream moderation mailbox before upgrading. No migrations are
needed. Roll back code and matching infrastructure together if the rollout is aborted.
