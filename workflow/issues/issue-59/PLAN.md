# Issue #59 — Implementation Plan: Manual Film Metadata Rematch

## Overview

Add a user-facing **Edit Film Match** flow on `/watchlist/[id]`: a modal TMDB search backed by two new API endpoints (`GET /films/{id}/tmdb-search`, `POST /films/{id}/rematch`). Rematch reuses the existing metadata persistence and background semantic/embedding pipeline (`accept_review` pattern), with explicit guards for in-flight enrichment and duplicate `tmdb_id`/`imdb_id` ownership.

**Approach:** Extend `MetadataService` with `search_tmdb` and `rematch_film`; wire routes on `films.py`; add repository helpers for conflict detection and review reconciliation; build `EditFilmMatchDialog` on the film detail page with debounced search, rematch mutation, cache invalidation, and enrichment polling.

No schema migrations — existing tables and enums are sufficient.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/app/providers/tmdb.py` | Extend `TmdbSearchResult` with `poster_path`; map in `search_movie` | Search list posters without N+1 detail calls |
| `api/app/schemas/film_schemas.py` | Add `TmdbSearchResultItem`, `TmdbSearchResponse`, `RematchRequest`, `RematchResponse` | Typed API contracts for new endpoints |
| `api/app/repositories/film_metadata_repository.py` | Add `get_by_tmdb_id`, `get_by_imdb_id` (exclude `film_id` param) | Pre-upsert duplicate detection |
| `api/app/repositories/metadata_review_repository.py` | Add `resolve_pending_for_film` | Mark pending reviews accepted on rematch |
| `api/app/services/metadata_service.py` | Add `search_tmdb`, `rematch_film`; parameterize `_persist_metadata` (`metadata_source`, `match_confidence`) | Core business logic |
| `api/app/routers/v1/films.py` | Add `GET /{film_id}/tmdb-search`, `POST /{film_id}/rematch` | HTTP surface |
| `api/tests/test_integration_rematch.py` | **New** — integration tests for rematch flows | Acceptance criteria coverage |
| `api/tests/test_tmdb_search.py` | **New** — unit tests for search result mapping (optional, or fold into integration) | TMDB client poster_path mapping |
| `documents/api-contracts.md` | §4.4 Search TMDB, §4.5 Rematch + mermaid state diagram | Contract documentation |
| `frontend/src/types/api.ts` | Add search/rematch types | TypeScript parity |
| `frontend/src/lib/api-client.ts` | Add `searchTmdb`, `rematchFilm` | API client |
| `frontend/src/hooks/use-films.ts` | Add `useTmdbSearch`, `useRematchFilm`; extend `useFilm` with optional `refetchInterval` | React Query layer |
| `frontend/src/components/edit-film-match-dialog.tsx` | **New** — modal search + confirm UI | Primary UX |
| `frontend/src/components/film-detail-view.tsx` | Add **Edit Film Match** CTA; wire dialog | Entry point (all enrichment states) |
| `frontend/src/app/watchlist/[filmId]/page.tsx` | Pass polling/refetch to `useFilm` when `enriching` | Post-rematch status updates |
| `frontend/src/app/review/page.tsx` | Link film title/card to `/watchlist/{film_id}`; optional “Choose different match” link | Review entry point |
| `frontend/e2e/film-rematch.spec.ts` | **New** — mocked API Playwright tests | Dialog + post-rematch UI |
| `frontend/e2e/helpers/film-rematch-mocks.ts` | **New** — route mocks for search/rematch | E2E isolation |

## Implementation steps

### Step 1 — Backend schemas and TMDB client (commit 1)

1. Add `poster_path: str | None` to `TmdbSearchResult`; populate from TMDB `poster_path` in `search_movie`.
2. Add Pydantic schemas:
   - `TmdbSearchResultItem`: `tmdb_id`, `title`, `original_title`, `year`, `overview`, `poster_url`
   - `TmdbSearchResponse`: `{ data: list[TmdbSearchResultItem] }`
   - `RematchRequest`: `{ tmdb_id: int }`
   - `RematchResponse`: `{ film_id, enrichment_status: "enriching" }`

### Step 2 — Repository helpers (commit 2)

1. `film_metadata_repository.get_by_tmdb_id(db, tmdb_id, *, exclude_film_id=None)` — return row if another film holds the ID.
2. `film_metadata_repository.get_by_imdb_id(db, imdb_id, *, exclude_film_id=None)` — same for IMDb.
3. `metadata_review_repository.resolve_pending_for_film(db, film_id, status=ReviewStatus.ACCEPTED)` — update all `PENDING` reviews for the film.

### Step 3 — MetadataService (commit 3)

1. Refactor `_persist_metadata` to accept `metadata_source: str = "tmdb"` and `match_confidence: float` (callers pass explicit values).
2. `async def search_tmdb(self, db, film_id, *, q: str, year: int | None, limit: int)`:
   - Validate film exists (`404`).
   - Cap `limit` at 20 (default 10).
   - Call `tmdb.search_movie(q, year=year)`; on `httpx.HTTPError` raise `AppError(PROVIDER_ERROR, 502)`.
   - Map results to `TmdbSearchResultItem` with `TmdbClient.poster_url`.
3. `async def rematch_film(self, db, film_id, tmdb_id: int) -> Film`:
   - `404` if film not found.
   - `409 CONFLICT` if `enrichment_status` in `{matching, enriching}`.
   - Fetch TMDB details + keywords; `404` if movie not found; `502` on provider HTTP error.
   - Conflict check: if `get_by_tmdb_id(tmdb_id, exclude_film_id=film_id)` or `get_by_imdb_id(details.imdb_id, exclude_film_id=film_id)` returns a row → `409` with message naming the conflicting film.
   - Call `_persist_metadata(..., metadata_source="tmdb_manual", match_confidence=1.0)`.
   - `resolve_pending_for_film` (mark pending reviews `accepted`).
   - `update_enrichment_status(ENRICHING)`.
   - If film has `import_job_id`, call `sync_import_job_progress` (recover from `failed`).
   - Return film. Same `tmdb_id` on same film is allowed (re-triggers enrichment).

### Step 4 — Router endpoints (commit 4)

Add to `api/app/routers/v1/films.py` (register `/{film_id}/tmdb-search` and `/{film_id}/rematch` **before** `GET /{film_id}` if needed for clarity):

```python
@router.get("/{film_id}/tmdb-search", response_model=TmdbSearchResponse)
async def tmdb_search(film_id, q, year, limit, db, metadata_service): ...

@router.post("/{film_id}/rematch", response_model=RematchResponse, status_code=202)
async def rematch_film(film_id, body, background_tasks, db, metadata_service, provider_service):
    film = await metadata_service.rematch_film(db, film_id, body.tmdb_id)
    db.commit()
    background_tasks.add_task(run_semantic_pipeline_for_film, film.id, provider_service)
    return RematchResponse(film_id=film.id, enrichment_status="enriching")
```

Mirror `reviews.py` accept pattern: commit before background task.

### Step 5 — Integration tests (commit 5)

New file `api/tests/test_integration_rematch.py` using existing `integration_client` + mocked TMDB/OMDb/OpenAI fixtures:

| Test | Acceptance criterion |
|------|---------------------|
| `test_rematch_from_ready_transitions_to_ready` | AC: rematch from `ready`; metadata `tmdb_manual`, `match_confidence=1.0`; semantic profile present |
| `test_rematch_from_failed_transitions_to_ready` | AC: recover `failed` film |
| `test_rematch_from_review_required_reconciles_review` | AC: pending review marked accepted; film leaves `/films/review-required` |
| `test_rematch_conflict_while_enriching` | AC: `409` during `enriching` |
| `test_rematch_conflict_duplicate_tmdb_id` | AC: `409` when `tmdb_id` owned by another film |
| `test_tmdb_search_returns_results` | AC: search proxy returns poster/title/year |
| `test_tmdb_search_not_found_film` | AC: `404` for unknown film |

Reuse `_wait_for_film_status` from `test_integration_review.py` (extract to shared helper if convenient).

### Step 6 — API documentation (commit 6)

Update `documents/api-contracts.md`:

- **§4.4 Search TMDB for Film** — query params (`q`, `year`, `limit`), response shape, errors (`NOT_FOUND`, `PROVIDER_ERROR`).
- **§4.5 Rematch Film** — request body, `202` response, errors (`NOT_FOUND`, `CONFLICT`, `PROVIDER_ERROR`).
- Mermaid state diagram from SPEC (rematch transitions).

### Step 7 — Frontend API layer (commit 7)

1. Add types to `frontend/src/types/api.ts`.
2. Add `searchTmdb(filmId, params)` and `rematchFilm(filmId, tmdbId)` to `api-client.ts`.
3. `useTmdbSearch(filmId, { q, year }, { enabled })` — debounce `q` ~300ms in the hook or dialog (mirror `history/page.tsx` pattern).
4. `useRematchFilm()` — `useMutation`; on success invalidate `["films"]`, `["films", filmId]`, `["films", "review-required"]`.
5. Extend `useFilm(filmId, { pollWhileEnriching?: boolean })` — `refetchInterval: 2000` when `data?.enrichment_status === "enriching"`.

### Step 8 — Edit Film Match UI (commit 8)

1. **`EditFilmMatchDialog`** (`edit-film-match-dialog.tsx`):
   - Props: `film: FilmDetail`, `open`, `onOpenChange`.
   - Pre-fill search from `film.title` / `film.year`.
   - Optional year filter input.
   - Scrollable result list: `FilmPoster`, title, year, overview snippet.
   - Select row → highlight; **Confirm match** disabled until selection.
   - On confirm: call `useRematchFilm`; close dialog; toast “Regenerating enrichment…”
   - Error states: provider error, conflict (show API message).
   - Use `Dialog`, `Button`, `Input` from design system; `max-w-2xl` for wider result list.

2. **`FilmDetailView`**:
   - Add **Edit Film Match** `Button` in hero area (visible for **all** `enrichment_status` values).
   - When `enriching`, show badge/inline note “Updating metadata…”
   - Render `EditFilmMatchDialog`.

3. **`watchlist/[filmId]/page.tsx`**:
   - `useFilm(filmId, { pollWhileEnriching: true })`.
   - On transition `enriching → ready`: toast success; `enriching → failed`: toast error.

### Step 9 — Review page links (commit 9)

In `frontend/src/app/review/page.tsx`:

- Wrap film title in `Link` to `/watchlist/{film.film_id}`.
- Add outline button **Choose different match** → same link (or `router.push` to detail where dialog can be opened via optional `?editMatch=1` query — execute may add `useSearchParams` to auto-open dialog when present).

### Step 10 — Playwright E2E (mocked API) (commit 10)

New `frontend/e2e/film-rematch.spec.ts` with route mocks (no full stack):

| Test | Verifies |
|------|----------|
| Edit button visible on failed film detail | AC: CTA on all states |
| Opens dialog with pre-filled search | AC: modal + pre-fill |
| Search results render; select + confirm calls rematch | AC: dialog interaction |
| After mocked rematch → enriching → ready, metadata updates | AC: cache/polling refresh |

Use `page.route` to mock `GET .../tmdb-search` and `POST .../rematch`, then `GET .../films/{id}` sequence returning `enriching` then `ready` with updated poster/title.

## Tests required

| Acceptance criterion | Test type | Location |
|---------------------|-----------|----------|
| Edit button all states | Playwright (mocked) | `e2e/film-rematch.spec.ts` |
| Modal search + results | Playwright (mocked) | `e2e/film-rematch.spec.ts` |
| Rematch → enriching → ready/failed | Integration | `test_integration_rematch.py` |
| `tmdb_manual`, confidence 1.0 | Integration | `test_integration_rematch.py` |
| Semantic/embed regeneration | Integration (wait for `ready`, assert `semantic_profile`) | `test_integration_rematch.py` |
| 409 matching/enriching | Integration | `test_integration_rematch.py` |
| 409 duplicate tmdb_id | Integration | `test_integration_rematch.py` |
| Review reconciliation | Integration | `test_integration_rematch.py` |
| Review page links | Playwright or manual demo | `e2e/film-rematch.spec.ts` / demo |
| Cache invalidation / polling | Playwright (mocked) | `e2e/film-rematch.spec.ts` |
| api-contracts.md | Doc review | `documents/api-contracts.md` |
| Frontend types | `tsc --noEmit` | Phase 6/8 gate |

## Gate script

Run before final push (execute agent):

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
bash scripts/verify-phase8-gates.sh
```

Phase 8 covers API integration regression, frontend `tsc`/build, and prior phase gates. If the ephemeral Postgres on `:5432` is occupied by Compose, follow AGENTS.md gotcha (gate script manages its own container).

Additionally before push:

```bash
cd api && ruff check app tests
cd frontend && npx tsc --noEmit
cd frontend && npx playwright test e2e/film-rematch.spec.ts
```

## Documentation updates

| File | Update |
|------|--------|
| `documents/api-contracts.md` | §4.4, §4.5, rematch state diagram |
| `README.md` | No change required (feature is self-explanatory in UI) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Unique constraint race on `tmdb_id` | Pre-check + existing `IntegrityError` handling; integration test |
| TMDB key missing in cloud demo | Demo spec notes provider key required for live search; mocked E2E for CI |
| Long enrichment poll timeouts | 30s timeout in tests; UI shows enriching badge |
| Review list stale after rematch | Invalidate `["films", "review-required"]` on rematch success |

**Rollback:** Revert branch commits. No migrations to roll back. Rematched films retain `tmdb_manual` metadata — acceptable; re-import CSV if needed.

## Definition of done

- [ ] `GET /films/{id}/tmdb-search` and `POST /films/{id}/rematch` implemented and documented in `api-contracts.md`
- [ ] `MetadataService.rematch_film` handles all state guards, conflict detection, review reconciliation, import job sync
- [ ] `metadata_source="tmdb_manual"` and `match_confidence=1.0` on manual rematch
- [ ] Background semantic + embedding pipeline runs after rematch (`202 Accepted`)
- [ ] `EditFilmMatchDialog` on film detail for all enrichment states
- [ ] Review page links to `/watchlist/{film_id}`
- [ ] React Query invalidation + enrichment polling on detail page
- [ ] Integration tests pass for `ready`, `failed`, `review_required`, conflicts
- [ ] Playwright mocked E2E passes for dialog and UI update
- [ ] `ruff check`, `tsc --noEmit`, `verify-phase8-gates.sh` pass
- [ ] No open questions in SPEC
