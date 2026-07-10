# Issue #99 — Implementation Plan: Add a film to your watch list

## Overview

This is a **new feature** (not a bug fix). Users will search TMDB on `/watchlist/add`, confirm a pick, and the backend will resolve Letterboxd identity via the public `https://letterboxd.com/tmdb/{tmdb_id}` redirect, create or restore a film + active watchlist entry, persist TMDB metadata, and enqueue the existing semantic/embedding pipeline. When redirect resolution fails, the film lands in `review_required` with a new **Letterboxd URI resolution** review type; the user pastes a valid Letterboxd film URL on `/review` to complete the add.

The plan reuses patterns from issue #59 (TMDB search/rematch UI and `MetadataService._persist_metadata`) and extends sync/import behavior so manual adds persist across CSV re-import and remain subject to RSS lifecycle events.

## Classification

**Feature** — no bug reproduction required. Acceptance criteria describe adding new behavior; no existing shipped flow is broken.

## Architecture

```mermaid
sequenceDiagram
    participant UI as /watchlist/add
    participant API as POST /watchlist/films
    participant TMDB as TMDB API
    participant LB as letterboxd.com/tmdb/{id}
    participant DB as Postgres
    participant Pipe as Enrichment pipeline

    UI->>API: { tmdb_id }
    API->>TMDB: get_movie_details
    API->>LB: GET (follow redirects)
    alt Redirect to /film/{slug}/
        API->>DB: create/restore film + watchlist entry
        API->>DB: persist metadata (tmdb_manual_add)
        API-->>UI: 202 enriching
        API->>Pipe: background task
    else Redirect fails
        API->>DB: stub film (pending URI) + letterboxd review
        API-->>UI: 202 review_required + review_id
    end
```

## Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manual-add tracking | `films.add_source` column (`NULL` legacy, `'manual'` for in-app adds) | CSV/RSS films also use `import_job_id`; metadata alone is set too late for `review_required` stubs |
| Letterboxd review storage | Extend `metadata_match_reviews` with `review_type` enum (`tmdb_match`, `letterboxd_uri`) | Reuses list/accept patterns; `candidate_tmdb_id` still holds user-selected TMDB id |
| Pending URI placeholder | `https://letterboxd.com/film/_pending-manual-{film_id}/` | Satisfies `NOT NULL UNIQUE` on `letterboxd_uri` until user resolves; replaced on accept |
| Global TMDB search | `GET /films/tmdb-search` (no `film_id`) + refactor shared search core | Spec path; register **before** `/{film_id}/tmdb-search` in router |
| Watchlist add endpoint | New `watchlist` router: `POST /watchlist/films` | Keeps films router focused; clear API surface per spec |
| Letterboxd redirect client | `app/services/letterboxd_resolver.py` | httpx with redirects; parse final URL; optional in-process cache |
| boxd.it short links | Follow redirect via httpx in `letterboxd_uri.py` | Existing `extract_film_slug` does not handle short links |

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `api/alembic/versions/0006_manual_watchlist_add.py` | New migration | `films.add_source`; `metadata_match_reviews.review_type` |
| `api/app/database/models.py` | Modify | ORM fields for new columns |
| `api/app/database/enums.py` | Modify | `FilmAddSource`, `ReviewType` enums |
| `api/app/services/letterboxd_resolver.py` | New | TMDB→Letterboxd redirect resolution |
| `api/app/services/letterboxd_uri.py` | Modify | `normalize_pasted_uri()` with boxd.it follow |
| `api/app/services/watchlist_add_service.py` | New | Orchestrate add/restore/duplicate/review flows |
| `api/app/services/metadata_service.py` | Modify | Extract global TMDB search; `resolve_letterboxd_review()` |
| `api/app/services/sync_service.py` | Modify | CSV diff: skip `add_source='manual'` in removal set |
| `api/app/repositories/film_repository.py` | Modify | `create_manual()` with optional `add_source`; `update_letterboxd_uri()` |
| `api/app/repositories/metadata_review_repository.py` | Modify | `review_type` on create; filter/list by type |
| `api/app/routers/v1/films.py` | Modify | `GET /tmdb-search` global route |
| `api/app/routers/v1/watchlist.py` | New | `POST /films` add endpoint |
| `api/app/routers/v1/reviews.py` | Modify | `POST /{review_id}/resolve-letterboxd` |
| `api/app/routers/v1/__init__.py` | Modify | Register watchlist router |
| `api/app/schemas/film_schemas.py` | Modify | `WatchlistAddRequest/Response`, global search unchanged shape |
| `api/app/schemas/review_schemas.py` | Modify | `ResolveLetterboxdRequest`, extend `ReviewRequiredFilm` with `review_type` |
| `api/app/services/film_presenter.py` | Modify | Include `review_type` in review list items |
| `api/tests/test_letterboxd_resolver.py` | New | Unit tests for redirect parsing |
| `api/tests/test_letterboxd_uri.py` | Modify | boxd.it normalization tests |
| `api/tests/test_integration_watchlist_add.py` | New | Happy path, review, duplicate, restore, CSV non-removal |
| `api/tests/test_csv_sync_diff.py` | Modify | Manual-add exclusion from removal |
| `frontend/src/app/watchlist/add/page.tsx` | New | Search, results, confirm, poll |
| `frontend/src/components/add-film-search.tsx` | New | Shared TMDB search UI (extracted from rematch dialog patterns) |
| `frontend/src/app/page.tsx` | Modify | Third CTA: Add film to watchlist |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Modify | Add button → `/watchlist/add` |
| `frontend/src/app/review/page.tsx` | Modify | Letterboxd URI paste card when `review_type === 'letterboxd_uri'` |
| `frontend/src/hooks/use-films.ts` | Modify | `useGlobalTmdbSearch`, `useAddToWatchlist` |
| `frontend/src/hooks/use-reviews.ts` | Modify | `useResolveLetterboxdReview` |
| `frontend/src/lib/api-client.ts` | Modify | New API methods + types |
| `frontend/src/types/api.ts` | Modify | Request/response types |
| `frontend/e2e/watchlist-add.spec.ts` | New | Mocked API E2E for add flow |
| `frontend/src/components/add-film-search.test.tsx` | New | Unit test for search/confirm |
| `documents/api-contracts.md` | Modify | Document new endpoints and error codes |
| `documents/sequence-diagrams.md` | Modify | Manual watchlist add sequence |

## Implementation steps

### Step 1 — Schema migration

1. Add Alembic `0006_manual_watchlist_add.py`:
   - `films.add_source TEXT NULL` with check `add_source IN ('manual')` or use PG enum
   - `metadata_match_reviews.review_type TEXT NOT NULL DEFAULT 'tmdb_match'` with check `review_type IN ('tmdb_match', 'letterboxd_uri')`
2. Update `models.py` and `enums.py`.

### Step 2 — Letterboxd resolver

1. Implement `letterboxd_resolver.resolve_letterboxd_uri(tmdb_id) -> str | None`:
   - `GET https://letterboxd.com/tmdb/{tmdb_id}` with `follow_redirects=True`, timeout ~10s
   - Accept final URL matching `letterboxd.com/film/{slug}/`
   - Reject member pages, lists, 404, non-film destinations
   - Module-level LRU cache for successful mappings
2. Extend `letterboxd_uri.normalize_pasted_uri(url)`:
   - If already `/film/{slug}/` → canonical form
   - If `boxd.it/*` → httpx HEAD/GET follow redirects, then extract slug
   - Raise `validation_error` on invalid patterns

### Step 3 — Watchlist add service

Implement `WatchlistAddService.add_film(db, tmdb_id)`:

1. Fetch TMDB details (404 → `NOT_FOUND`; provider errors → `502`)
2. Reject TV / non-movie if TMDB `media_type` or missing movie details (clear `VALIDATION_ERROR`)
3. Call `letterboxd_resolver.resolve_letterboxd_uri(tmdb_id)`
4. **If URI resolved:**
   - `existing = film_repository.get_by_letterboxd_uri(uri)`
   - Active watchlist entry → return `200 { already_on_watchlist: true, film_id }`
   - `archived`/`watched` → `restore_active`, `ensure_active_entry`, re-enrich only if not `ready` → `202 { restored: true }`
   - New film → `create_manual(..., add_source='manual')`, `ensure_active_entry`, persist metadata (`metadata_source='tmdb_manual_add'`, `match_confidence=1.0`), status `enriching`
5. **If URI not resolved:**
   - Create film with pending placeholder URI, `add_source='manual'`, `enrichment_status=review_required`
   - Create `metadata_match_reviews` row with `review_type='letterboxd_uri'`, `candidate_tmdb_id=tmdb_id`, payload from TMDB pick
   - Ensure inactive or no watchlist entry yet (activate on resolve only)
   - Return `202 { enrichment_status: 'review_required', review_id }`
6. **No cap check** — do not call `watchlist_size_exceeded` (manual exempt per Q6)
7. On TMDB metadata conflict (duplicate `tmdb_id` on another film) → `409 CONFLICT` with existing film hint

Add `film_repository.create_manual()` accepting `import_job_id=None` (relax `create()` or add sibling).

### Step 4 — Global TMDB search

1. Refactor `MetadataService.search_tmdb` → private `_search_tmdb_results(q, year, page, limit)` without film lookup
2. Keep `search_tmdb(db, film_id, ...)` validating film exists, then delegate
3. Add `search_tmdb_global(...)` for global endpoint
4. Register `GET /films/tmdb-search` on films router **above** `/{film_id}/tmdb-search`

### Step 5 — Letterboxd review resolve

1. `POST /reviews/{review_id}/resolve-letterboxd` body `{ letterboxd_uri: string }`
2. Guard: review exists, `review_type == 'letterboxd_uri'`, status `pending`
3. Normalize pasted URI; check duplicate active watchlist → `already_on_watchlist` path
4. Update film `letterboxd_uri` (replace placeholder); `ensure_active_entry`
5. Persist TMDB metadata from stored `candidate_tmdb_id`; set `enriching`; enqueue pipeline
6. Mark review `accepted`

### Step 6 — CSV diff manual-add persistence

In `SyncService.csv_diff`, when building `result.removed`, skip films where `film.add_source == 'manual'` (and still absent from CSV). RSS watched events unchanged.

### Step 7 — Frontend `/watchlist/add`

1. Page layout per DESIGN.md (search input, optional year, debounced TMDB results grid with poster/title/year/overview)
2. Confirm button calls `POST /watchlist/films`
3. On `enriching` → poll `GET /films/{id}` until `ready`/`failed`; toast + redirect to watchlist detail or list
4. On `already_on_watchlist` → inline message + link to `/watchlist/{film_id}`
5. On `review_required` → toast + link to `/review`
6. On `restored` → success copy + link

Extract reusable search UI from `EditFilmMatchDialog` where practical; global search hook does not require `filmId`.

### Step 8 — Home and Watchlist entry points

1. **Home** (`page.tsx`): when `hasWatchlist`, change grid to three cards in order: New recommendation → **Add film to watchlist** → History (use `sm:grid-cols-3` or stacked on narrow)
2. **Watchlist** (`watchlist-page-content.tsx`): primary button in header row linking to `/watchlist/add`

### Step 9 — Review page extension

When `review_type === 'letterboxd_uri'`:
- Distinct heading/copy: “Paste the Letterboxd film URL”
- Text input + Submit (not Accept TMDB match)
- Call `resolve-letterboxd` endpoint
- Hide confidence / TMDB candidate accept-reject for this type

Extend `GET /films/review-required` response with `review_type` field.

### Step 10 — Documentation

Update `api-contracts.md` §4 (global search), new § for watchlist add, new review resolve endpoint, error codes. Add sequence diagram to `sequence-diagrams.md`.

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| `/watchlist/add` TMDB search UI | `frontend/src/components/add-film-search.test.tsx`; `e2e/watchlist-add.spec.ts` (mocked) |
| Home CTA between New recommendation and History | `e2e/watchlist-add.spec.ts` scenario 2 |
| Watchlist add button | `e2e/watchlist-add.spec.ts` scenario 3 |
| `GET /films/tmdb-search` global | `test_integration_watchlist_add.py::test_global_tmdb_search` |
| `POST /watchlist/films` happy path | `test_integration_watchlist_add.py::test_add_film_happy_path_enriches_to_ready` |
| Letterboxd redirect → enriching | Same test with mocked redirect |
| Redirect fail → review_required | `test_integration_watchlist_add.py::test_add_film_redirect_failure_creates_letterboxd_review` |
| Paste Letterboxd URL resolve | `test_integration_watchlist_add.py::test_resolve_letterboxd_review_completes_add` |
| boxd.it normalization | `test_letterboxd_uri.py::test_normalize_boxd_it_short_link` |
| Already on watchlist | `test_integration_watchlist_add.py::test_add_film_already_on_watchlist` |
| Restore archived | `test_integration_watchlist_add.py::test_add_film_restores_archived` |
| Restore watched | `test_integration_watchlist_add.py::test_add_film_restores_watched` |
| Manual add exempt from 500 cap | `test_integration_watchlist_add.py::test_manual_add_exempt_from_cap` (seed 500+ via mocks or fixture) |
| CSV does not remove manual adds | `test_integration_watchlist_add.py::test_csv_sync_preserves_manual_add`; extend `test_csv_sync_diff.py` |
| RSS watched still applies | `test_integration_watchlist_add.py::test_rss_watched_applies_to_manual_add` (reuse RSS test patterns) |
| Invalid TMDB id | `test_integration_watchlist_add.py::test_add_film_invalid_tmdb_id` |
| User TMDB pick skips TMDB confidence review | Assert no `tmdb_match` pending review on happy path |
| Frontend tsc | `npx tsc --noEmit` (Phase 6 gate) |

Integration tests use mocked TMDB, Letterboxd redirect (httpx/respx), and OpenAI per existing `integration_client` fixtures.

## Gate script

Run before push (execute stage):

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
bash scripts/verify-phase8-gates.sh
```

Rationale: feature spans API (sync + enrichment + new endpoints), frontend MVP pages, and docs — Phase 8 is the full regression gate. If Phase 8 is too heavy for a first execute commit, minimum: Phase 4 (sync) + Phase 6 (frontend) + new integration tests; Phase 8 required before babysit.

## Documentation updates

- `documents/api-contracts.md` — global search, watchlist add, resolve-letterboxd, response variants, error codes
- `documents/sequence-diagrams.md` — manual add flow diagram
- Optional one-line in `documents/how-cuebox-works.md` under watchlist section (only if execute touches that file for accuracy)

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Letterboxd redirect rate limits / blocking | Timeout → review fallback; in-process cache; polite User-Agent |
| Placeholder URI collisions | Use film UUID in placeholder slug |
| CSV diff regression | Dedicated test; manual-only exclusion is narrow |
| Active watchlist >500 affects recommendations | Existing pipeline already handles large lists; no cap on manual adds is intentional |
| `boxd.it` resolution requires network in review | Integration test with mocked redirect; demo uses real stack |

**Rollback:** Revert migration `0006` (drop columns), remove router/service, revert frontend routes. Films with `add_source='manual'` would lose protection on CSV sync after rollback — acceptable for revert.

## Definition of done

- [ ] All acceptance criteria in `SPEC.md` implemented
- [ ] Alembic migration applied in API container (`alembic upgrade head`)
- [ ] `api/tests/test_integration_watchlist_add.py` passes with mocked providers
- [ ] CSV manual-add exclusion covered by unit/integration tests
- [ ] Frontend `/watchlist/add`, Home CTA, Watchlist button, review paste UI complete
- [ ] `documents/api-contracts.md` updated
- [ ] `npx tsc --noEmit` and `npm run test:unit` pass
- [ ] `bash scripts/verify-phase8-gates.sh` passes (or Phase 4 + 6 + targeted tests with Phase 8 before PR ready)
- [ ] Demo artifacts captured per `demo/demo-spec.md`
- [ ] No production code changes in planning stage (execute only)
