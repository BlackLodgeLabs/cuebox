# Home inline search-picker + global search affordance

**Depends on:** #136 (Home search-picker — `LibrarySearchPicker`, merged library + TMDB search)

---

## Problem / goal

Issue #136 ships a shared `/search` page with `LibrarySearchPicker` and two Home CTAs (**Add a film** / **Mark watched**) that differ only by `?intent=` (placeholder, button emphasis, post-review navigation). The picker already exposes **all** status-aware actions on every result, so the dual CTAs add friction without changing behavior.

Users should be able to **find and act on a film from Home in one step** — add to watchlist, mark watched, view, or complete a pending review — without choosing an intent first. A global search affordance in the app header should make the same picker reachable from any screen.

This builds on #136 and completes the P1 prerequisite placement assumed by the mobile UI product brief (PR #134).

---

## Acceptance criteria

- [ ] **Home embeds `LibrarySearchPicker` inline** on the returning-user Home hub (no navigation to a separate page to start searching)
- [ ] **Dual Home CTAs removed** — no separate **Add a film** and **Mark watched** cards/links that only differ by intent
- [ ] **`LibrarySearchPicker` `intent` prop deprecated or removed** — one unified surface; actions are determined per result (library status / TMDB-only), not by entry point
- [ ] **`/search` kept as an alias route** — redirects to Home with the search field focused (or scrolls to the inline picker). Existing links (`/search`, `/search?intent=…`, `/watchlist/add` redirect chain) continue to work
- [ ] **Header search icon** (magnifying glass) added to `AppShell` on all primary screens; tapping navigates to `/search` (which resolves to the Home inline picker per alias above). Accessible label (e.g. “Search films”)
- [ ] **TMDB-only hits** show both **Add to watchlist** and **Add & mark watched** — the latter chains existing add → `pending_watch_review` → `WatchReviewDialog` (same APIs/rules as library **Mark watched**)
- [ ] Watchlist header **Add film** link uses the same destination as the alias (Home search / `/search`)
- [ ] Empty, loading, no-results, partial-error, and enrichment-polling states still work when picker is embedded on Home
- [ ] Automated tests updated: Home inline picker, `/search` redirect, header icon navigation, TMDB **Add & mark watched** flow (unit and/or Playwright with mocks)

---

## Scope

### In scope

- Refactor Home (`frontend/src/app/page.tsx`) to embed `LibrarySearchPicker`
- Remove dual intent CTAs from Home
- Simplify or remove `intent` handling in `LibrarySearchPicker` and `/search` page (redirect-only)
- `/search` → Home alias with search focus
- Header search icon in `app-shell.tsx`
- TMDB-only **Add & mark watched** action in `SearchHitRow` / picker handlers
- E2E and unit test updates

### Out of scope

- Mobile bottom-tab shell redesign (UI pass — PR #134)
- Poster-grid watchlist, ceremony, Neo-Noir reskin
- Full-screen search modal/sheet (inline on Home is sufficient for this issue; UI pass may refine)
- Searching archived films
- New film status machine or backend migrations
- Header search opening an in-place overlay without visiting Home (future enhancement)

---

## User-visible behavior

### Home (returning user)

1. Home shows an inline **Find a film…** search field (library + TMDB picker) near the top of the hub, above **Create a recommendation** and **History** quick links.
2. User types → combined library + TMDB results with status-aware actions (unchanged from #136).
3. No separate Add vs Mark watched entry points on Home.

### Global header

1. Magnifying-glass icon visible in the app header on all shell screens.
2. Tap → navigate to `/search` → redirect to Home with search focused.

### `/search` alias

1. `/search` and `/search?intent=add|mark-watched` redirect to `/` (optional: `?focus=search` or hash) and autofocus the inline picker.
2. `/watchlist/add` redirect chain continues to work via `/search` alias.

### TMDB-only results

| Action | Behavior |
|--------|----------|
| **Add to watchlist** | Unchanged — `POST /watchlist/films`, enrichment poll, navigate to film detail |
| **Add & mark watched** | Add film (or surface already-on-watchlist if duplicate) → `active → pending_watch_review` → open `WatchReviewDialog` with `cancelOnDismiss: true` |

### Library results

Unchanged from #136: View; Mark watched (`active`); Complete review (`pending_watch_review`); View only (`watched`).

---

## Data / integration impact

- **No DB migrations** — reuses `POST /watchlist/films`, `PUT /films/{id}/status`, watch-review APIs from #136
- **TMDB:** existing `GET /films/tmdb-search`
- **Local library:** existing `GET /films?statuses=active,pending_watch_review,watched&search=…`
- **Add & mark watched:** client-side orchestration only; no new endpoint required unless implementation finds a race during enrichment (document in plan if so)
