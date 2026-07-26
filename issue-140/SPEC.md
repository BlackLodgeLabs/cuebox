# Issue #140: Home inline search-picker + global header search

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/140

## Summary

Move the shared `LibrarySearchPicker` from a separate `/search` page into the **returning-user Home hub**, remove the dual **Add a film** / **Mark watched** CTAs that only differ by `?intent=`, and add a global **header search icon** that reaches the same inline field via a `/search` → Home alias. TMDB-only hits gain **Add & mark watched** (client-side chain of existing add → `pending_watch_review` → `WatchReviewDialog`). No new APIs or status machine.

This completes the P1 placement assumed by the mobile UI product brief (PR #134) on top of #136.

## Problem

Issue #136 shipped `LibrarySearchPicker` on `/search` with two Home entry cards that only change placeholder, button emphasis, and post-review navigation via `?intent=add|mark-watched`. The picker already exposes **all** status-aware actions on every result, so choosing an intent first adds friction without changing what the user can do.

Users should **find and act on a film from Home in one step** (add, mark watched, view, or complete a pending review). A header magnifying-glass should make that surface reachable from any shell screen.

## Decisions (resolved)

| # | Topic | Decision |
|---|--------|----------|
| 1 | `/search` alias focus mechanism | Redirect to `/?focus=search` (ignore legacy `intent` query). Home autofocuses / scrolls to the inline picker when that param is present, then clears it from the URL (replace) so refresh does not re-steal focus. |
| 2 | Empty-watchlist Home | Keep today’s **Import watchlist** CTA only — **do not** embed the picker on the empty hub. Header / `/search` / `/watchlist/add` still land on `/?focus=search`; when the hub has no picker, focus is a no-op (Home loads normally). Once the user has a watchlist, the same URLs focus the inline field. |
| 3 | `intent` prop | **Remove** `LibrarySearchPicker` `intent` prop and `SearchPickerIntent` type. Unified placeholder **Find a film…**; no intent-based button emphasis. Actions come only from hit type / library status. |
| 4 | Post-review / post-add navigation | Unchanged from #136 defaults for a unified surface: after add → film detail (existing enrichment poll); after mark-watched / review completion → stay on Home (or existing dialog success path) without intent-specific redirects. Document any small deviation in the plan if current `/search` code differs. |
| 5 | Header search target | Icon navigates to `/search` (not `/` directly) so the alias remains the single entry for deep links, watchlist **Add film**, and header. |

## Acceptance criteria

- [ ] **Home embeds `LibrarySearchPicker` inline** on the returning-user Home hub (no navigation to a separate page to start searching)
- [ ] Inline picker sits near the top of the hub, **above** **Create a recommendation** / **New recommendation** and **History** quick links (exact card layout may keep existing recommendation/history cards; dual intent cards are gone)
- [ ] **Dual Home CTAs removed** — no separate **Add a film** and **Mark watched** cards/links that only differ by intent
- [ ] **`LibrarySearchPicker` `intent` prop removed** — one unified surface; actions determined per result (library status / TMDB-only)
- [ ] **`/search` is redirect-only** — `redirect("/?focus=search")` (or equivalent); `intent` query ignored; `/watchlist/add` → `/search?…` chain still ends at Home with focus
- [ ] Home honors `?focus=search` by focusing (and scrolling into view if needed) the picker input when the returning-user hub is shown
- [ ] **Header search icon** (magnifying glass) in `AppShell` on all primary screens; accessible name **Search films**; navigates to `/search`
- [ ] **TMDB-only hits** show both **Add to watchlist** and **Add & mark watched**
  - **Add to watchlist** — existing `POST /watchlist/films`, enrichment poll, navigate to film detail; conflict / already-on-watchlist / pending-review messaging unchanged
  - **Add & mark watched** — add (or surface already-on-watchlist) → `active → pending_watch_review` → open `WatchReviewDialog` with `cancelOnDismiss: true` (same rules as library **Mark watched**)
- [ ] Watchlist header **Add film** link points at `/search` (or `/?focus=search`); same destination as the alias
- [ ] Empty, loading, no-results, partial-error, and enrichment-polling states still work when the picker is embedded on Home
- [ ] Automated tests updated: Home inline picker presence / dual CTA absence; `/search` redirect; header icon → `/search`; TMDB **Add & mark watched** flow (unit and/or Playwright with mocks); intent-related tests removed or rewritten

## Scope

### In scope

- Refactor `frontend/src/app/page.tsx` to embed `LibrarySearchPicker` on the returning-user hub; remove dual intent CTAs
- Simplify `LibrarySearchPicker` / `SearchHitRow`: drop `intent`; add TMDB **Add & mark watched** handler
- Convert `frontend/src/app/search/page.tsx` to a redirect alias (no standalone picker UI)
- Preserve `/watchlist/add` redirect into the alias chain
- Header search control in `frontend/src/components/app-shell.tsx` (+ unit test)
- Watchlist **Add film** link destination update
- Home focus handling for `?focus=search`
- E2E / unit test updates (`library-search-picker`, Home, app-shell, search redirect, watchlist-add as needed)

### Out of scope

- Mobile bottom-tab shell redesign (UI pass — PR #134)
- Poster-grid watchlist, ceremony, Neo-Noir reskin
- Full-screen search modal/sheet (inline on Home is enough; UI pass may refine)
- Searching archived films
- New film status machine or backend migrations
- Header search opening an in-place overlay without visiting Home
- Embedding the picker on the empty-watchlist Import hub

## User flows / API changes

### Home (returning user)

1. Hub shows an inline **Find a film…** field (`LibrarySearchPicker`) near the top, above recommendation and History entry points.
2. User types → combined library + TMDB results with status-aware actions (same merge rules as #136).
3. No separate Add vs Mark watched entry cards.

### Global header

1. Magnifying-glass visible in `AppShell` header on all shell screens.
2. Place **Search** after the primary nav items (Home…Settings) and **before** the conditional **Review** link.
3. Activate → `/search` → redirect to `/?focus=search` → Home focuses the inline input (returning user).

### `/search` alias

1. `/search` and `/search?intent=add|mark-watched` redirect to `/?focus=search`.
2. `/watchlist/add` continues to redirect into `/search` (then Home).

### Result actions

| Hit type | Actions |
|----------|---------|
| Local `active` | **View**, **Mark watched** |
| Local `pending_watch_review` | **View**, **Complete review** |
| Local `watched` | **View**, **Return to watchlist** (`watched` → `active` via existing status API; eligible for recommendations again) |
| TMDB-only | **Add to watchlist**, **Add & mark watched** |

Library actions and dialogs match #136 plus **Return to watchlist** on watched hits (same transition as the Watched tab). **Add & mark watched** is client-side orchestration only.

### API changes

None. Reuse:

- `GET /films?statuses=active,pending_watch_review,watched&search=…`
- `GET /films/tmdb-search`
- `POST /watchlist/films`
- `PUT /films/{id}/status`
- Existing watch-review endpoints / `WatchReviewDialog`

If execute finds an enrichment race for **Add & mark watched** (status transition before `ready`), document and either poll until ready (preferred, mirrors add-then-navigate) or propose a minimal API change in the plan — do not invent a new status machine in this issue.

## Data and integration notes

- **No DB migrations**
- Local search continues to **exclude `archived`**
- TMDB / local merge by `tmdb_id` unchanged (`mergeLibraryAndTmdbResults`)
- Design: Modern Neo-Noir tokens (`documents/DESIGN.md`); header icon should match existing `Icon` / nav patterns in `app-shell.tsx` (add a search glyph if missing)

## Open questions

None — ready for planning.

## Spec revision (post-execute feedback)

Human follow-up on PR #147 (no workflow stage change):

1. Header **Search** sits after primary nav items and before conditional **Review**.
2. Local `watched` hits expose **View** + **Return to watchlist** (`POST/PUT` status → `active`, same as Watched tab).

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/140
- Prerequisite: [#136](https://github.com/BlackLodgeLabs/cuebox/issues/136) / PR search-picker
- Mobile UI brief context: PR [#134](https://github.com/BlackLodgeLabs/cuebox/pull/134)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
