# Client deployment: Eco Mentors

## Scope and evidence

Prepared 2026-11-15 from read-only Docker inspection of the client host and this
checkout. No live files were changed. This is a **new-host rehearsal template**,
not automation for replacing the active multi-project deployment. Full clean
build, empty-cluster bring-up, storage bootstrap and disaster restore using this
package have **not been rehearsed**. Compose rendering is not runtime acceptance.
This repository includes the reconciled mail identity and CAPTCHA source/contracts;
verify the final release commit against fresh live state before any deployment.
Publishing these files does not deploy them. Do not run upstream `infra/deploy.sh`
against this client.

## Live inventory (snapshot; not desired-state enforcement)

| Component | Observed deployment | Persistence / exposure |
|---|---|---|
| Next.js + API | `/opt/eco-mentors-test/compose.yaml`, project `eco-mentors-test`; frontend/backend tags `5a0004a-smartcaptcha` | frontend `127.0.0.1:13000`; API unpublished |
| Mail worker | `/opt/eco-mentors-test/postbox-prepared/compose.yaml`, project `eco-mentors-mail`; base `eco-mentors/backend:5a0004a` | read-only host `worker-postbox` mounted to `/app/worker-postbox`; no published ports |
| Main PostgreSQL | `/opt/eco-mentors/database/compose.yml`, project `eco-mentors-db`; `postgres:16.14-alpine` | volume `eco-mentors-db_postgres-data`; password-file mount; no published port |
| Garage | `/opt/eco-mentors/storage/compose.yaml`, project `eco-mentors-storage`; `dxflrs/garage:v1.0.1` | volume `eco-mentors-storage-data`; private `s3.storage` and bucket-prefixed DNS aliases; private TOML mount |
| Umami | `/opt/eco-mentors-analytics/compose.yaml`, project `eco-mentors-analytics`; pinned Umami 3.4.1 digest in example | app `127.0.0.1:18185`; DB `postgres:16.14-alpine`, volume `eco-mentors-analytics_database`, unpublished |
| Ingress | host `/etc/caddy/Caddyfile` | proxy frontend; same-origin `/_analytics` only script GET, ingest POST and authenticated website-report GET; other Umami routes denied |

At inspection API/frontend/worker/Umami/both PostgreSQL containers were running
and healthy. Garage was running with no Docker healthcheck. API was staging,
SmartCaptcha selected, demo authentication disabled. These facts do not establish
production readiness. The runtime owner subsequently verified seven enabled API
triggers, HTTPS BASE_URL, worker cron disabled, removal of the development
recipient override and normal routing; the user confirmed magic-link login.
JWT was rotated and demo authentication remains disabled. Moderator routing is
operator-provisioned, with no live mailbox recorded here. App tags were built
from 5a0004a plus a CAPTCHA-only overlay, not the entire dirty checkout.
Worker filename `postbox-prepared`
is historical naming, not proof mail is inactive. Runtime configuration and
recipient overrides must be checked by its owner without exposing values.

The active service is not simply the checkout: mutable app tags, separate Compose
projects, private runtime files, and a mounted patched worker all matter. A base
image alone cannot recreate that worker. Build `/app/worker` from the final source
instead; retire the host binary only after tests prove parity. Do not invent a
source SHA from an image tag. Record exact source commit, dirty-state disposition,
platform image IDs/digests and public build parameters in each release manifest.

## Repository, local editing and release sources

Keep one Eco Mentors repository with upstream Git history, root AGPL LICENSE,
copyright/third-party notices and existing UI source links intact. This package
changes no license or UI links. Publish the exact deployed modified source and
build/install material; never publish credentials, dumps, real user data or
capability-bearing identifiers. A GitHub push is not a server deployment.

Use `infra/local/README.md` and `infra/local/start.sh` for editable local work with
synthetic data. Do not point it at client databases. Production frontend public
settings are compiled into the image: changing runtime env alone is insufficient.
This template builds `api/Dockerfile` (all three binaries plus migrations) and
`web/Dockerfile` from this repository, not upstream registry application images.
Base image tags for Go/Node/Debian/Postgres/Garage are still mutable; record/pin
resolved digests for a release. This is repeatable source configuration, **not a
claim of byte-for-byte reproducible images**.

## Private provisioning

Work only on an explicitly chosen empty rehearsal host or separate isolated
project. Commands below assume repository root, then:

```sh
cd infra/client/eco-mentors
umask 077
cp env.example .env
for service in backend frontend worker migrate umami; do
  cp "$service.env.example" "$service.env"
done
mkdir -m 700 secrets
```

Have the operator populate these private files through the approved password
manager/secret channel. Examples are deliberately unusable placeholders; do not
start them unchanged. Create `secrets/postgres-password`,
`secrets/umami-password`, `secrets/garage.toml` with mode 0600. The latter starts
from `garage.toml.example`, with a newly generated RPC secret. Generate independent
DB, JWT, API and worker secrets; match API/worker shared token and frontend/API
internal token deliberately. URL-encode DSN passwords. Bootstrap and scoped-role
passwords belong in the client password manager, not GitHub build arguments.

Provision a client-owned Postbox service account/key and verified sender/domain;
set SES endpoint/region from the provider's actual account settings. Provision
SmartCaptcha hostname/client/server keys. These are external dependencies, not
containers created here. Public keys/website IDs are build settings; private
keys stay in per-service env files. Keep worker cron false and API triggers empty
until mail acceptance. Clear DEV_EMAIL_OVERRIDE before real-user delivery; a
staging override changes all recipients. Do not blindly apply any pending live
env file: merge against freshly read active config.

## Rehearsal sequence (operator procedure, not tested automation)

Choose a unique COMPOSE_PROJECT_NAME and unused loopback ports in `.env`; adjust
Caddy example to match. Set RELEASE to the final clean Git commit, after the
parallel source owner finishes. Do not build dirty moving source as a release.
From this directory, with private files provisioned:

```sh
docker compose --env-file .env config -q
docker compose --env-file .env build migrate frontend
docker compose --env-file .env up -d postgres storage analytics-db
```

1. Empty PostgreSQL cluster: first migration DSN in `migrate.env` must be the
   bootstrap superuser. Run `docker compose run --rm migrate`. Migration 000012
   creates cluster-wide roles/ownership and cannot initially run as om_migrate.
   Inspect all newer migrations too. Never run this bootstrap against a shared
   PostgreSQL cluster. Follow `database-identities.md` to give om_api/om_worker/
   om_migrate LOGIN and independent passwords via interactive psql `\password`.
   Set backend/worker/migrate DSNs to their scoped identities. Re-run migration
   and verify clean schema_migrations and no superuser/CREATEROLE on runtime
   identities. Do not import local fictional seeds into client production.
2. Garage: `docker compose exec storage /garage status`, obtain the new node ID
   privately, assign the single-node layout using `layout assign -z dc1 -c 1G
   NODE_ID`, then `layout apply --version 1`. Create `eco-mentors-media` bucket,
   create an application key privately and grant only required bucket read/write.
   Consult the pinned binary's `--help` before execution; these bootstrap steps
   have not been rehearsed here. Key-creation output is secret: never paste it
   into tickets/logs. Configure API S3 keys and test virtual-host bucket DNS.
   Layout/key metadata and object data both live under the objects volume.
3. `docker compose up -d umami`: tunnel its loopback port for bootstrap. Change
   initial administrator credentials before exposure, create the website and a
   least-privilege reporting identity, provision server token to frontend.env,
   website ID to both frontend.env and `.env`. Rebuild frontend after this.
   Default Umami credentials are never an acceptable final state.
4. `docker compose up -d backend frontend`. Confirm local frontend/API health,
   public catalogue and private role checks. The frontend image and API should
   have no demo bypass. Frontend browser images must work through the actual
   configured loader: internal S3 DNS alone is not a browser delivery solution.
5. Merge the Caddy example into host configuration, preserving all existing
   domains. Make a unique private backup, run `caddy validate --config
   /etc/caddy/Caddyfile`, then reload only after validation. Set ECO_DOMAIN in
   the Caddy service environment or replace it with the approved domain.
   DNS/TLS and external reachability require operator verification. Example
   assumes host Caddy, not loopback from inside another container.
6. `docker compose --profile mail up -d worker` only after private mail setup.
   Check worker-specific `/healthz`, unauthenticated job rejection, controlled
   delivery and recipient routing. Then copy approved event trigger paths from
   `api/.env.example` into backend.env, using service `worker:8090`, preserving
   trailing `?param=` on URL-appended ID triggers and no query on JSON triggers.
   Recreate backend. Cron activation is a separate explicit approval.
7. Before production, set APP_ENV consistently in private files and public build
   settings; rebuild frontend. Revalidate startup guards, real CAPTCHA server
   verification, registration/login/moderation, uploads/read/delete, consent-based
   analytics ingestion/readback, mobile UI and access controls on public HTTPS.
   This checklist is not evidence these tests have passed.

No DB/S3/worker ports are published. Separate analytics DB network is internal;
Umami can reach the application network for reporting. Aggregate memory limits
exceed some small VPS capacities: size host against measured peaks, not swap.

## Deployment and rollback

After successful disposable rehearsal, approve a maintenance window and migration
plan for the existing multi-project live host; do not run this single-project
Compose as an in-place replacement. Preserve existing named volumes/network
attachments. Record old config, mounted binary, image IDs and migration version
privately before changing anything. Retain image archives/digests and previous
secret references; Git alone cannot recover private state.

For compatible additive migrations, restore the preceding immutable app images
and matching public build config, recreate app services, then recheck health and
critical flows. For contract migrations or incompatible data changes, stop and
use the rehearsed DB+objects restore procedure with approved downtime/data-loss
bounds. Never automatically run lossy down migrations, force migration versions,
`down -v`, or prune volumes. Reverting a mutable tag may not restore its old image;
reverting the base worker image does not revert a mounted patched worker.

## Backups: actual limitations and required recovery work

Observed one local Umami gzip SQL backup under
`/opt/eco-mentors-analytics/backups`. No client backup systemd timer or cron.d job
was visible; no main-app backup directory was found at the inspected conventional
path. This is limited inspection, not proof no backup exists elsewhere. Live DB
volumes, config snapshots and on-host rollback directories are **not off-host
backups**. No restore, off-host replication, retention policy, backup-age alert,
or complete database+object backup was verified.

Before real-user acceptance, agree RPO/RTO and implement encrypted off-host copies
of main PostgreSQL logical backups, Umami PostgreSQL, Garage objects **and metadata**,
and separately secured private configuration/key recovery. Coordinate writes for
a consistent DB/object recovery point. Never raw-copy running PostgreSQL data or
assume copying live Garage files is consistent. Follow provider/version-supported
snapshot methods. Keep credentials and user data out of this repository.

Rehearse restoration into a separate isolated stack: provision bootstrap roles,
restore main DB with correct ownership/grants (see `database-identities.md` and
`postgres-backup-restore.md` for upstream concepts, not client-ready scripts),
restore Garage metadata/data and keys, restore Umami, verify migration state,
permissions, uploads and sample records, and measure recovery time. Keep mail
and cron disabled and use non-public ingress during recovery. Only then approve
cutover. An upstream backup sidecar's presence in `infra/` does not mean it runs
on this client.

## Verification boundary

Quiet example rendering and redacted secret scanning validate only template
syntax/content. No full source build, new-stack runtime test, migration bootstrap,
Garage bootstrap, Caddy reload or restore is performed by this preparation.
The parent release owner must reconcile final source/mail runtime, commit/publish
approved files, record the tested SHA/digests and update this inventory after
cutover. Secrets and client personal data stay outside source publication.
