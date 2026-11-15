# CAPTCHA provider operation

## Configuration

The default (unset or `turnstile`) retains the existing Cloudflare contract. To switch,
set `CAPTCHA_PROVIDER=smartcaptcha` on the API and bundle
`NEXT_PUBLIC_CAPTCHA_PROVIDER=smartcaptcha` plus `NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY`
into the frontend. Only the API receives `SMARTCAPTCHA_SERVER_KEY` and the required bare
`SMARTCAPTCHA_EXPECTED_HOSTNAME`. Do not send the server key to frontend runtime, build
arguments, archives or logs. Unknown backend providers reject startup.

SmartCaptcha verification is a form-encoded POST to its official `/validate` endpoint,
bounded to five seconds and 16 KiB of response data. Accept only HTTP 200, `status=ok`
and the configured nonempty hostname. Reject provider outages, malformed replies and
empty hostnames; do not use the provider documentation's fail-open outage recommendation.
The shared verifier protects registration, contact, review and migration-intent writes.
The widget clears tokens on expiry/network/JS failure and resets through the existing
form retry refs. Yandex tokens expire after five minutes and are single-use.

Official references checked for the protocol, events and script/frame origin:
- https://yandex.cloud/en/docs/smartcaptcha/operations/validate-captcha
- https://yandex.cloud/en/docs/smartcaptcha/concepts/widget-methods
- https://yandex.cloud/ru/docs/smartcaptcha/concepts/domain-validation

Only `https://smartcaptcha.cloud.yandex.ru` was added to `script-src` and `frame-src`.
Actual checkbox/backend frames use that origin; internal frame resources have their own
policy. Preserve existing analytics CSP permissions. A full-page screenshot taken before
scrolling may show blank space because the provider lazily paints the checkbox: scroll
it into view, inspect the checkbox frame, and take a viewport capture. Never solve a
challenge automatically. A real human successful submission remains an acceptance gate.

## Client deployment and rollback constraints

The current client images were built from base `5a0004a` plus a CAPTCHA-only
source overlay. For the next release, build all application binaries and frontend
from the same final clean commit, including the mail identity changes; rehearse
on an isolated stack before changing the live host. Preserve frontend analytics
build constants as well as runtime `UMAMI_*` settings and Caddy's `/_analytics`
proxy. Compare platform-specific image IDs, not Docker Desktop's multi-platform
index ID. No database migration is required for these provider/identity changes.

Back up compose and separate service envs privately before recreating only the intended
services. Keep old images. Verify health, HTTPS widget rendering, non-creating missing
and invalid-token requests, frontend secret absence and analytics script delivery.
Do not run mutation tests against the client database.

After disabling demo auth and introducing a real administrator mailbox, old env backups
are NOT directly safe rollback targets: they may re-enable public demo login and revive
old signing keys. Preserve `DEMO_AUTH_ENABLED=false`, secure cookies, current JWT secret,
client BASE_URL, mail trigger/token settings and analytics when rolling back CAPTCHA.
Reverting to old dummy CAPTCHA keys also requires blocking public form writes first.
Do not restore a database dump merely to roll back an image.

## Magic-link mail activation

Use the existing link-based flows, not a new OTP flow. Disable demo/dev entry first and
rotate the backend JWT signing secret to invalidate previously issued demo sessions.
Only then change the explicitly authorized synthetic administrator's email, checking
for collisions and preserving its role; increment its session_version and clear old
login tokens. Keep a private pre-change database backup and recovery access via SSH.

Merge settings into current API/worker env files rather than replacing them with a stale
prepared candidate. Set both BASE_URL values to the client HTTPS origin, COOKIE_SECURE
on, the same private WORKER_AUTH_TOKEN, and explicit worker network trigger URLs. Leave
MENTOR_UPDATED_TRIGGER_URL empty: there is no worker endpoint for that legacy job.
Leave WORKER_CRON_ENABLED=false: enabling event notifications is not approval to process
historical reminders/backlog. Keep moderator notifications at the approved mailbox.
A temporary DEV_EMAIL_OVERRIDE must be removed and read back before claiming normal
recipient routing. Check SES acceptance separately from inbox receipt and human login.
Do not retrieve or publish users' emailed login tokens.
