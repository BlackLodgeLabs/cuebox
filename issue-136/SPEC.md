# Issue #136: Home search-picker (TMDB + watchlist → Add or Mark watched)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/136

## Summary

Ship a **shared search/picker** that returning users open from Home (or an interim Home entry until the mobile Home hub ships). One query searches **local library** (`active` + `pending_watch_review` + `watched`, **excluding `archived`**) and **TMDB**. Results are reconciled so a local film is never offered as a blind “add again.” Actions are **status-aware** and reuse today’s add-film, film-detail, and watch-review flows—**no new status machine**.

This is the functional prerequisite for the mobile UI pass Home quick links (brief §5 P1 / PR #134); that pass styles placement and should not invent this behavior.

## Problem

Today, **Add a film** (`/watchlist/add` + `AddFilmSearch`) is TMDB-only. **Mark watched** lives on the watchlist table / film detail and requires finding the title first. On a phone, those are separate hunts. Users need one picker that finds a title whether it is already in Cuebox (including watched) or only on TMDB, then offers the right next step.

## Decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | What does **Mark watched** mean on non-`active` local hits? | **A — Status-aware actions.** View always. **Mark watched** only when `active` (existing `active → pending_watch_review` + `WatchReviewDialog`). For `pending_watch_review`, offer **Complete review**. For `watched`, **View** only (optional existing restore such as **Return to watchlist** is allowed but not required). No lifecycle expansion. |
| 2 | Local search include archived? | **Exclude `archived`.** Local results = `active` + `pending_watch_review` + `watched` only. |

## Acceptance criteria

- [ ] From Home (returning-user home), user can open a **search/picker** via entry points for both intents: **Add a film** and **Mark watched** (interim Home links/buttons are acceptable until the Home hub UI pass)
- [ ] Same picker serves both intents; optional query-param or emphasis for initial mode is fine
- [ ] Query searches **TMDB** and **local library** covering `active`, `pending_watch_review`, and `watched`; UI copy makes that scope obvious (includes already watched; does not claim archived)
- [ ] **Archived** films do **not** appear in local picker results
- [ ] TMDB and local results are **merged/reconciled** (match primarily by `tmdb_id`) so a local film is not offered as a blind **Add to watchlist**
- [ ] **Local hit actions (status-aware):**
  - Always: **View** → `/watchlist/{filmId}` (existing single-record page)
  - `active`: **Mark watched** → existing pending watch-review path (`WatchReviewDialog` / status transition), not a bypass
  - `pending_watch_review`: **Complete review** → existing incomplete watch-review flow
  - `watched`: **View** only (optional **Return to watchlist** via existing `watched → active` transition if included)
- [ ] **TMDB-only hit:** primary action **Add to watchlist** (reuse existing `POST /watchlist/films` / add-film capability and conflict handling)
- [ ] Empty query, loading, no-results, and API-error states are handled (local and/or TMDB failures communicated without a blank dead end)
- [ ] After successful add or mark-watched / review completion, navigation lands somewhere sensible (Home, film detail, or continuing watch-review—document in plan)
- [ ] Covered by automated tests (frontend unit and/or Playwright; API tests if a new/extended search endpoint is added)

## Scope

### In scope

- Shared picker UI (new page and/or modal/sheet) with combined local + TMDB search
- Status-aware action chrome on results (as above)
- Wiring to existing:
  - `AddFilmSearch` patterns / `POST /watchlist/films`
  - Film detail route
  - `WatchReviewDialog` + `FilmStatusActions` / `PUT …/status` + watch-review APIs
- Interim Home entry points for **Add a film** and **Mark watched** that open the picker (may replace or wrap today’s “Add film to watchlist” card)
- API support **if** client-side merge is insufficient—e.g. multi-status local search, or a combined search endpoint. Today `GET /films?on_watchlist=true` **excludes** watched films (watchlist entry deactivated on mark-watched); planners must account for that
- Docs/copy clarifying search scope (library including watched, excluding archived)

### Out of scope

- Mobile bottom-tab shell / Home hub visual redesign (UI pass)
- Recommendation ceremony, poster-grid watchlist, Neo-Noir reskin
- Insights / Ask, PWA
- Changing Letterboxd sync semantics
- New film status machine (no `watched → pending_watch_review`, no re-watch diary product)
- Searching or acting on **archived** films from this picker (use existing Archived tab / detail)

## User flows / API changes

### Entry

1. Returning user on Home chooses **Add a film** or **Mark watched**.
2. Shared picker opens (same surface; optional emphasis from intent, e.g. placeholder or default section focus).

### Search

1. User types a query (debounce similar to today’s TMDB search ~300ms).
2. UI states: idle/empty, loading, results, no results, error.
3. Helper text clarifies: searches your library (including watched) and TMDB; archived titles are not listed here.

### Results merge

1. **Local library hits** (statuses `active` | `pending_watch_review` | `watched`) shown with status badge/label and status-aware actions.
2. **TMDB hits** whose `tmdb_id` already maps to a local library film are folded into the local hit (no separate Add).
3. Remaining TMDB-only hits show **Add to watchlist**.

### Actions

| Hit type | Actions |
|----------|---------|
| Local `active` | **View**, **Mark watched** |
| Local `pending_watch_review` | **View**, **Complete review** |
| Local `watched` | **View** (optional **Return to watchlist**) |
| TMDB-only | **Add to watchlist** |

**Mark watched** and **Complete review** must use the same dialogs/APIs as film detail / watchlist today (including cancel/revert rules for manual mark-watched).

### Suggested implementation notes (non-binding for plan)

- **Local data:** Prefer extending list/search so one call can return `active` + `pending_watch_review` + `watched` without `archived`, **or** merge two existing calls (`status=active` + `status=watched`, noting `status=watched` already includes `pending_watch_review` in `film_repository.list_films`). Do **not** rely on `on_watchlist=true` alone for “including watched.”
- **TMDB:** Reuse `GET /films/tmdb-search` and `useGlobalTmdbSearch`.
- **UI:** Extend or compose beyond `AddFilmSearch` rather than overloading add-only page without clear dual-intent UX; keep Modern Neo-Noir tokens (`documents/DESIGN.md`)—no mobile shell redesign.
- **Home:** Wire both intents to the picker; keep `/watchlist/add` working or redirect to the shared picker to avoid two divergent add UIs long-term (plan may choose redirect vs thin wrapper).

## Data and integration notes

- **TMDB:** Existing search client/API; requires `TMDB_API_KEY` for live search (tests mock as today).
- **Local films:** Title/year/status via `GET /films` (possibly extended) or a dedicated library-search endpoint. Must include watched films whose watchlist entries are inactive.
- **Reuse:** Film detail navigation; `pending_watch_review` / `WatchReviewDialog`; `POST /watchlist/films` add + conflict messages (`AlreadyOnWatchlistMessage`, etc.).
- **DB / migrations:** None expected beyond existing film/watch/watchlist tables.
- **Sync:** No Letterboxd sync behavior changes.

## Open questions

_(none — blocking questions answered 2026-07-24: 1A status-aware actions; 2 exclude archived)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/136
- Related: mobile UI product brief §5 P1 (PR #134); `AddFilmSearch`; `/watchlist/add`; film detail; `WatchReviewDialog` / `FilmStatusActions`
- Clarification thread: issue comments (status-aware A; exclude archived)
