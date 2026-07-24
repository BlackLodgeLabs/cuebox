# Implementation plan — Issue #136

**Tier:** application  
**Issue type:** feature (new Home search-picker; not a bug in shipped behavior)

Home search-picker: one shared surface for **Add a film** and **Mark watched**, searching local library (`active` + `pending_watch_review` + `watched`, excluding `archived`) and TMDB, with status-aware actions and `tmdb_id` reconciliation.

## Overview

Today Home’s **Add a film** CTA goes to `/watchlist/add` (`AddFilmSearch` — TMDB-only). Mark watched lives on the watchlist table / film detail. There is no combined library+TMDB picker and no Home entry for mark-watched.

Execute will:

1. **Extend `GET /films`** so one call can return the picker library set and expose **`tmdb_id` on `FilmSummary`** (metadata is already `selectinload`ed) for TMDB reconciliation.
2. **Ship a shared picker page** (`/search`) with debounced combined search, helper copy, empty/loading/empty-results/error states, and status-aware actions that reuse existing add / status / watch-review APIs and `WatchReviewDialog`.
3. **Wire Home** with interim **Add a film** and **Mark watched** entries (query-param intent emphasis); **redirect `/watchlist/add` → `/search?intent=add`** so add UX does not fork.
4. **Document** search scope and navigation after success; cover with API + frontend unit + Playwright tests.

No new film status machine, no migrations, no Letterboxd sync changes, no mobile Home hub redesign.

## Reproduction findings

N/A — feature, not an application bug. Gaps confirmed by code inventory (see Files / Implementation steps).

## Root cause

N/A (feature). Current limitations that block the product goal:

| Gap | Evidence |
|-----|----------|
| TMDB-only add UI | `AddFilmSearch` + `/watchlist/add` |
| No Home mark-watched entry | `frontend/src/app/page.tsx` returning CTAs |
| `on_watchlist=true` excludes watched | watchlist entry deactivated on mark-watched |
| Single `status` cannot request active+pending+watched without archived | `film_repository.list_films` |
| `FilmSummary` has no `tmdb_id` | `film_schemas.FilmSummary` / `film_to_summary` |

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/app/schemas/film_schemas.py` | Add optional `tmdb_id` to `FilmSummary` | Client merge by `tmdb_id` |
| `api/app/services/film_presenter.py` | Populate `tmdb_id` from `film.metadata_` | Presenter already reads metadata |
| `api/app/repositories/film_repository.py` | Support multi-status filter (`statuses`) | One library-search call; exclude archived |
| `api/app/routers/v1/films.py` | Accept `statuses` query; attach `pending_watch` whenever pending rows are present | Picker needs Complete-review prefill |
| `api/tests/test_films_list.py` | Tests for `statuses` + `tmdb_id` on list + archived exclusion | API acceptance |
| `documents/api-contracts.md` | Document `statuses`, `tmdb_id` on list items | Contract parity |
| `frontend/src/types/api.ts` | `tmdb_id` on `FilmSummary`; `statuses` on `FilmsQueryParams` | Types |
| `frontend/src/lib/api-client.ts` | Pass `statuses` in `getFilms` query string | Client |
| `frontend/src/hooks/use-films.ts` | Hook(s) for library search (+ reuse `useGlobalTmdbSearch`, add/status/review hooks) | Data layer |
| `frontend/src/components/library-search-picker.tsx` | **New** shared picker UI | Combined results + actions |
| `frontend/src/components/library-search-picker.test.tsx` | **New** unit tests | Merge + action chrome |
| `frontend/src/app/search/page.tsx` | **New** picker route (`?intent=add\|mark-watched`) | Shared surface |
| `frontend/src/app/page.tsx` | Home CTAs → `/search?intent=…` (Add + Mark watched) | Spec entry points |
| `frontend/src/app/watchlist/add/page.tsx` | Redirect to `/search?intent=add` (or thin wrapper) | Avoid dual add UIs |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Point “Add film” to `/search?intent=add` | Consistency |
| `frontend/e2e/watchlist-add.spec.ts` and/or **new** `frontend/e2e/library-search-picker.spec.ts` | Home entries + merge/actions (mocked API) | E2E acceptance |
| `frontend/src/components/add-film-search.tsx` | Leave in place or slim to TMDB-only helper if picker reuses pieces | Prefer compose/extract over delete unless unused |
| `README.md` or short UX note in `documents/` if needed | Search scope copy for operators | Only if user-facing docs mention add flow |

**Explicitly unchanged:** film status service transitions, watch-review APIs, Letterboxd sync, mobile hub / DESIGN overhaul, archived search.

## Implementation steps

### Step 1 — API: `tmdb_id` on list summaries

1. Add `tmdb_id: int | None = None` to `FilmSummary`.
2. In `film_to_summary`, set from `metadata.tmdb_id` when metadata exists.
3. Update frontend `FilmSummary` type.
4. Test: list response includes `tmdb_id` for seeded film with metadata.

### Step 2 — API: multi-status `statuses` filter

1. Add optional query param `statuses` (comma-separated `FilmStatus` values) to `GET /films`.
2. **Validation:** invalid token → `VALIDATION_ERROR`; cannot combine with singular `status` (400).
3. Repository: when `statuses` provided, `Film.status.in_(parsed_list)` — **no** special expansion of `watched`→pending (caller lists both explicitly for the picker).
4. When `statuses` includes `pending_watch_review` (or any returned row is pending), batch-load `pending_watch` the same way the watched-tab path does today (extend router condition beyond `status in (watched, archived)`).
5. Picker call shape:
   ```http
   GET /films?statuses=active,pending_watch_review,watched&search={q}&limit=20&sort=title&sort_dir=asc
   ```
6. Tests: three-status set returns active+pending+watched; archived excluded; empty `statuses` rejected or treated as unset; coexistence with `search`.

**Rejected alternatives:** relying on `on_watchlist=true` alone; unfiltered `search` (includes archived); client-only dual `status=active` + `status=watched` without `tmdb_id` (works for local merge but weak TMDB fold-in).

### Step 3 — Shared picker page + component

1. Route: **`/search`** with optional `intent=add|mark-watched` (placeholder / default section emphasis only; same result set).
2. Component `LibrarySearchPicker`:
   - Debounce ~300ms (match `AddFilmSearch`).
   - Helper text: searches your library (including watched) and TMDB; archived not listed.
   - Parallel: `getFilms({ statuses: [...], search })` + `useGlobalTmdbSearch`.
   - Merge: index local by `tmdb_id`; drop TMDB hits whose id matches a local film; show local rows first (or grouped: Library / TMDB) with status badge.
   - States: idle (empty query), loading, results, no results, partial error (local OK / TMDB fail and vice versa — message, not blank dead end).
3. **Actions (status-aware):**

   | Hit | Actions |
   |-----|---------|
   | Local `active` | **View** → `/watchlist/{id}`; **Mark watched** → `POST /films/{id}/status` `{status: pending_watch_review}` then `WatchReviewDialog` with `cancelOnDismiss` (same as watchlist/detail) |
   | Local `pending_watch_review` | **View**; **Complete review** → dialog with `pending_watch`, `cancelOnDismiss: false` |
   | Local `watched` | **View** only (optional **Return to watchlist** via existing `active` transition — include if cheap reuse of `FilmStatusActions` pattern; not required) |
   | TMDB-only | **Add to watchlist** → `useAddToWatchlist` + existing conflict/restore messaging patterns from add page |

4. **Post-success navigation (document in UI + demo):**
   - Add → `/watchlist/{filmId}` (match today’s add page; poll enriching if needed).
   - Mark watched / complete review → remain on picker with success toast **or** navigate Home; prefer **Home** after successful complete-review for Mark-watched intent, film detail after View.
   - Conflict already-on-watchlist → show View link (existing messages).

### Step 4 — Home + add-route wiring

1. Returning Home (`page.tsx`):
   - Retarget **Add a film** → `/search?intent=add` (update card copy to mention library + TMDB if space allows; keep Neo-Noir card pattern — no hub redesign).
   - Add interim **Mark watched** card/button → `/search?intent=mark-watched`.
2. Watchlist header **Add film** → `/search?intent=add`.
3. `/watchlist/add`: `redirect('/search?intent=add')` (Next.js) so bookmarks/E2E old path still land on picker; update E2E accordingly.

### Step 5 — Tests + docs

1. API tests in `test_films_list.py` (and contracts doc).
2. Unit: picker merge (local folds TMDB duplicate; archived never requested; action buttons by status); optional small hook test for `statuses` query encoding.
3. Playwright (mocked): Home shows both entries; search shows local+TMDB; active hit Mark watched opens dialog path; TMDB-only Add works; archived not in local fixture response.
4. Keep `AddFilmSearch` tests if component remains used; otherwise migrate assertions to picker tests.

### Step 6 — Gates

Run targeted checks during execute, then formal gate (see Gate script).

## Tests required

| Acceptance criterion | Test |
|----------------------|------|
| Home opens picker for Add + Mark watched | Playwright: Home links → `/search?intent=…` |
| Same picker both intents | Unit/E2E: intent only changes copy/emphasis |
| Local+TMDB search; copy states scope | Unit: helper text; E2E visible copy |
| Archived excluded | API: `statuses=…` omits archived; unit never requests archived |
| Merge by `tmdb_id` — no blind Add | Unit: local+TMDB same id → one local row with View/Mark, no Add |
| Status-aware actions | Unit: button matrix by status; E2E mark-watched → status POST mock |
| TMDB-only Add | E2E/unit: `POST /watchlist/films` |
| Empty / loading / no-results / errors | Unit states |
| Sensible navigation after success | E2E: add → detail URL; optional mark-watched complete → Home |
| API extension | `test_films_list.py`: `tmdb_id`, `statuses`, validation |

## Gate script

```bash
source scripts/cursor-workflow-config.sh
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

During execute, iterate with narrower loops first:

- `cd api && ruff check app tests` + `pytest tests/test_films_list.py -v` (with host `DATABASE_URL`/`TEST_DATABASE_URL` per AGENTS.md)
- `cd frontend && npx tsc --noEmit && npm run test:unit` (picker + related)
- Playwright mocked picker / updated `watchlist-add` specs

Host frontend build: stop compose frontend and clear `frontend/.next` before `npm run build` if Gate 7 hits `EACCES`.

## Documentation updates

- `documents/api-contracts.md` — `GET /films` `statuses` param; `tmdb_id` on list Film object
- No DESIGN.md redesign; preserve Modern Neo-Noir tokens on new page
- README only if it documents `/watchlist/add` as the sole add path

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| `statuses` + existing `status=watched` semantics confuse clients | Document: singular `status=watched` still expands to pending; multi `statuses` is exact set |
| List payload growth (`tmdb_id`) | Optional nullable field; backward compatible |
| Dual add UIs if redirect skipped | Make `/watchlist/add` redirect mandatory in DoD |
| Watch-review cancel rules wrong in picker | Copy `cancelOnDismiss` / dialog wiring from `WatchlistPageContent` / detail page exactly |
| TMDB key missing in demo | Mock TMDB in E2E; live demo may show TMDB error state (acceptable if local still works) |

**Rollback:** revert picker route + Home links; restore `/watchlist/add` page; keep or revert additive `tmdb_id`/`statuses` (additive API is low risk to leave).

## Definition of done

- [ ] `GET /films` supports `statuses=active,pending_watch_review,watched` and returns `tmdb_id` on summaries; archived not included
- [ ] `/search` picker merges local + TMDB by `tmdb_id` with status-aware actions (no new status machine)
- [ ] Home returning user has **Add a film** and **Mark watched** → picker; `/watchlist/add` redirects into picker
- [ ] Empty/loading/no-results/error states handled; scope helper text present
- [ ] Post-add / post-review navigation matches plan
- [ ] Automated tests map to acceptance criteria above
- [ ] `documents/api-contracts.md` updated
- [ ] `bash $APP_DEFAULT_GATE` passes
- [ ] No production code outside this plan’s scope (no hub redesign / sync / status-machine expansion)

## PR seed

**Tier:** application  
**What / why:** Shared Home search-picker so Add and Mark watched find titles in library (incl. watched) and TMDB without blind re-add.  
**Key changes:** `GET /films` `statuses` + `tmdb_id` on summaries; `/search` picker with status-aware actions; Home CTAs; `/watchlist/add` redirect.  
**Gate:** Application default: `verify-phase8-gates.sh` exit 0 at \<short-sha\>  
**How to test:** Returning Home → Add / Mark watched → search a known local title and a TMDB-only title; confirm actions and no archived hits.
