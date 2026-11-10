# Local editing environment

Run from the repository root:

```sh
./infra/local/start.sh
```

Open **http://localhost:3100/dev** and choose mentor or administrator. No password, email delivery, or manual token entry is required. Both sessions can coexist. The interface is the existing upstream interface, mostly in English.

## Isolation

- Compose project: `openmentor-local-edit`, with its own database volume and generated local secrets in ignored `infra/local/.env` (0600).
- Web: `127.0.0.1:3100`, Go API: `127.0.0.1:18081`, Postgres: `127.0.0.1:5544`.
- Development-only S3-compatible `storage` service (s3rver) stores actual uploaded bytes in the separate `openmentor-local-edit_objects` volume. It has no host port, public development credentials only, and is not a production service. Research images are served through the Go API/Next BFF rather than exposing its internal hostname.
- Does not use `infra/.env`, remote databases, upstream deployment scripts, or production credentials. Existing Docker stacks are not replaced.
- Synthetic accounts: `demo-mentor@openmentor.test`, `demo-admin@openmentor.test`.
- Synthetic seed includes an active mentor, a pending mentor and an incoming request. Real writes are enabled **only to this local database**.
- The `/api/dev/login` convenience endpoint requires development mode and a loopback host. The underlying demo login is explicitly enabled on the isolated Go API and forbidden by its configuration validator in production.
- Do not publish these services or their ports to the network. Cookie names are upstream names: other applications on `localhost` may share them across ports. Use an isolated browser profile if working with another local OpenMentor instance.

## Editing and lifecycle

Changes in `web/src` hot-reload immediately. Edit backend code in `api/`, then run:

```sh
./infra/local/start.sh backend
```

This rebuilds Go binaries and restarts the local API, without replacing the database. Migrations run before API startup. Seeding never overwrites existing mentor/request rows; if a fixture has no specialization, seeding assigns Backend.

Stop the web process with Ctrl+C. Stop the local database and API without deleting data:

```sh
./infra/local/start.sh stop
./infra/local/start.sh status
```

Restart Docker Desktop first if Docker is unavailable. Requirements: Docker Desktop, Go matching `api/go.mod`, Node 26 and npm, Python 3. The launcher reuses an existing backend runtime image; if missing it builds that image from `api/Dockerfile`. The current source is cross-compiled for that runtime's architecture on every launch, so an old image cannot silently serve old application code. Do not run parallel launch/rebuild commands against the same local environment.

## Deliberately not connected

The worker is not started, so email and scheduled background work are disabled. Local S3 storage is now configured for research cover uploads; production storage and external-provider compatibility are not verified by that local setup. The existing mentor upload storage client uses this local store as well, but its direct image URL is internal and mentor browser rendering is not claimed as verified. Dashboard edits, research images and moderation data are local and persistent; this is not an end-to-end test of mail, CAPTCHA or production deployment. Never use development storage credentials outside this isolated environment.

Repository checks:

```sh
(cd web && make pre-commit)
(cd api && make test)
```

Database-backed API tests require a **separate disposable test database**, not this editing database (`OPENMENTOR_TEST_DATABASE_URL`). Without it those tests skip.
