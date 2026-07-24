## Related Issue

Closes #136

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/136)

## Description

**What does this PR do?**

Adds a shared Home search-picker so **Add a film** and **Mark watched** use one surface: local library search (`active` + `pending_watch_review` + `watched`, excluding `archived`) merged with TMDB by `tmdb_id`, with status-aware actions instead of blind re-add.

Today Add went to a TMDB-only `/watchlist/add` page, and Mark watched only lived on the watchlist table / film detail. This PR extends `GET /films` with a multi-status `statuses` filter and `tmdb_id` on summaries, ships `/search?intent=add|mark-watched`, wires returning Home + watchlist Add links into that picker, and redirects `/watchlist/add` into it.

**Why is this the best approach?**

One API call with an exact multi-status set (not `on_watchlist` alone, which drops watched) plus `tmdb_id` on list summaries lets the client fold TMDB duplicates into local rows. Reusing existing add / status / watch-review APIs and `WatchReviewDialog` avoids a new status machine. Redirecting the legacy add route prevents a dual-UX fork without a mobile Home hub redesign.

## Changes Proposed

* Extended `GET /films` with optional comma-separated `statuses` filter (exact set; cannot combine with singular `status`) and `tmdb_id` on `FilmSummary` via the film presenter
* Updated `documents/api-contracts.md` for `statuses` and list `tmdb_id`
* Added shared `/search` page and `LibrarySearchPicker` — debounced library + TMDB search, merge-by-`tmdb_id`, helper copy, empty/loading/no-results/error states, status-aware actions (View / Mark watched / Complete review / Add to watchlist)
* Wired returning Home with **Add a film** → `/search?intent=add` and **Mark watched** → `/search?intent=mark-watched`; watchlist header Add film → same picker
* Replaced `/watchlist/add` with redirect to `/search?intent=add`
* Added API tests (`test_films_list.py`), unit tests (picker + merge), and mocked Playwright (`library-search-picker.spec.ts`; updated `watchlist-add.spec.ts`)

**Feature commits:** `feat(search): home library+TMDB picker for add and mark watched`; `fix(search): cleanup picker unit tests; update sequence diagram`; `test(e2e): fix home assertions for CardTitle div semantics`

**Explicitly unchanged:** film status machine transitions, Letterboxd sync, migrations, mobile Home hub / DESIGN overhaul, archived search.

## Scenario Results

Application-tier demo on Docker Compose (seeded Part 2 + pending/watched chrome). All five scenarios **PASS**.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Home entry points open shared picker | **PASS** | screenshots below |
| 2 | Local library hit — status-aware actions | **PASS** | screenshots below |
| 3 | TMDB-only hit — Add to watchlist | **PASS** | screenshots below |
| 4 | Empty / no-results / archived excluded | **PASS** | screenshots below |
| 5 | Legacy add URL redirects | **PASS** | screenshot below |

### Scenario 1 — Home entries

![Home — Add a film and Mark watched](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-1-home-entries.png)

![Picker — add intent](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-1-picker-add-intent.png)

![Picker — mark-watched intent](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-1-picker-mark-intent.png)

### Scenario 2 — Local status-aware actions

![Local active — View + Mark watched](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-2-local-active-actions.png)

![Mark watched opens WatchReviewDialog](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-2-mark-watched-dialog.png)

![Pending — Complete review](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-2-pending-or-watched.png)

### Scenario 3 — TMDB add

![TMDB-only — Add to watchlist](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-3-tmdb-add.png)

![After add — film detail Ready](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-3-after-add.png)

### Scenario 4 — Empty / no-results

![Empty query guidance](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-4-empty-query.png)

![No results found](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-4-no-results.png)

### Scenario 5 — Legacy redirect

![/watchlist/add → /search?intent=add](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/daae0ab630842ba74ed6f3b01f099e635242c78b/workflow/issues/issue-136/demo/scenario-5-add-redirect.png)

## How to Test

1. Checkout the branch:
   ```bash
   git checkout cursor/issue-136-home-search-picker-e134
   ```
2. Start the stack (from repo root):
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Open http://localhost:3000/ — returning Home should show **Add a film** and **Mark watched** (not the empty Import CTA).
4. Click **Add a film** → `/search?intent=add`. Click **Mark watched** → `/search?intent=mark-watched`. Confirm helper copy mentions library (including watched) + TMDB and does not claim archived.
5. Search a known local title: expect a Library row with status-aware actions (active → View + Mark watched; pending → Complete review; watched → View). Confirm no blind **Add to watchlist** for that title if TMDB also matches.
6. Search a TMDB-only title → **Add to watchlist** → lands on `/watchlist/{filmId}` after enrichment.
7. Visit http://localhost:3000/watchlist/add → should redirect to `/search?intent=add`.
8. Optional API spot-check:
   ```bash
   curl -sf "http://localhost:3000/api/v1/films?statuses=active,pending_watch_review,watched&search=Ready&limit=20"
   ```
   Expect only those statuses; no `archived` rows.
9. Automated gates (host pytest needs reachable Postgres per AGENTS.md):
   ```bash
   source scripts/cursor-workflow-config.sh
   bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
   ```

## Known Issues / Notes for Reviewer

* No DB migrations — additive API fields only (`tmdb_id`, `statuses`).
* Singular `status=watched` still expands to include pending (existing semantics); multi `statuses` is an exact set — documented in `api-contracts.md`.
* Watch-review cancel rules in the picker copy `cancelOnDismiss` from watchlist/detail (Mark watched → cancel-on-dismiss; Complete review → not).
* Demo seeded `Ready Film 1` → `pending_watch_review` and `Ready Film 2` → `watched` for Scenario 2 chrome; Part 2 seed alone may not show pending/watched badges until those transitions exist.
* Live TMDB was available during demo (Scenario 3 passed with Inception); without a TMDB key, local search still works and TMDB may show a partial-error state.

## Gate evidence

- [x] `Phase 8 gate: verify-phase8-gates.sh exit 0 at 7758349` (execute; mocked Playwright picker specs green)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Demo screenshots reviewed
