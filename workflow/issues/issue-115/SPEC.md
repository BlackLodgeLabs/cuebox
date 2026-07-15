# Issue #115: Tabbed watchlist with Watched/Archived lists and manual status management

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/115

## Summary

Shift Cuebox from Letterboxd-as-authority for watchlist removals to **Cuebox-owned watchlist state**. Deliver three tabbed lists on `/watchlist` (Watchlist / Watched / Archived), manual status actions in the table and film detail views, and **additive-only** CSV re-sync that never removes or reclassifies existing films. RSS diary watched marking continues unchanged.

## Problem

Today:

1. **CSV re-sync is destructive** — `SyncService.csv_diff` archives films missing from a re-uploaded CSV and marks them watched when an RSS ledger entry exists (`api/app/services/sync_service.py`).
2. **Watched and archived films are invisible** — `/watchlist` always queries `GET /films?on_watchlist=true`, which inner-joins active `watchlist_entries`; deactivated films disappear from the UI.
3. **No manual status controls** — status changes only happen via CSV sync, RSS poll, or restoring through `POST /watchlist/films` (Add film).

The long-term direction is for Cuebox to own watchlist state; Letterboxd remains an optional bulk-ingest fallback.

## Acceptance criteria

### Watchlist UI

- [ ] `/watchlist` has three tabs: **Watchlist** (default), **Watched**, **Archived**.
- [ ] Tab selection is reflected in the URL (`?tab=active|watched|archived`) and drives list query params.
- [ ] Each tab shows a count badge sourced from `GET /films` pagination `total` (lightweight `limit=1` query per tab).
- [ ] **Watchlist** tab preserves current behavior: active films with existing filters (search, year, date range, enrichment status, sort, pagination).
- [ ] **Watched** tab lists films with `status=watched` (no `on_watchlist=true`).
- [ ] **Archived** tab lists films with `status=archived` (no `on_watchlist=true`).
- [ ] Empty states per tab with tab-specific copy.
- [ ] Film detail back link returns to `/watchlist?tab={active|watched|archived}` matching the film's current `status`.

### Manual status actions

- [ ] **Watchlist tab** (row + film detail): Mark **watched** (watch icon); Mark **archived** (archive icon, confirm dialog — soft archive, not DB delete).
- [ ] **Watched tab** (row + film detail): **Return to watchlist** (restore to `active`).
- [ ] **Archived tab** (row + film detail): **Re-enable on watchlist** (restore to `active`).
- [ ] Forbidden transitions blocked in UI and API: `watched → archived`, `archived → watched` → HTTP 409.
- [ ] Restore to active fails with clear error when the 500-film active watchlist cap would be exceeded (manual adds remain exempt per existing `add_source=manual` rule).
- [ ] Films marked watched or archived are immediately excluded from recommendation candidates (`list_recommendation_candidates` already requires `status=active`).
- [ ] Edit match / rematch remain available on watched and archived films.

### API

- [ ] New endpoint `POST /films/{id}/status` with body `{ "status": "active" | "watched" | "archived" }`, enforcing the state machine and side effects below.
- [ ] `GET /films?status=watched|archived` used by Watched/Archived tabs.
- [ ] API contract documented in `documents/api-contracts.md`.

### CSV / sync behavior (breaking change)

- [ ] CSV re-upload is **additive only** — never removes or reclassifies existing films.
- [ ] For each CSV row: URI not in DB → create as **active** and enqueue enrichment; URI already exists in any state → **no-op**.
- [ ] Remove `SyncService.csv_diff` remove/watched paths and related `apply_csv_diff` branches.
- [ ] Sync settings UI copy updated to describe supplemental import (no remove/watched counts).
- [ ] Initial import (`POST /import`) semantics unchanged (duplicate skip); align CSV re-upload response shape with additive-only behavior.

### RSS

- [ ] RSS diary poll continues to mark matching DB films as **watched** (any status; not limited to active watchlist entries).
- [ ] RSS watched events deactivate active watchlist entries as today.

### Tests

- [ ] API tests for all allowed and forbidden status transitions and cap enforcement.
- [ ] Integration tests for additive-only CSV re-upload (existing watched/archived/active films untouched; new URIs added).
- [ ] Regression: recommendation candidates exclude watched/archived after manual transition.
- [ ] Frontend unit tests for tab query params and status action wiring.

## Scope

### In scope

- Tabbed `/watchlist` UI using existing `Tabs` component (`frontend/src/components/ui/tabs.tsx`).
- Manual status API (`POST /films/{id}/status`) and UI actions (table rows + `FilmDetailView`).
- Status transition service reusing `film_repository.restore_active`, `mark_watched`, `archive_film` and `watchlist_repository.deactivate_entry` / `ensure_active_entry`.
- Refactor CSV re-sync to additive-only import (mirror `ImportService` duplicate-skip by URI, not enrichment-status retry semantics).
- Update sync settings copy and `documents/api-contracts.md`.
- Tests listed above.

### Out of scope

- Bulk mark watched/archived.
- New DB columns (`watched_at`, `archived_at`) — use `watchlist_entries.removed_at` for display on Watched/Archived tabs.
- RSS watchlist add/remove feed wiring (diary/watched only today).
- Letterboxd write-back.
- Changing recommendation history semantics (`winner_watch_status` remains a snapshot).
- Full removal of Letterboxd dependency (future goal).

## User flows / API changes

### Status state machine

```
active ←→ watched   (manual or RSS; restore from Watched tab)
active ←→ archived  (manual; restore from Archived tab)
watched ↮ archived  (forbidden → 409)
```

### Tab → query mapping

| Tab | URL param | List query | Row / detail actions |
|-----|-----------|------------|----------------------|
| Watchlist | `tab=active` (default) | `on_watchlist=true` | Mark watched, Archive |
| Watched | `tab=watched` | `status=watched` | Return to watchlist |
| Archived | `tab=archived` | `status=archived` | Re-enable on watchlist |

Tab counts: parallel `GET /films` calls with `limit=1` and the tab's filter; display `pagination.total` in tab labels.

### Column labels

| Tab | Date column header | Source field |
|-----|-------------------|--------------|
| Watchlist | Added | `films.created_at` (unchanged) |
| Watched | Removed | `watchlist_entries.removed_at` (most recent deactivated entry) |
| Archived | Removed | `watchlist_entries.removed_at` |

Expose `removed_at` in list responses when `status` is `watched` or `archived` (join latest inactive entry or extend `FilmSummary`).

### `POST /films/{id}/status`

**Request**

```json
{ "status": "active" | "watched" | "archived" }
```

**Allowed transitions and side effects**

| From | To | Side effects |
|------|-----|--------------|
| `active` | `watched` | `deactivate_entry`, `mark_watched`, set `removed_at` |
| `active` | `archived` | `deactivate_entry`, `archive_film`, set `removed_at` |
| `watched` | `active` | `restore_active`, `ensure_active_entry`; enforce 500 cap |
| `archived` | `active` | `restore_active`, `ensure_active_entry`; enforce 500 cap |
| `watched` | `archived` | **409** — forbidden |
| `archived` | `watched` | **409** — forbidden |
| same → same | | **200** idempotent (no-op) |

**Responses**

- `200` — success with updated `FilmDetail` (or summary).
- `404` — film not found.
- `409` — forbidden transition or active watchlist cap exceeded on restore.
- `422` — invalid status value.

**Note:** Manual restore via this endpoint is subject to the 500 cap. `POST /watchlist/films` manual add exemption (`add_source=manual`) is unchanged.

### CSV re-sync (breaking)

Replace diff/remove/watched with additive import:

1. Parse CSV rows.
2. For each URI: if not in DB → create film + active entry + enqueue enrichment; if exists (any status) → skip (count as `unchanged` or `duplicate`).
3. Response shape: drop `removed`, `watched`, `removed_films`, `watched_films`; retain `added`, `unchanged`, `failed` (and film lists for added).

Update `frontend/src/types/api.ts` `SyncCsvResponse` and sync settings results UI accordingly.

### Frontend touchpoints

| File | Change |
|------|--------|
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Tabs, tab-aware query params, count badges |
| `frontend/src/components/watchlist-table.tsx` | Status action column; conditional date column label |
| `frontend/src/components/film-detail-view.tsx` | Status actions; back link with `?tab=` |
| `frontend/src/hooks/use-films.ts` | `useFilmStatusTransition` mutation; invalidate film queries on success |
| `frontend/src/lib/api-client.ts` | `setFilmStatus(filmId, status)` |
| `frontend/src/app/settings/sync/page.tsx` | Copy + result fields for additive-only sync |

### Terminology (UI copy)

- **Archive** / **Remove from watchlist** — not "Delete".
- **Mark watched** / **Return to watchlist** for watched transitions.
- Archive action requires confirmation dialog explaining the film moves to Archived and can be restored.

## Data and integration notes

### Existing primitives (reuse, do not reinvent)

- **Enums:** `FilmStatus.ACTIVE | WATCHED | ARCHIVED` (`api/app/database/enums.py`).
- **Film mutators:** `archive_film`, `mark_watched`, `restore_active` (`api/app/repositories/film_repository.py`).
- **Watchlist entry helpers:** `deactivate_entry`, `ensure_active_entry` (`api/app/repositories/watchlist_repository.py`).
- **Restore via add:** `WatchlistAddService.add_film` already restores watched/archived — tab restore actions should share the same repository helpers, not duplicate logic.
- **Recommendations:** `list_recommendation_candidates` filters `status=active` — no engine change needed; add regression test for manual transition.
- **Home page:** `useWatchlistCount` (`on_watchlist=true`) remains correct for active tab count.

### CSV sync refactor

Current `csv_diff` paths to remove:

- **Removed from CSV** → archive (skip manual `add_source`).
- **Removed + RSS watched ledger** → mark watched.
- **Re-add archived/watched from CSV** → restore active.

New behavior: only **added** (new URI) path remains. Existing `ImportService.create_import` duplicate-skip (by URI, regardless of status) is the reference semantics — note import also retries `FAILED` enrichment; CSV re-sync should **not** retry failed films unless explicitly scoped (match issue: no-op for existing URIs).

### RSS (unchanged)

- `SyncService._apply_watched` via `find_for_rss_watched` applies to any matched DB film.
- Deactivates active entry when present.
- No changes to `WATCHLIST_ADD` / `WATCHLIST_REMOVE` handlers in this issue.

### Tests to add / update

| Area | File(s) |
|------|---------|
| Status transitions | New `api/tests/test_film_status_transition.py` |
| Cap on restore | Extend status transition tests |
| Additive CSV | Update `api/tests/test_csv_sync_diff.py`, `api/tests/test_integration_csv_sync.py` |
| Manual add preserved | Update `api/tests/test_integration_watchlist_add.py` (CSV no longer removes manual adds — remove path deleted) |
| Recommendation regression | Extend `api/tests/test_watched_excluded_from_candidates.py` for manual API path |
| Frontend tabs | New/extended tests in `frontend/src/app/watchlist/` or hook tests |

### Gate scripts

Run at minimum before PR:

- `bash scripts/verify-phase4-gates.sh` (CSV/sync regression)
- `bash scripts/verify-phase6-gates.sh` (frontend tsc/build)
- `cd api && pytest tests/test_csv_sync_diff.py tests/test_integration_csv_sync.py tests/test_watched_excluded_from_candidates.py -v`

## Open questions

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/115
- Current watchlist page: `frontend/src/app/watchlist/watchlist-page-content.tsx`
- Current sync diff: `api/app/services/sync_service.py` (`csv_diff`, `apply_csv_diff`)
- API contracts: `documents/api-contracts.md` §4.1 (films list), §6.1 (CSV sync)
- Design system: `documents/DESIGN.md`
