# Demo notes — issue #136

- **Date:** 2026-07-24T12:58:00Z
- **Commit:** 889f07c (`889f07c436530e711be9bda8170a5bdcbebcdcc4`)
- **Branch:** `cursor/issue-136-home-search-picker-e134`
- **PR:** #138
- **Tier:** `application`
- **Stack:** Docker Compose Up (`postgres`, `api`, `frontend`, `backup`); health `status=ok` / `database=ok` on API and frontend proxy
- **Seed:** Part 2 via `scripts/seed-dev-db.py` (10 Ready Film * + prior Tier-3 Matrix/Ambiguous). Also seeded `Ready Film 1` → `pending_watch_review`, `Ready Film 2` → `watched` for Scenario 2 chrome.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Home entry points open shared picker | **PASS** | [scenario-1-home-entries.png](scenario-1-home-entries.png), [scenario-1-picker-add-intent.png](scenario-1-picker-add-intent.png), [scenario-1-picker-mark-intent.png](scenario-1-picker-mark-intent.png) |
| 2 | Local library hit — status-aware actions | **PASS** | [scenario-2-local-active-actions.png](scenario-2-local-active-actions.png), [scenario-2-mark-watched-dialog.png](scenario-2-mark-watched-dialog.png), [scenario-2-pending-or-watched.png](scenario-2-pending-or-watched.png) |
| 3 | TMDB-only hit — Add to watchlist | **PASS** | [scenario-3-tmdb-add.png](scenario-3-tmdb-add.png), [scenario-3-after-add.png](scenario-3-after-add.png) |
| 4 | Empty / no-results / archived excluded | **PASS** | [scenario-4-empty-query.png](scenario-4-empty-query.png), [scenario-4-no-results.png](scenario-4-no-results.png) |
| 5 | Legacy add URL redirects | **PASS** | [scenario-5-add-redirect.png](scenario-5-add-redirect.png) |

## Scenario detail

### 1 — Home entries
Returning Home shows **Add a film** and **Mark watched** (not empty Import CTA). Both open `/search` with `intent=add` / `intent=mark-watched`. Helper copy: library (including watched) + TMDB; archived not listed.

### 2 — Local status-aware actions
Search **Ready Film 0** (active): Library row with On watchlist badge, **View** + **Mark watched** (no Add). **Mark watched** opens `WatchReviewDialog` (score / date / notes) — existing review path, not a bypass to `watched`. **Ready Film 1** (pending): **Complete review**. (Watched chrome for Ready Film 2 verified in seed; pending capture used for optional screenshot.)

### 3 — TMDB add
Live TMDB search for **Inception** → TMDB-only **Add to watchlist**. Enrichment completed; navigated to film detail with Ready status. No TMDB skip.

### 4 — Empty / no-results / archived
Empty query: idle guidance (“Type a title…”). Nonsense query: “No results found.” API spot-check: `GET /films?statuses=active,pending_watch_review,watched&search=Ready` returned only those statuses (no `archived`); archived total was 0 in this seed.

### 5 — Legacy redirect
`/watchlist/add` lands on `/search?intent=add` (shared picker), not a divergent TMDB-only page.

## Notes

- GitHub MCP `serverStatus: ready` during demo.
- No secrets in screenshots or notes.
- No Scenario 0 / bug-repro artifacts (feature demo).
