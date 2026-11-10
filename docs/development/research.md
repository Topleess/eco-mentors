# Research catalogue and editing

## Scope

Public `/research` links to request-time detail pages `/research/[slug]`. The editorial composition follows the supplied i.moscow reference's cover, metadata, file actions, contents and findings hierarchy, using the existing site's design system and original assets. No source-site prose, artwork, branding, statistics or contact form is imported.

Administrator `/admin/research` is a real create/edit/publish workflow, not a mock table. `/admin/research/new` creates a record; list titles open `/admin/research/[id]`; published records have a separate public link. PostgreSQL via the Go API is authoritative; Next API routes are authenticated proxies. There is no localStorage or fixture fallback.

## Content contract

Fields: title, summary, category, author, publication date, reading minutes, cover URL/alt, PDF URL, ordered sections with stable anchor IDs and plain-text paragraphs, key findings, citation note, status. Statuses: draft, published, archived. All stored text renders as text rather than executable HTML. New entries get manual provenance. Sample records retain synthetic provenance and must not be passed off as research evidence.

Technical slugs are generated internally as `research-<uuid>` at the first valid creation attempt, reused across retries and immutable on later edits. Versioned updates reject stale writes (409). Saving is followed by exact-record GET readback before the UI claims success. Public list and detail expose only published records; draft, archived and missing details return 404.

Research cover uploads reuse the mentor `s3storage` client, shared raw-file/body-size limits and image validation; the research handler is separately administrator-only and uses its own immutable object namespace, never mentor profile keys. Uploading returns a safe same-origin `/api/research/covers/<uuid>` address. It does not save the article: the editor retains its draft, displays the image and applies the URL only when Save succeeds. Replacement creates a new key so an existing publication keeps its original image until Save; removing the cover clears the article reference after Save.

The picker accepts JPEG, PNG and WebP up to 10 MiB, with server validation independent of the picker. Upload and image reads are bounded. Research content accepts only exact generated cover API paths in addition to the previous safe asset URL allowlist. Uploaded objects are publicly readable by their unguessable image URL, including before publication; do not upload confidential material. Public image responses use an image MIME and `nosniff`; neither API nor BFF fetches arbitrary user-provided destinations.

Manual HTTPS cover links remain an optional alternative. PDF still uses an existing URL, not computer upload. External-host downloads may open in the browser depending on that host's headers; same-origin sample PDF supports actual download.

Local storage is a development-only S3-compatible server with a persistent Docker volume and no exposed host port, launched by `infra/local/start.sh`; it contains real bytes but does not establish production provider readiness. Existing S3 configuration must be supplied on the client deployment. Unreferenced uploads and replaced images are retained; automatic orphan-object collection and irreversible deletion are not implemented. Back up object storage along with the database before production use.

## Local examples and verification

Original demonstration SVG: `web/public/research-assets/ecology-careers.svg`. PDF: `web/public/research-assets/sample-research.pdf`, explicitly an illustrative testing document with no market statistics or actual study results. Both are local test assets, not client-supplied research.

Use isolated `infra/local/start.sh` environment (frontend 3100, Go API 18081, editing PostgreSQL 5544); never connect test cleanup to upstream 5433. Research migration expands schema, with no production seed data. Local seeds must be conflict-safe and retain administrator edits. Mutation/concurrency backend tests use a separately named disposable database, not the editing database. Parent acceptance requires authenticated create/save/reload/publish/public/archive, unauthorized/moderator rejection, safe assets, section ordering and anchors, desktop/mobile and RU/EN.

Deployment, real studies, PDF uploads, production storage provisioning, automatic orphan-object cleanup, additional analytics and ECO rebranding are not included in this slice.
