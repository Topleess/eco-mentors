# Isolated local Umami

Local development only; not a production deployment or real-user analytics claim.
The dashboard is at http://127.0.0.1:18185. Only this loopback port is published.
The database has no host port. No existing OpenMentor stack or database is reused.

## Lifecycle

From the repository root:

```sh
docker compose --project-directory infra/local/umami -f infra/local/umami/compose.yml config -q
docker compose --project-directory infra/local/umami -f infra/local/umami/compose.yml up -d --wait --wait-timeout 180
python3 infra/local/umami/verify.py
# Stop only this project, retaining database data:
docker compose --project-directory infra/local/umami -f infra/local/umami/compose.yml down
```

Project: `openmentor-local-umami`. Persistent data volume:
`openmentor-local-umami_database`; network: `openmentor-local-umami_analytics`.
Do not add `--volumes` to down unless deliberate deletion is wanted.
No restart policy is enabled: Docker Desktop must not resurrect this stack automatically.
No upstream deployment scripts are involved.

App bounds: 640 MiB, 0.75 CPU, 100 PIDs, 384 MiB V8 heap.
Database bounds: 256 MiB, 0.50 CPU, 100 PIDs, 30 connections, 32 MiB shared buffers.
Both services use no-new-privileges and logs bounded at two 5 MiB files.
The official app runs as `nextjs`, not root. PostgreSQL uses its official bootstrap entrypoint.

## Private configuration and reporting identity

`.env`, `credentials.json`, and `integration.json` are ignored and mode 0600.
Never print, commit, or send their contents. Retain all three alongside the volume.
`credentials.json` contains generated admin and reporting login credentials.
`bootstrap.py` rotates the initial admin password before creating the website or reporting token.
It refuses to modify an already configured integration. It can resume partial bootstrap.

The website is **ЭкоКарьера — локальная разработка**, domain `localhost`.
Both `localhost:3100` and `127.0.0.1:3100` browser hosts may send safe manual events to it;
the configured domain is not an ingestion security boundary.
The website belongs to a dedicated team. The reporting account has global `view-only`
and team `team-view-only` roles; its valid website update request is denied by the server.
This avoids assigning the reporting user direct website ownership (ownership can permit writes).
`integration.json` contains only `serverUrl`, `websiteId`, `token`, `publicUrl`.
The token is a self-hosted login bearer token, not an assumed cloud/project API key.
Changing that user's password invalidates the token. Re-login and privately replace the token
if credentials are rotated. Do not give the frontend the reporting token.

Parent integration mapping (not edited by these scripts):

- `serverUrl` → `UMAMI_API_URL`
- `token` → `UMAMI_API_TOKEN`
- `websiteId` → `UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `publicUrl` → `NEXT_PUBLIC_UMAMI_URL`

Use manual safe URL tracking without private referrers, query strings, user identifiers,
request IDs, names, contact details, or private-page paths. No session replay is configured.

## API contract (v3.4.1, real-server verified)

All reporting requests use `Authorization: Bearer <private token>`.
Routes are plural `/api/websites/{websiteId}/...`.
Range query: `startAt` and `endAt` are Unix milliseconds; use `unit=hour&timezone=UTC`
for the timeseries. v3 uses flat numeric statistics, **not** v2 `{value,prev}` objects.

```ts
// GET .../stats
{
  pageviews: number, visitors: number, visits: number,
  bounces: number, totaltime: number,
  comparison: {
    pageviews: number, visitors: number, visits: number,
    bounces: number, totaltime: number
  }
}
// GET .../pageviews (without compare query)
{ pageviews: Array<{x: string, y: number}>, sessions: Array<{x: string, y: number}> }
// GET .../metrics?type=path (not type=url)
Array<{x: string, y: number}>
// GET .../metrics?type=event
Array<{x: string, y: number}>
```

Ingestion: `POST /api/send`, JSON `{type:'event', payload:{website,hostname,url,title,...}}`.
No `name` means a pageview; `name` means a custom event.
Successful real ingestion returns `{cache:string, sessionId:string, visitId:string}`;
these capability/identifier values must not be logged.

`python3 infra/local/umami/verify.py --ingest` explicitly adds one pageview and one event
labeled synthetic on `/analytics-integration-check`, with tag `synthetic-local-check`
and event `synthetic-local-integration-check`. It sends no referrer or distinct ID.
The default verification only reads and checks these persisted rows; run `--ingest` once
on a new empty database. Repeated ingestion intentionally increases synthetic counts.
It is a 24-hour check, so repeat `--ingest` when the original check ages out.
Initial successful readback: pageviews=1, visitors=1, visits=1, synthetic event count=1.
The same rows and reporting token survived restarting both owned services.

## Pinned official artifacts

Official source used: `https://github.com/umami-software/umami/tree/v3.4.1`.
Consult this tag rather than future-version online API docs. Inspected files include
`docker-compose.yml`, `Dockerfile`, `src/lib/constants.ts`, `src/lib/schema.ts`,
`src/permissions/website.ts` and the auth/users/teams/websites/send route handlers.

Image: `ghcr.io/umami-software/umami:3.4.1` pinned by OCI index digest
`sha256:e69d1a7932e9dab0fc523edc7be1f3a53f3c261f57856fc2167ae74a8fc022e8`.
Registry manifest inspection confirms native `linux/arm64` and `linux/amd64` images.
Selected arm64 manifest:
`sha256:8a9a41c01febe8a47c1f3d90fdc8d2e0bd467ef545171e60d7d30218ced430c8`.
No emulation or local build was needed.
PostgreSQL: existing cached official `postgres:16.14-alpine`, native arm64;
observed repository digest `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`.

For a fresh checkout, create `.env` privately with independently random hexadecimal values
for `POSTGRES_PASSWORD`, `APP_SECRET`, and a 64-character hex `TWO_FACTOR_ENCRYPTION_KEY`;
set mode 0600 **before writing**. Bring up this project, run `bootstrap.py`, then `verify.py --ingest`.
These helpers never source another stack's env file. Preserve the app secret across restarts.
