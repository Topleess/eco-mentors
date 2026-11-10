# Vacancy administration

## Runtime

`/admin/vacancies` is the working administrator list. Titles open `/admin/vacancies/[id]`; `/admin/vacancies/new` creates a draft. Published rows have a separate public-view link. Industries and cities are chosen or added directly in searchable dropdowns in the editor; there is no separate management workflow. Existing admin styling, session checks and RU/EN are retained; ECO rebranding and Telegram remain deferred.

Migration `000016_vacancies` adds PostgreSQL-backed vacancies, industries and cities. The Go API owns data; Next BFF routes forward the existing administrator session. Live pages never fall back to fixtures or browser storage. Public list/detail perform request-time reads; drafts and archives are excluded, including direct detail URLs. Demonstration content remains noindex, without JobPosting markup. Actual application delivery is not implemented.

## Public catalog

The public search reuses `MentorsSearch` from the homepage with localized placeholder “Должность, компания, город” and an accessible name instead of a visible label. Industry and work-format filters use homepage-style pills and bounded dropdown panels, selected-state colors and per-option totals from published records. Search still matches title/company/city; both facets combine with search and reset together. Dropdowns close on outside pointer, focus departure or Escape, and Escape/selection returns focus to their trigger. No surrounding field panel or native selects.

## Editing

The editor saves title, company, industry/city references, work format, employment, experience, nullable salary, description, task/requirement/condition lists and publication status. The editor has no URL/slug field. On the first valid save of a new record it generates `vacancy-<crypto.randomUUID()>` internally, reuses that candidate for retries and retains the existing stored slug on subsequent edits. Identical titles get independent URLs; the database UNIQUE constraint remains authoritative. No random value is generated during SSR. New records use manual provenance; seeded fictional jobs retain synthetic provenance and a sample label.

Updates require a version; conflicts return 409 instead of silently overwriting changes. The form retains entered data on failure. Successful saves read the exact record back before reporting success. Internal link navigation and page unload warn about unsaved editor changes; the internal-link guard does not cover browser-history navigation.

Industries/cities have stable IDs/slugs, editable names and an active flag. Names are joined at read time, so renaming changes existing vacancy displays. Inactive entries remain attached to existing records but cannot be newly assigned. The editor exposes selection and creation by name only: open the dropdown, type to filter, select an existing match or explicitly add a missing value. Technical dictionary slugs are generated internally. Creation verifies API readback and selects the persisted entry without discarding unsaved vacancy text. Separate rename/deactivation management is not exposed in this workflow; backend capabilities remain. Go DELETE rejects referenced entries.

## Routes

Public Go API under `/api/v1`:
- `GET /vacancies` -> `{ vacancies }`
- `GET /vacancies/:slug` -> `{ vacancy }`
- `GET /vacancies/dictionaries` -> `{ industries, cities }`

Administrator API (live admin session, moderators rejected):
- `GET/POST /admin/vacancies`; `GET/PUT /admin/vacancies/:id`
- `GET/POST /admin/vacancy-industries`; `PUT/DELETE /admin/vacancy-industries/:id`
- Equivalent city routes at `/admin/vacancy-cities`

Next exposes matching `/api/...` BFF routes used by the UI. Dictionary detail BFF permits GET/PUT, but the UI uses collection reads and PUT; no Go dictionary detail GET exists. Backend failures propagate rather than showing synthetic fallback records.

## Local operation

Use `./infra/local/start.sh`: isolated `openmentor-local-edit` web 3100/API 18081/PostgreSQL 5544, not the older upstream stack on 3000/8081/5433. Backend edits require `./infra/local/start.sh backend`. `infra/local/vacancies-seed.sql` inserts twelve fictional jobs, five industries and eleven cities only in this local environment; conflict-safe reruns preserve edits. Global migrations contain no demonstration seed.

Database tests must use a separate disposable PostgreSQL, never editing DB 5544. API checks: `GOTOOLCHAIN=go1.26.5 make ci` with a disposable test URL. Frontend: `make pre-commit`, then `make build` away from the active dev server's `.next`. Browser acceptance covers creation/reload/edit/publication/public read/archive, dictionaries, access denial, conflict recovery, RU/EN and mobile layouts. Remove QA-only records using exact recorded IDs after testing; never reset/truncate the editing database.
