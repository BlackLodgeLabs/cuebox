# Issue #143: Mobile UI — watchlist poster grid + filter sheet

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/143

**Integration base:** `feature/mobile-ui` (not `main`). Slice (a) / #141 already merged there; this branch is cut from that tip so Watchlist renders inside the new `AppShell`. Draft PR **must** target `feature/mobile-ui`. Running in parallel with #142 (Home hub) — do not edit Home.

## Summary

Replace the metadata-heavy watchlist table on `/watchlist` with a **poster-first grid**: each cell shows a poster and **title below only**; status actions move behind a **⋯ (`more_horiz`)** control on the poster; search/filter/sort move into a **filter/sort sheet** opened from a top-right Filter control. Status tabs (**Watchlist / Watched / Archived**) and existing `GET /films` query params stay. This is **slice (c)** of the mobile UI pass and delivers brief success criterion **B** (fail-if-missing).

Hard constraints: brief **D1**, **D6**, **D8**, **D10-B/C/F**. Tighten Neo-Noir; do not rebrand.

## Problem

The watchlist is still a dense table/list (`WatchlistTable`) with year, enrichment, dates, and inline status actions in cells — wrong metaphor for a phone-first, poster-led product. Brief **D6** requires:

- Poster + title below only
- No metadata on grid cells
- Actions via ⋯
- Filters in a sheet (not inline clutter over the grid)

Success criterion **B** fails the mobile UI pass if this metaphor is missing.

## Acceptance criteria

- [ ] Watchlist is a **poster-first grid**: poster + **title below only**; **no metadata** on grid cells (no year, RT, enrichment badge, dates, or status labels in the cell)
- [ ] **⋯ (`more_horiz`)** on each poster (e.g. top-right overlay) opens status actions for that film’s current status per #115 rules (same transitions as today’s `FilmStatusActions`): mark watched / complete review / archive / return to watchlist / re-enable — as applicable
- [ ] Status tabs remain: **Watchlist / Watched / Archived** with existing URL-param behavior (`tab` absent = Watchlist/active; `tab=watched`; `tab=archived`)
- [ ] **Filter** control (top-right of the watchlist chrome, not competing with shell header search) opens a **filter/sort sheet** (reuse `Sheet` / bottom or right sheet — phone-friendly); filters are **not** left as an always-visible inline form over the grid
- [ ] Filter/sort sheet exposes Cuebox-stored fields already supported by `GET /films` — **at minimum**:
  - Search (title text → `search`)
  - Enrichment status (`enrichment_status`, including “all”)
  - Year (`year` exact — currently supported)
  - Sort + sort direction (`sort`, `sort_dir`) for columns that still make sense without a table: `title`, `year`, `created_at`, `enrichment_status`
  - Clear / Apply affordances
- [ ] Optional sheet fields that already exist in the current page URL/API may remain: `created_from`, `created_to` (date-added range). Do **not** add new API dimensions in this slice
- [ ] Empty / no-match states remain clear (per-tab empty copy + active-tab filter no-match → import path as today)
- [ ] Tap poster or title → film detail (`/watchlist/{filmId}`), preserving `?tab=` for back navigation when currently used
- [ ] Missing-poster placeholder via existing `FilmPoster` (“NO POSTER”) — consistent with the rest of the app
- [ ] Hit targets ~**≥44×44px** for ⋯ and Filter; no hover-only essential actions (criterion **C**)
- [ ] Neo-Noir tokens preserved; desktop may use a **denser** grid (more columns) but **must keep the same metaphor** — no regress to a metadata-heavy table as the default UX at any breakpoint
- [ ] **Tests:** unit + Playwright coverage for grid rendering (poster + title only), ⋯ actions, filter sheet open/apply (and clear), status tabs

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Replace table chrome with grid + Filter control + sheet wiring; keep tabs, pagination, status mutation / watch-review dialog flows |
| `frontend/src/components/watchlist-table.tsx` (and tests) | Replace or retire as default; introduce poster grid component(s) (e.g. `watchlist-poster-grid.tsx`) |
| Overflow menu | ⋯ menu / popover / sheet listing status actions; reuse transition hooks and `WatchReviewDialog` / archive confirm behavior |
| Filter/sort sheet | New UI using existing `Sheet` + form controls; draft values → Apply writes URL query params; Clear resets to defaults |
| URL params | Preserve: `tab`, `search`, `year`, `created_from`, `created_to`, `enrichment_status`, `sort`, `sort_dir`, `offset` |
| API usage | Keep tab → API mapping: Watchlist `on_watchlist=true`; Watched `status=watched`; Archived `status=archived` |
| Add film | Keep header/link to `/search` (picker on Home) — do not invent a new add surface |
| Tests | Update `watchlist-page-content.test.tsx` / table tests; add unit coverage for grid + sheet; add Playwright for grid / ⋯ / filter sheet / tabs |
| Docs | Optional short watchlist-grid note in `DESIGN.md` only if a layout rule needs documenting |

### Out of scope

- New filter dimensions / API / schema work (unless a tiny additive query param is clearly required — call out in plan; prefer none)
- Film detail reskin (slice d — #144)
- Ceremony, Home hub (#142), shell (#141 — already on `feature/mobile-ui`)
- Bulk actions
- Questionnaire / first-run polish (#146)
- PWA, Insights/Ask, Developer Mode visual redesign, rebrand
- Changing film status machine rules (#115)

## User flows / API changes

### Open Watchlist

1. Bottom tab **Watchlist** (or `/watchlist`) inside #141 `AppShell`.
2. See status tabs + Filter control + **poster grid** (poster + title only).
3. Pagination remains (limit 20 / offset) below or after the grid; content clears the bottom tab bar (shell safe-area already from #141).

### ⋯ actions

1. Tap ⋯ on a cell → menu of status actions for that film’s `status` (same labels/rules as `FilmStatusActions` today).
2. Mark watched → existing pending → `WatchReviewDialog` path (`cancelOnDismiss` as today).
3. Archive → existing confirmation dialog → `archived`.
4. Return / re-enable → `POST .../status` with `active`.
5. ⋯ must not navigate to detail; poster/title taps do.

### Filter / sort sheet

1. Tap **Filter** → sheet opens with current URL-derived values prefilled.
2. Edit search / enrichment / year / sort / sort_dir (and optional date range).
3. **Apply** → update URL query params, close sheet, refetch grid (`offset` resets to 0 when filters change, as today).
4. **Clear** → reset sheet fields to defaults (no search/year/dates; enrichment “all”; sort `created_at` + `desc`) then Apply or apply-on-clear — plan may pick one; must be obvious.
5. Closing the sheet without Apply discards draft edits (locked: draft-then-apply, not live-typing URL updates for sheet fields). Debounced live search **inside the sheet before Apply** is optional; URL must not change until Apply/Clear-commit.

### Status tabs

1. Switch Watchlist / Watched / Archived → same grid metaphor, different dataset (URL `tab` behavior preserved).
2. Counts in tab labels may remain if already present.

### Empty / error

| State | Expectation |
|-------|-------------|
| Loading | Skeleton appropriate to a grid (not a table skeleton) |
| Error | Existing “Could not load watchlist.” style error |
| Active + no matches | Clear no-match / import affordance (today’s copy OK) |
| Watched empty | “No watched films yet…” (or equivalent) |
| Archived empty | “No archived films…” (or equivalent) |

### Composition rules (locked)

| Element | Role |
|---------|------|
| Grid cell | Poster + title only; no year/RT/enrichment/dates/status text in the cell |
| ⋯ | Overlay on poster; ≥44px hit target; opens actions |
| Filter | Top-right page control; opens sheet |
| Status tabs | Unchanged product model |
| Desktop | More columns OK; **no** default table regress |
| Metadata | Lives on film detail / elsewhere — not on grid cells |

### API changes

**None preferred.** Reuse:

- `GET /api/v1/films` with existing filters/sorts
- `POST /api/v1/films/{id}/status`
- `POST` / `DELETE /api/v1/films/{id}/watch-review`

If a tiny additive query param becomes unavoidable, document in `documents/api-contracts.md` and call out in the plan — default is no API change.

## Data and integration notes

- **DB / migrations:** none
- **API / config:** none (default)
- **Frontend:** watchlist page + new grid/sheet components; reuse `FilmPoster`, `Sheet`, `useFilms` / status hooks, `WatchReviewDialog`
- **#141 dependency:** compose inside bottom-tab shell; Filter control is page chrome, not a fifth tab
- **#142 parallel:** do not modify Home / hub composition
- **#115 lifecycle:** preserve status transition rules and tab semantics
- **Design system:** Cabin / Libre Franklin / Space Mono; tokens from `tokens.css`; Material Symbols Outlined for ⋯ / filter icons; 16px mobile margins; honor `prefers-reduced-motion` for sheet/menu motion (D8)
- **Git:** branch from `feature/mobile-ui`; PR base `feature/mobile-ui` (workflow Action may default to `main` — retarget if needed, same as #142)

## Open questions

_(none — issue body + brief D6 / D10-B + #141 on `feature/mobile-ui` + parallel-with-#142 note are sufficient to plan)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/143
- Product brief: [`documents/ui-mobile-product-brief.md`](../../../documents/ui-mobile-product-brief.md) (D6, D10-B)
- Design system: [`documents/DESIGN.md`](../../../documents/DESIGN.md)
- API contracts: [`documents/api-contracts.md`](../../../documents/api-contracts.md)
- Depends on: #141 (merged to `feature/mobile-ui`, PR #149)
- Parallel: #142 (Home hub)
- Lifecycle reference: #115
- Parent brief PR: #134
- Sibling slices: #144 (film detail), #145 (ceremony), #146 (questionnaire / first-run)
