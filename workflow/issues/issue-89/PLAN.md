# Implementation plan — Issue #89

**Tier:** application

Add Letterboxd watched-library import (three CSVs) into Cuebox watch history, with schema support for null scores and a Settings UI separate from watchlist CSV sync.

## Overview

Cuebox can sync an active Letterboxd watchlist and mark individual films watched (#93 / #115), but cannot bulk-load existing watched history from Letterboxd’s `watched.csv` + `ratings.csv` + `diary.csv` export. This plan adds:

1. **Schema** — nullable `film_watches.score`, new `WatchSource.letterboxd_import`, idempotent unique `(film_id, watched_at)` for non-pending rows, and a small staging field for extra diary dates on unscored multi-diary imports.
2. **Backend** — parse/merge the three files, resolve/create films, apply status transitions, write watches, enqueue enrichment for new films (no active-cap checks).
3. **API** — `POST /api/v1/sync/watched` multipart + summary response; document in `documents/api-contracts.md`.
4. **Frontend** — Settings → Sync “Import watched history” card; tolerate `score: null` on Watched tab / film detail; review-queue path for diary-without-score.
5. **Fixtures + tests** — issue sample CSVs under `api/tests/fixtures/watched_import/` covering every scenario in the SPEC table.

This is a **feature** (greenfield import path), not a bug in shipped behavior — no `bug-repro-*` artifacts.

Sample files from the issue were downloaded and inspected during planning (10 watched / 7 ratings / 8 diary rows). Join keys are `Name.strip` + `Year.strip`. Diary `Letterboxd URI` values are **log** URIs (different from film URIs in `watched.csv`); film identity must prefer `watched.csv`’s URI.

## Reproduction findings

N/A — application feature, not a bug.

## Root cause

N/A — missing capability. Current constraints that block the feature today:

| Gap | Evidence |
|-----|----------|
| `film_watches.score NOT NULL` + check `score >= 0.5` | `api/alembic/versions/0007_pending_watch_review.py`, ORM `FilmWatch` |
| `WatchSource` ∈ `{manual, rss}` only | `api/app/database/enums.py`, DB check constraint |
| No three-file import endpoint | `api/app/routers/v1/sync.py` only `/csv` + RSS |
| Settings UI is watchlist CSV + RSS only | `frontend/src/app/settings/sync/page.tsx` |
| `create_pending` coerces `score=None` → `0.5` | `film_watch_repository.create_pending` |
| Frontend `FilmWatch.score: number` (non-null) | `frontend/src/types/api.ts`; detail renders `{watch.score}★` |

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/alembic/versions/0008_watched_import.py` | **New** | Nullable score; source `letterboxd_import`; unique non-pending `(film_id, watched_at)`; `staged_watched_dates` JSONB (or `DATE[]`) nullable on `film_watches` |
| `api/app/database/models.py` | Edit | Mirror migration: nullable `score`, updated checks, staging column |
| `api/app/database/enums.py` | Edit | `WatchSource.LETTERBOXD_IMPORT = "letterboxd_import"` |
| `api/app/services/watched_csv_parser.py` | **New** | Parse/validate three Letterboxd export CSVs; merge algorithm from SPEC |
| `api/app/services/watched_import_service.py` | **New** | Film resolve/create, status transitions, watch writes, enrichment enqueue, summary |
| `api/app/repositories/film_watch_repository.py` | Edit | Allow null score; create completed null-score watches; idempotent lookup by `(film_id, watched_at)`; staging helpers; stop coercing pending null → `0.5` |
| `api/app/repositories/film_repository.py` | Edit | Title+year lookup for existing films without URI match (reuse/`extend` RSS resolve patterns) |
| `api/app/services/watch_review_service.py` | Edit | On `complete_review`, materialize `staged_watched_dates` as extra completed watches with the same score; cancel path for import-only films (see Risks) |
| `api/app/schemas/sync.py` | Edit | `SyncWatchedResponse` (+ failure item) |
| `api/app/schemas/watch_review_schemas.py` | Edit | `FilmWatchBlock.score: float \| None` |
| `api/app/routers/v1/sync.py` | Edit | `POST /watched` multipart (`watched`, `ratings`, `diary`) |
| `api/app/services/film_presenter.py` | Edit | Pass through null scores |
| `documents/api-contracts.md` | Edit | §6.x watched import contract; note score nullability on watch blocks |
| `documents/database-design.md` | Edit | Update `film_watches` DDL |
| `frontend/src/app/settings/sync/page.tsx` | Edit | New “Import watched history” card (3 file inputs + summary + links) |
| `frontend/src/app/settings/sync/page.test.tsx` | Edit | Cover new card / validation / success summary |
| `frontend/src/hooks/use-sync.ts` | Edit | `useSyncWatched` mutation |
| `frontend/src/lib/api-client.ts` | Edit | `postSyncWatched(watched, ratings, diary)` multipart |
| `frontend/src/types/api.ts` | Edit | `FilmWatch.score: number \| null`; `source` includes `letterboxd_import`; `SyncWatchedResponse` |
| `frontend/src/components/film-detail-view.tsx` | Edit | Render unrated watches without inventing stars |
| `frontend/src/components/watch-review-dialog.tsx` | Edit | Tolerate null score on completed watches when editing |
| `api/tests/fixtures/watched_import/{watched,ratings,diary}.csv` | **New** | Issue sample CSVs (prod-like mini set) |
| `api/tests/test_watched_csv_parser.py` | **New** | Merge/date/rating unit tests |
| `api/tests/test_watched_import_service.py` | **New** | Integration: scenarios, idempotency, status transitions, cap |
| `api/tests/test_film_watch_null_score.py` | **New** | Schema/API null score round-trip |
| `frontend` unit tests for detail/null score + sync page | Edit/New | AC mapping |

**Explicitly unchanged / out of scope**

| Path / area | Why |
|-------------|-----|
| `POST /import` / `POST /sync/csv` watchlist contracts | Separate UX; do not overload |
| `MAX_ACTIVE_WATCHLIST = 500` constant | Cap stays; watched import must not call it for imported watched films |
| Questionnaire / recommendation candidate inclusion of watched | Future (#51 / roadmap) |
| Letterboxd write-back | Out of scope |

## Implementation steps

### Step 1 — Schema migration `0008`

Alembic revision after `0007`:

1. Drop/replace `chk_film_watches_score_range` → `(score IS NULL OR (score >= 0.5 AND score <= 5.0))`.
2. `ALTER COLUMN score DROP NOT NULL`.
3. Replace `chk_film_watches_source` → `source IN ('manual', 'rss', 'letterboxd_import')`.
4. Add nullable `staged_watched_dates JSONB` (array of ISO date strings) — used only on pending rows for diary-without-score multi-date imports.
5. `CREATE UNIQUE INDEX uq_film_watches_film_watched_at_completed ON film_watches (film_id, watched_at) WHERE is_pending = false`.
6. Update ORM + enum to match.

### Step 2 — Parsers + merge (pure functions)

New `watched_csv_parser.py`:

**Required headers (validate strictly):**

| File | Required columns |
|------|------------------|
| `watched.csv` | `Date`, `Name`, `Year`, `Letterboxd URI` |
| `ratings.csv` | `Date`, `Name`, `Year`, `Letterboxd URI`, `Rating` |
| `diary.csv` | `Date`, `Name`, `Year`, `Letterboxd URI`, `Watched Date` (also accept optional `Rating`, `Rewatch`, `Tags`) |

**Merge** (authoritative, from SPEC):

```
DEFAULT_WATCHED_AT = 1984-09-28
key = (Name.strip, Year.strip)

For each watched row:
  rating = ratings_by[key]   # optional
  diary_rows = diary_by[key] # 0..N, preserve order

  If no diary:
    one event: watched_at=DEFAULT, score=rating or null, completed=True
  Else:
    for each diary row:
      watched_at = diary["Watched Date"]  # NEVER diary Date
      score = rating.Rating if present else null
      completed = score is not None
```

**Diary-without-score special case (service layer):** emit one pending event at earliest `Watched Date`; remaining dates → `staged_watched_dates` (not separate pending rows).

**Rating parse:** reuse half-star normalization (`normalize_member_rating` or shared helper); empty rating → null.

Ignore ratings `Date` and diary `Date` for `watched_at`.

### Step 3 — Import service

`WatchedImportService.import_watched(db, watched_bytes, ratings_bytes, diary_bytes, background_tasks)`:

1. Parse + merge → list of per-film plans.
2. For each film plan:
   - **Resolve:** `get_by_letterboxd_uri(watched.uri)` → else title+year match (case-insensitive title, year) → else create stub (status applied below; **no** active watchlist entry).
   - **Status transitions** when film appears in `watched.csv` (SPEC table):
     - `active` → deactivate watchlist entry; then `watched` or `pending_watch_review`
     - `pending_watch_review` → if score supplied finalize/replace with completed imports + `watched`; else refresh pending date/staging
     - `archived` → `watched` or `pending_watch_review`
     - `watched` → add only new watch events; **never** demote to pending; new unscored diary dates → completed rows with `score=null`
   - **Watches:** for each completed event, skip if non-pending `(film_id, watched_at)` exists; else insert `source=letterboxd_import`.
   - **Pending:** at most one pending per film; set staging dates; do not create second pending.
3. New films → `schedule_enrichment_for_films` (same quality bar as watchlist import). **Do not** call `MAX_ACTIVE_WATCHLIST` checks for this path. Transitioning `active`→`watched` frees a slot as a side effect.
4. Return summary: `films_seen`, `films_created`, `watches_created`, `watches_skipped_duplicate`, `pending_review`, `enrichment_job_id` (optional), `failures[]`.

**Synchronous response:** parse/persist synchronous (like `/sync/csv`); enrichment async via `BackgroundTasks`. No separate job polling UI required for v1.

### Step 4 — Review finalize materializes staging

In `WatchReviewService.complete_review`, after finalizing the pending row:

- Read `staged_watched_dates`.
- For each staged date ≠ finalized `watched_at`, insert completed watch with same score/source (skip duplicates via unique index).
- Clear staging field.

### Step 5 — API

```
POST /api/v1/sync/watched
Content-Type: multipart/form-data
fields: watched, ratings, diary  (each a .csv file)
```

Validation errors → `INVALID_CSV_FORMAT` / `VALIDATION_ERROR` (400). Success → `200` + `SyncWatchedResponse`.

Wire router; keep `/sync/csv` untouched.

### Step 6 — Frontend Settings

New card **Import watched history** below CSV / RSS (or clearly separated):

- Three `FileUpload` controls (labels: `watched.csv`, `ratings.csv`, `diary.csv`).
- Import enabled only when all three selected.
- On success: show counts from response; link to `/watchlist?tab=watched`; if `pending_review > 0`, link to existing watch-review queue entry point.
- Do not reuse the watchlist CSV result UI copy — keep messaging watched-history specific.

### Step 7 — Null score UI

- Types: `score: number | null`; `source` union includes `"letterboxd_import"`.
- Film detail watch list: if `score == null`, show date only (e.g. `Unrated · {watched_at}`) — never invent `0` or `0.5★`.
- Edit dialog: allow opening completed null-score watches to set a score later (existing update endpoint still requires score — OK).

### Step 8 — Docs

Update `documents/api-contracts.md` §6 with watched import; update `documents/database-design.md` §4.5.1; brief note in `documents/how-cuebox-works.md` if it describes watch history sources.

### Step 9 — Tests + fixtures

Commit issue sample CSVs as fixtures. Cover every SPEC scenario (see Tests required).

## Tests required

| Test | Type | Acceptance criteria |
|------|------|---------------------|
| Parser rejects missing headers / empty files | Unit | API validates Letterboxd export headers |
| Merge: watched-only → default date + null score | Unit | AC + “12 Years a Slave” / “2001” |
| Merge: rated, no diary → score + default date | Unit | “Hellraiser” |
| Merge: uses Watched Date not Date | Unit | Love Lies Bleeding / Lady Vanishes |
| Merge: multi-diary expands N events | Unit | Kneecap / Groundhog Day |
| Diary-no-rating → pending + staging for extras | Unit/integration | Seven Samurai; N-diary unscored rule |
| Import creates completed watches + `status=watched` | Integration | Rated paths |
| Import creates pending_watch_review | Integration | Diary without score |
| Idempotent re-upload skips `(film_id, watched_at)` | Integration | Re-upload AC |
| Status: active → watched deactivates watchlist | Integration | Status transitions |
| Status: watched never demoted to pending | Integration | Status transitions |
| Status: archived → watched / pending | Integration | Status transitions |
| Existing film matched by URI / title+year, no duplicate film row | Integration | Match AC |
| New film enqueues enrichment; no active watchlist entry | Integration | New films AC |
| Watched import does not enforce 500 cap; active→watched frees slot | Integration | Cap AC |
| Null score persists and serializes as JSON `null` | Integration | Schema AC |
| `complete_review` materializes staged dates | Integration | Multi-diary unscored rule |
| Settings page shows separate card; requires 3 files | Frontend unit | Settings AC |
| Film detail renders unrated watch without fake stars | Frontend unit | Watched tab / detail AC |
| Optional: Playwright sync settings shows new card | E2E (if time) | Settings AC |

## Gate script

**Tier:** application

```bash
source scripts/cursor-workflow-config.sh
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

Also run focused suites during execute before the full gate:

```bash
cd api && ruff check app tests
# with reachable TEST_DATABASE_URL per AGENTS.md gotchas
pytest tests/test_watched_csv_parser.py tests/test_watched_import_service.py tests/test_film_watch_null_score.py tests/test_film_watch_review.py -v
cd frontend && npm run test:unit && npx tsc --noEmit
```

Narrower `verify-phase4-gates.sh` alone is insufficient (schema + frontend + watch-review). Prefer full `$APP_DEFAULT_GATE` before `execute-ready`.

## Documentation updates

- `documents/api-contracts.md` — new §6.x `POST /sync/watched`; update FilmWatch score nullability where documented
- `documents/database-design.md` — `film_watches` DDL
- `documents/how-cuebox-works.md` — short mention of watched-library import (optional but preferred)
- No README change required unless import is added to quick-start (optional one-liner)

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Unique `(film_id, watched_at)` fails on pre-existing duplicate completed watches | Migration: detect duplicates before index; fail loudly or dedupe keeping earliest `created_at` |
| Diary URIs ≠ film URIs | Always identity from `watched.csv` URI / title+year; never trust diary URI as film URI |
| `cancel_review` restores import-created pending films to **active** (wrong) | If film has no prior active watchlist membership (or pending `source=letterboxd_import` and never active), cancel → `archived` (or conflict) instead of `restore_active` |
| Large exports block request | v1 sync persist + async enrichment; document practical size; future job if needed |
| Pending placeholder score `0.5` leaks into UI | Stop coercing null→0.5; pending import rows keep `score=null`; dialog already treats low pending as empty |
| Enrichment without TMDB keys in demo | Demo uses fixtures + mocked providers in tests; live stack may show enrichment pending — assert watches/status regardless |
| Rollback | `alembic downgrade 0007`; remove endpoint + UI card; no watchlist data deleted by import path |

## Definition of done

- [ ] Migration `0008` applied; null scores and `letterboxd_import` work end-to-end
- [ ] `POST /api/v1/sync/watched` accepts three CSVs and returns accurate summary
- [ ] Merge rules + status transitions + idempotency match SPEC
- [ ] Diary-without-score → review queue; finalize materializes staged rewatch dates
- [ ] Settings shows separate Import watched history UI; Watched tab lists imported films; null scores render cleanly
- [ ] Active 500 cap unchanged; watched import uncapped
- [ ] Fixtures + tests map to every SPEC scenario
- [ ] Docs updated (`api-contracts`, `database-design`)
- [ ] `$APP_DEFAULT_GATE` passes
- [ ] Demo artifacts captured per `demo/demo-spec.md`

## PR seed

**Tier:** application  
**What / why:** Bulk-import Letterboxd watched history (`watched` + `ratings` + `diary` CSVs) into Cuebox watch records, separate from watchlist sync, with null-score support.  
**Key changes:** Alembic `0008` (nullable score, `letterboxd_import`, idempotent watches); `POST /sync/watched` + merge service; Settings import card; null-score UI; fixtures/tests from issue samples.  
**Gate:** Application default: `scripts/verify-phase8-gates.sh` exit 0  
**How to test:** Upload the three fixture CSVs on Settings → Sync; confirm Watched tab + review queue for Seven Samurai; re-upload and confirm skips; check Hellraiser scored default date and 12 Years a Slave unrated default date.
