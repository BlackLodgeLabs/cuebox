# Implementation plan — Issue #115: Tabbed watchlist with Watched/Archived lists and manual status management

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/115  
**Branch:** `cursor/issue-115-tabbed-watchlist-watched-archived`  
**Draft PR:** #116

## Overview

This is a **feature** (not a bug fix): Cuebox currently treats Letterboxd CSV re-sync as authoritative for removals and watched transitions, and hides watched/archived films from `/watchlist`. The work shifts watchlist lifecycle ownership to Cuebox via:

1. A new **`POST /films/{id}/status`** endpoint with a strict state machine and shared repository side effects.
2. **Tabbed `/watchlist` UI** (Watchlist / Watched / Archived) driven by URL `?tab=` and existing `GET /films` filters.
3. **Additive-only CSV re-sync** — new URIs only; existing films in any status are no-ops.
4. **RSS diary watched** behavior unchanged.

No DB migration is required; reuse `films.status`, `watchlist_entries.active` / `removed_at`, and existing repository mutators.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `api/app/services/film_status_service.py` | **New** | Centralize allowed transitions, idempotency, cap check, watchlist entry side effects |
| `api/app/schemas/film_schemas.py` | Extend | `FilmStatusRequest`, optional `removed_at` on `FilmSummary` |
| `api/app/routers/v1/films.py` | Extend | `POST /films/{id}/status` route |
| `api/app/repositories/watchlist_repository.py` | Extend | `get_latest_removed_at(film_id)` helper for list/detail presenter |
| `api/app/services/film_presenter.py` | Extend | Populate `removed_at` when film status is `watched` or `archived` |
| `api/app/repositories/film_repository.py` | Optional extend | Left join latest inactive entry in `list_films` when `status` filter set (or batch-fetch in presenter) |
| `api/app/services/sync_service.py` | Refactor | Replace destructive `csv_diff` with additive-only logic; drop remove/watched apply paths |
| `api/app/schemas/sync.py` | Simplify | Remove `removed`, `watched`, `removed_films`, `watched_films` from `SyncCsvResponse` |
| `api/app/routers/v1/sync.py` | Update | Map new response shape |
| `api/tests/test_film_status_transition.py` | **New** | Unit + integration coverage for state machine and cap |
| `api/tests/test_csv_sync_diff.py` | Rewrite | Additive-only diff tests |
| `api/tests/test_integration_csv_sync.py` | Rewrite | Additive behavior; remove archive/watched-on-absence tests |
| `api/tests/test_integration_watchlist_add.py` | Update | Remove/update tests asserting CSV removes manual adds |
| `api/tests/test_watched_excluded_from_candidates.py` | Extend | Manual `POST /films/{id}/status` path |
| `documents/api-contracts.md` | Update | §4.1 `removed_at`, new §4.x status endpoint; §6.1 additive CSV |
| `frontend/src/types/api.ts` | Extend | `removed_at`, `FilmStatus`, `SetFilmStatusRequest`, slim `SyncCsvResponse` |
| `frontend/src/lib/api-client.ts` | Extend | `setFilmStatus(filmId, status)` |
| `frontend/src/hooks/use-films.ts` | Extend | `useFilmStatusTransition` mutation + query invalidation |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Refactor | Tabs, tab-aware queries, count badges, empty states |
| `frontend/src/components/watchlist-table.tsx` | Extend | Status action column, conditional date header (`Added` vs `Removed`), tab-aware row links |
| `frontend/src/components/film-status-actions.tsx` | **New** | Shared row/detail action buttons + archive confirm dialog |
| `frontend/src/components/film-detail-view.tsx` | Extend | Status actions; back link `?tab=` from film status |
| `frontend/src/app/watchlist/[filmId]/page.tsx` | Extend | Pass `tab` search param to detail view |
| `frontend/src/app/settings/sync/page.tsx` | Update | Additive-only copy and result display |
| `frontend/src/components/watchlist-table.test.tsx` | Extend | Date column label, action wiring |
| `frontend/src/app/watchlist/watchlist-page-content.test.tsx` | **New** | Tab query param → API params mapping |

## Implementation steps

### Phase A — API: film status transitions

**Commit 1: Status service + schema + route**

1. Add `FilmStatusRequest` schema: `{ "status": "active" | "watched" | "archived" }`.
2. Create `FilmStatusService.transition(db, film_id, target_status) -> Film`:
   - Load film; `404` if missing.
   - Validate target via `_parse_film_status` pattern (invalid → `422` via `unprocessable()`).
   - **Idempotent:** if `film.status == target`, return film unchanged (`200`).
   - **Forbidden:** `watched → archived` or `archived → watched` → `409` via `conflict()`.
   - **Allowed transitions** (reuse existing repository helpers):

     | From | To | Side effects |
     |------|-----|--------------|
     | `active` | `watched` | `get_active_by_film_id` → `deactivate_entry` if present; `mark_watched` |
     | `active` | `archived` | same deactivate; `archive_film` |
     | `watched` | `active` | cap check (below); `restore_active`; `ensure_active_entry` |
     | `archived` | `active` | cap check; `restore_active`; `ensure_active_entry` |

   - **Cap on restore:** before `active` restore, if `count_active(db) >= MAX_ACTIVE_WATCHLIST` (500) → `409 conflict("Active watchlist limit reached")`. Do **not** use `watchlist_size_exceeded()` (that returns 400 and is CSV-specific).
   - `db.commit()` in router or service (match `WatchlistAddService` / rematch patterns).
3. Add `POST /films/{film_id}/status` in `films.py`; return `FilmDetail` via `film_to_detail`.
4. Document endpoint in `documents/api-contracts.md` §4 (new subsection after list/detail).

**Commit 2: `removed_at` in list responses**

1. Add `watchlist_repository.get_latest_removed_at(db, film_id) -> datetime | None` — query inactive entries for film ordered by `removed_at DESC`, limit 1.
2. Add optional `removed_at: datetime | None = None` to `FilmSummary`.
3. Extend `film_to_summary(film, *, removed_at=None)` — set `removed_at` only when `film.status` is `watched` or `archived`.
4. In `list_films` router: when `status` is `watched` or `archived`, batch-fetch `removed_at` per film (N+1 acceptable at page size ≤100; optimize with single query if straightforward).
5. Update `documents/api-contracts.md` §4.1 response fields.

### Phase B — API: additive-only CSV sync

**Commit 3: Refactor sync service**

1. Replace `CsvDiffResult` fields — keep `added`, `unchanged`; remove `removed`, `watched`.
2. Rewrite `csv_diff`:
   - For each parsed CSV row URI: `get_by_letterboxd_uri` → if `None`, append to `added`; else increment `unchanged` (any status, including `failed` enrichment — **no retry** per spec).
   - Remove loops over `list_active_entries` for removals, RSS watched ledger checks, manual-add skip, and projected-active cap pre-check (cap only matters when adding new active entries).
3. Simplify `apply_csv_diff`:
   - Keep **only** the `diff.added` path for **new** URIs (`existing is None` branch in current code).
   - Remove restore/retry branch for existing URIs (those are now `unchanged` in diff, never in `added`).
   - Remove `diff.removed` and `diff.watched` loops entirely.
4. Pre-check cap: `count_active + len(diff.added) <= 500` before apply; raise `watchlist_size_exceeded` if exceeded.
5. Update `SyncApplyResult` and `SyncCsvResponse` — drop `removed`, `watched`, `removed_films`, `watched_films`.
6. Update `sync.py` router mapping.
7. Update `documents/api-contracts.md` §6.1 (additive supplemental import wording; note breaking response change).

### Phase C — Frontend: tabbed watchlist + status actions

**Commit 4: API client + hooks**

1. Add `setFilmStatus` to `api-client.ts`.
2. Add `useFilmStatusTransition` in `use-films.ts` — on success invalidate `["films"]` and `["films", filmId]`.
3. Extend `FilmSummary` / `FilmDetail` types with `removed_at?: string | null`.

**Commit 5: Watchlist tabs and table**

1. In `watchlist-page-content.tsx`:
   - Parse `tab` from URL: `active` (default) | `watched` | `archived`.
   - Wrap content in `Tabs` (`TabsList` / `TabsTrigger` / `TabsContent`) per `frontend/src/components/ui/tabs.tsx`.
   - Tab → query mapping:
     - `active`: `on_watchlist: true` (preserve all existing filters)
     - `watched`: `status: "watched"`
     - `archived`: `status: "archived"`
   - Parallel count queries: three `useFilms({ limit: 1, ...tabFilter })` calls; show `pagination.total` in tab badges.
   - Tab change: `updateParams({ tab, offset: null })` — reset pagination on tab switch.
   - Tab-specific empty states (copy per spec terminology).
   - Pass `tab` and status handlers into `WatchlistTable`.
2. Extend `WatchlistTable`:
   - Props: `tab`, `onMarkWatched`, `onArchive`, `onRestore` (or single `onStatusAction`).
   - Date column: `Added` + `created_at` on active tab; `Removed` + `removed_at` on watched/archived.
   - Row links: `/watchlist/{id}?tab={tab}`.
   - Actions column with icon buttons (lucide-react: `Eye`, `Archive`, `RotateCcw` or similar).
3. Add `film-status-actions.tsx`:
   - Archive uses `Dialog` (`frontend/src/components/ui/dialog.tsx`) for confirmation copy.
   - Disable/hide forbidden actions per tab (no cross-tab illegal transitions in UI).

**Commit 6: Film detail + sync settings**

1. `film-detail-view.tsx`:
   - Accept optional `watchlistTab` prop for back link `href={/watchlist?tab=${tab}}`.
   - Render `FilmStatusActions` in header actions area (same rules as table).
   - Keep Edit match / rematch visible on all tabs.
2. `watchlist/[filmId]/page.tsx`: read `tab` from `searchParams`, pass to `FilmDetailView`; default back tab from `film.status` mapping (`active`→`active`, `watched`→`watched`, `archived`→`archived`).
3. `settings/sync/page.tsx`:
   - Update description: supplemental import, no removals/reclassifications.
   - Results panel: show `added`, `unchanged`, `failed` only.

### Phase D — Tests and docs

**Commit 7: API tests**

**Commit 8: Frontend tests**

## Tests required

| Acceptance criterion | Test location | Type |
|---------------------|---------------|------|
| `POST /films/{id}/status` allowed transitions | `test_film_status_transition.py` | Integration |
| Forbidden `watched↔archived` → 409 | `test_film_status_transition.py` | Integration |
| Idempotent same→same → 200 | `test_film_status_transition.py` | Integration |
| Restore cap → 409 | `test_film_status_transition.py` | Integration (seed 500 active) |
| Invalid status → 422 | `test_film_status_transition.py` | Integration |
| `GET /films?status=watched\|archived` + `removed_at` | `test_film_status_transition.py` | Integration |
| Additive CSV: new URI added | `test_csv_sync_diff.py`, `test_integration_csv_sync.py` | Unit + integration |
| Additive CSV: existing active/watched/archived unchanged | `test_integration_csv_sync.py` | Integration |
| CSV no longer archives on absence | `test_integration_csv_sync.py` (remove/replace `test_csv_sync_add_and_remove`) | Integration |
| CSV no longer marks watched via RSS ledger on absence | `test_integration_csv_sync.py` (remove/replace `test_csv_sync_watched_via_rss_event`) | Integration |
| CSV no longer re-adds archived | `test_integration_csv_sync.py` (remove/replace `test_csv_sync_re_add_archived`) | Integration |
| Manual add not removed by CSV | `test_integration_watchlist_add.py` | Integration (update) |
| Recommendation excludes after manual transition | `test_watched_excluded_from_candidates.py` | Integration |
| Tab URL → query params | `watchlist-page-content.test.tsx` | Unit |
| Status action wiring | `watchlist-table.test.tsx` or `film-status-actions.test.tsx` | Unit |

## Gate scripts

Run before marking execute complete (minimum per spec):

```bash
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase6-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/test_film_status_transition.py tests/test_csv_sync_diff.py \
    tests/test_integration_csv_sync.py tests/test_watched_excluded_from_candidates.py -v
```

**Host pytest note:** If Docker Compose is up, export `DATABASE_URL`/`TEST_DATABASE_URL` to `@localhost:5433` (compose) or use gate script's ephemeral Postgres on `:5432` per `AGENTS.md`.

**Frontend build note:** Stop compose `frontend` and clear `.next` before host `npm run build` if EACCES occurs.

## Documentation updates

| File | Changes |
|------|---------|
| `documents/api-contracts.md` | New `POST /films/{id}/status`; `FilmSummary.removed_at`; §6.1 additive CSV response |
| `README.md` | Only if user-facing watchlist/sync description exists — optional one-line note on tabbed lists |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| **Breaking CSV sync API** | Document in PR; frontend updated in same PR; no external API consumers expected |
| **Users relied on CSV to prune watchlist** | Sync settings copy explains manual archive + additive import |
| **500-cap on restore blocks legitimate restores** | Clear 409 message; manual `POST /watchlist/films` exemption unchanged |
| **`removed_at` N+1 on large pages** | Batch query in repository if perf issue; page limit 20 default |
| **Tab state lost on film detail navigation** | Persist `?tab=` in detail links and back link |

**Rollback:** Revert branch; no schema migration to unwind.

## Definition of done

- [ ] All acceptance criteria in `SPEC.md` satisfied
- [ ] `POST /films/{id}/status` implemented with state machine, idempotency, 409 forbidden/cap
- [ ] `GET /films` returns `removed_at` for watched/archived lists
- [ ] CSV re-sync is additive-only; destructive diff code removed
- [ ] `/watchlist` has three tabs with URL sync, counts, filters, empty states, status actions
- [ ] Film detail back link and actions respect tab/status
- [ ] Sync settings UI reflects additive-only behavior
- [ ] `documents/api-contracts.md` updated
- [ ] All mapped tests pass
- [ ] Phase 4 + Phase 6 gate scripts pass
- [ ] No production code changes beyond scope in `SPEC.md`
