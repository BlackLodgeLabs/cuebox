# Implementation plan — Issue #143

**Tier:** application  
**Issue type:** feature (mobile watchlist metaphor rewrite; not a bug)  
**Integration base:** `feature/mobile-ui` (PR **#151** must target this, not `main`)

## Overview

Replace the metadata-heavy `WatchlistTable` on `/watchlist` with a **poster-first grid** per brief **D6** / success criterion **B**:

1. **Grid cells** — poster + **title below only** (no year, RT, enrichment badge, dates, or status text in the cell)
2. **⋯ (`more_horiz`)** overlay on each poster → status actions for the film’s current status (#115 rules via existing `FilmStatusActions` transitions / `WatchReviewDialog` / archive confirm)
3. **Filter** control (top-right page chrome) opens a **filter/sort sheet** with draft → **Apply**; **Clear** resets to defaults and commits; closing without Apply discards drafts
4. **Status tabs** Watchlist / Watched / Archived + URL `tab` / filter params preserved
5. Desktop may use **more columns** but **must not** regress to a metadata table as the default UX

No API, DB, or config changes. Do not edit Home hub (#142) or AppShell (#141). Film detail (#144) stays out of scope.

Planning base already includes merged `feature/mobile-ui` tip (#141 shell + #142 Home).

## Reproduction findings

N/A — greenfield UX rewrite (feature). Baseline confirmed by static read:

- `watchlist-page-content.tsx` — always-visible inline filter row (search, year, dates, enrichment) + `WatchlistTable`
- `watchlist-table.tsx` — table cells expose year, dates, enrichment `Badge`, inline `FilmStatusActions`
- No `DropdownMenu` / `Popover` primitive yet; `Sheet` exists (`components/ui/sheet.tsx`)
- `FilmPoster` sizes are fixed (`sm`/`md`/`lg`); grid will wrap with aspect-ratio + fluid width

## Root cause

N/A (feature). Product constraint: phone-first poster metaphor; current table fails criterion **B**.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/components/watchlist-poster-grid.tsx` | **New** | Poster grid + per-cell ⋯ overflow; detail links |
| `frontend/src/components/watchlist-poster-grid.test.tsx` | **New** | Grid metaphor + overflow + no cell metadata |
| `frontend/src/components/watchlist-filter-sheet.tsx` | **New** | Draft→Apply/Clear filter/sort sheet UI |
| `frontend/src/components/watchlist-filter-sheet.test.tsx` | **New** | Sheet fields, Apply/Clear, discard-on-close |
| `frontend/src/components/ui/dropdown-menu.tsx` | **New** (shadcn-style) | Accessible ⋯ menu; add `@radix-ui/react-dropdown-menu` |
| `frontend/package.json` + lockfile | Edit | Radix dropdown-menu dependency |
| `frontend/src/components/film-status-actions.tsx` | Edit | Add `variant="menu"` (menu items) for overflow; keep `table`/`detail` for film detail |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | **Rewrite chrome** | Tabs + Filter + grid; remove inline filters; wire sheet + dialogs |
| `frontend/src/app/watchlist/watchlist-page-content.test.tsx` | Expand | Tabs mapping, Filter opens sheet, Apply updates router, no table |
| `frontend/src/components/watchlist-table.tsx` (+ `.test.tsx`) | **Remove** (or stop importing) | Table is no longer the default metaphor; delete to avoid dead code |
| `frontend/src/components/loading-state.tsx` | Edit if needed | Poster-shaped grid skeleton (2-col phone / denser md+) |
| `frontend/src/components/film-poster.tsx` | Edit if needed | Optional fluid/`fill` sizing for grid cells — only if className alone is insufficient |
| `frontend/e2e/watchlist-poster-grid.spec.ts` | **New** | Playwright: grid, ⋯, filter sheet, tabs (mocked API) |
| `frontend/e2e/watchlist-add.spec.ts` / `all-routes.spec.ts` | Touch only if selectors break | “Add film” / heading still present |
| `documents/DESIGN.md` | Optional one line | Poster-grid watchlist metaphor (D6) if missing |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| API / Alembic / `config.yaml` / `documents/api-contracts.md` | Prefer no API changes |
| `frontend/src/app/page.tsx`, library search picker | #142 / Home out of scope |
| `frontend/src/components/app-shell.tsx` | #141 done |
| `film-detail-view.tsx` | Slice d / #144 |
| Status machine rules | #115 preserved |

## Implementation steps

### Step 1 — Overflow menu primitive

1. Add `@radix-ui/react-dropdown-menu` and a thin shadcn-style `components/ui/dropdown-menu.tsx` (Neo-Noir tokens: `bg-popover`, `border-border`, etc.).
2. Extend `FilmStatusActions` with `variant="menu"`:
   - Render the same status-specific labels as today (`Mark watched`, `Archive`, `Complete review`, `Return to watchlist`, `Re-enable on watchlist`)
   - Use `DropdownMenuItem` (or button-as-item) instead of ghost table buttons
   - Keep existing archive confirmation `Dialog` inside the component
3. Preserve `variant="detail"` behavior for film detail (unchanged).

### Step 2 — Poster grid component

Create `WatchlistPosterGrid`:

```text
ul/grid
  li (per film)
    relative poster frame (aspect 2/3)
      Link → /watchlist/{id}?tab={tab}  (poster)
      DropdownMenu trigger: Icon more_horiz, aria-label e.g. "Actions for {title}"
        → FilmStatusActions variant="menu"
    Link title below poster (same href)
```

Locked rules:

- Cell content = poster + title only — **assert in tests** that year / enrichment strings / “Added” dates are absent
- ⋯ is overlay (e.g. top-right), `min-h/w-[44px]`, `type="button"`, `stopPropagation` so it does not navigate
- Missing poster → existing `FilmPoster` “NO POSTER”
- Columns: ~2 phone, denser from `sm`/`md`/`lg` (e.g. 3 / 4 / 5–6) — same metaphor at all breakpoints
- Reuse status callbacks from page: `onStatusTransition`, `onMarkWatched`, `onCompleteReview`, `isStatusPending`

### Step 3 — Filter / sort sheet

Create `WatchlistFilterSheet` controlled by `open` / `onOpenChange`:

| Field | Maps to URL / API |
|-------|-------------------|
| Search | `search` |
| Enrichment | `enrichment_status` (`all` → omit) |
| Year | `year` (exact) |
| Sort | `sort` ∈ `title` \| `year` \| `created_at` \| `enrichment_status` |
| Sort direction | `sort_dir` ∈ `asc` \| `desc` |
| Date added from/to (optional, keep) | `created_from`, `created_to` |

Behavior (locked):

1. On open → seed **draft** state from current URL-derived props
2. Edits only mutate draft (no live URL updates; remove today’s 300ms debounced search/year URL writes from page chrome)
3. **Apply** → call `updateParams` with drafts + `offset: null`, close sheet
4. **Clear** → reset drafts to defaults (`search`/`year`/`dates` empty; enrichment `all`; sort `created_at` + `desc`) **and commit immediately** (Apply-on-clear), then close
5. Close / overlay dismiss without Apply → discard drafts
6. Sheet side: `bottom` on small screens (phone-friendly), `right` from `md` if easy via class/`side` prop; either is acceptable if one side works well on phone
7. Honor `prefers-reduced-motion` via existing sheet animation / reduced-motion CSS (D8)

### Step 4 — Page chrome rewrite

In `watchlist-page-content.tsx`:

1. Keep header: title + subtitle + **Add film** → `/search`
2. Keep status `Tabs` + counts + empty/error copy
3. Replace inline filter row with a **Filter** control (top-right of chrome under/ beside tabs — not shell header search). Suggested: `Button` + `Icon name="filter_list"` (or `tune`), `aria-label="Filter and sort"`, ≥44px hit target. Optional subtle active indicator when non-default filters are applied (nice-to-have, not required)
4. Render `WatchlistPosterGrid` instead of `WatchlistTable`
5. Keep pagination Previous/Next + `WatchReviewDialog` mark-watched / complete-review flows
6. Loading: poster-oriented skeleton (update `CardGridSkeleton` columns to match grid or add `PosterGridSkeleton`)
7. Delete unused table import; remove `handleSort` column-toggle API if unused (sort only via sheet)

### Step 5 — Retire table

- Delete `watchlist-table.tsx` + `watchlist-table.test.tsx` (or leave unimported only if something external still needs it — currently only watchlist page)
- Update page unit test mock from `watchlist-table` → poster grid / filter sheet

### Step 6 — Tests + E2E

See **Tests required**. New Playwright file with mocked `/api/v1/films` routes (pattern from `watchlist-add.spec.ts` / `library-search-picker.spec.ts`); phone viewport ~390×844 for metaphor checks.

### Step 7 — Docs + PR base

- Optional one-line D6 note in `DESIGN.md`
- Ensure draft PR **#151** base is `feature/mobile-ui` (Actions may have defaulted to `main` — retarget)

## Tests required

| Test | Type | Acceptance criteria covered |
|------|------|----------------------------|
| Grid renders poster + title only; no year/enrichment/date in cell | unit | Poster-first; no cell metadata (B) |
| Poster/title link → `/watchlist/{id}?tab=…` | unit | Tap → detail |
| Missing poster shows NO POSTER | unit | Placeholder consistency |
| ⋯ opens menu; Mark watched / Archive / Return / Re-enable per status | unit | ⋯ actions; #115 rules |
| ⋯ click does not navigate | unit | Overlay vs detail link |
| Filter button opens sheet with URL-prefilled drafts | unit | Filter sheet |
| Apply writes search/enrichment/year/sort/sort_dir (+ optional dates) via router; closes sheet | unit | Apply affordance |
| Clear resets to defaults and commits; closes | unit | Clear affordance |
| Close without Apply does not call router with draft edits | unit | Draft-then-apply |
| Watched tab still maps `status=watched`; archived `status=archived`; active `on_watchlist` | unit | Status tabs + URL |
| Empty watched / archived / active no-match copy | unit | Empty states |
| Hit-target classes ≥44px on Filter + ⋯ | unit (class tokens) | Criterion C |
| Grid visible; no table headers (“Enrichment”, sortable Year column) | e2e mocked | Metaphor / no table regress |
| Open Filter → set search → Apply → request or UI reflects filter | e2e mocked | Filter sheet open/apply |
| Clear from sheet restores unfiltered list chrome | e2e mocked | Clear |
| ⋯ → Mark watched (or Return) path fires | e2e mocked | Overflow actions |
| Tabs Watchlist / Watched / Archived switch dataset | e2e mocked | Status tabs |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + unit suite green |

## Gate script

Frontend MVP presentation change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With stack up, also:

```bash
cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test \
  e2e/watchlist-poster-grid.spec.ts \
  e2e/watchlist-add.spec.ts \
  e2e/app-shell-mobile.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Optional one-line watchlist poster-grid + filter sheet note (D6) |
| `workflow/issues/issue-143/PLAN.md` / `demo/` | This plan + demo-spec |
| `documents/api-contracts.md` / README | None (no API changes) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Losing filter discoverability | Persistent Filter control; optional active-state when filters applied |
| ⋯ overlapping poster / hard to tap | ≥44px hit target; contrast overlay; demo on phone viewport |
| Dropdown menu dependency adds surface area | Thin shadcn wrapper; only used for watchlist overflow in this slice |
| Detail page still uses table-style actions | Keep `FilmStatusActions` `detail` variant unchanged |
| E2E/unit still expect table / inline filters | Rewrite page tests; grep for `WatchlistTable` / “Filter by title” |
| Parallel #142 / Home churn | Do not touch `page.tsx` / picker; merge `feature/mobile-ui` before execute if tip moved |
| PR #151 base is `main` | Retarget to `feature/mobile-ui` before merge |
| Sorting UX less obvious without column headers | Sort controls live in filter sheet (SPEC) |

**Rollback:** Revert watchlist page + new components + dropdown dep; prior table returns.

## Definition of done

- [ ] `/watchlist` is a poster-first grid (poster + title only) at all breakpoints — no metadata table default
- [ ] ⋯ on each poster opens status actions per #115; archive confirm + watch-review dialog preserved
- [ ] Status tabs + URL `tab` behavior preserved
- [ ] Filter opens draft→Apply sheet (search, enrichment, year, sort, sort_dir; optional date range); Clear commits defaults; dismiss discards drafts
- [ ] Empty / error / loading states remain clear (grid-shaped skeleton)
- [ ] Tap poster/title → detail with `?tab=`; missing-poster placeholder consistent
- [ ] ≥44px Filter + ⋯ targets; no hover-only essentials; Neo-Noir tokens; reduced-motion honored for sheet/menu
- [ ] No API changes; Home / shell / film detail untouched
- [ ] Unit + Playwright coverage mapped above green
- [ ] `bash scripts/verify-phase6-gates.sh` exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#151** base = `feature/mobile-ui`
- [ ] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)

## PR seed

**Tier:** application  
**What / why:** Replace the watchlist table with a poster-first grid + ⋯ actions + filter/sort sheet so mobile UI criterion B / brief D6 hold.  
**Key changes:** New poster grid + filter sheet; overflow menu via dropdown; retire `WatchlistTable` from `/watchlist`; unit + Playwright coverage.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests; optional Phase 8 full regression.  
**How to test:** Open `/watchlist` on ~390px — grid of posters+titles; ⋯ → status actions; Filter → sheet Apply/Clear; tabs Watchlist/Watched/Archived.  
**Base branch:** `feature/mobile-ui` (PR #151 — retarget if still on `main`).
