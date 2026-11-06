## Related Issue

Closes #143

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/143)

## Description

**What does this PR do?**

Replaces the `/watchlist` metadata table with a phone-first **poster grid** (poster + title only), per-cell **⋯** status actions, and a draft→**Apply** / **Clear** filter/sort sheet so mobile UI criterion B / brief D6 hold. Status tabs (Watchlist / Watched / Archived), URL `tab` behavior, archive confirm, and watch-review dialogs from #115 stay intact. Frontend-only — no API, Alembic, or `config.yaml` changes.

**Why is this the best approach?**

A sortable metadata table fights the phone-first library metaphor. A poster grid keeps scanning visual; status transitions live behind ⋯ (not cell chrome); filters/sort move into a sheet so Apply is intentional and dismiss discards drafts. Reuses `FilmStatusActions` with a new `variant="menu"` and a thin Radix dropdown primitive instead of inventing a second status machine. PR base stays `feature/mobile-ui` (draft #151).

## Changes Proposed

* Added `WatchlistPosterGrid` — 2-col phone / denser `sm+` poster+title cells; missing-poster **NO POSTER**; detail links `/watchlist/{id}?tab=…`
* Added `WatchlistFilterSheet` — draft search / enrichment / year / sort / sort_dir / optional date range; Apply commits URL params; Clear resets defaults and commits; dismiss discards drafts
* Added shadcn-style `components/ui/dropdown-menu.tsx` + `@radix-ui/react-dropdown-menu`; extended `FilmStatusActions` with `variant="menu"` for ⋯ (≥44px hit target)
* Rewrote `watchlist-page-content.tsx` chrome — status tabs + Filter control + grid; removed inline filter row; poster-shaped loading skeleton
* Deleted `WatchlistTable` (+ unit tests) from the watchlist surface
* Minor `FilmPoster` / `loading-state` adjustments for fluid grid cells and poster skeleton
* One-line watchlist poster-grid note in `documents/DESIGN.md`
* Unit coverage: `watchlist-poster-grid.test.tsx`, `watchlist-filter-sheet.test.tsx`, expanded `watchlist-page-content.test.tsx` (+ isolation fix follow-up)
* Playwright: `e2e/watchlist-poster-grid.spec.ts` (mocked API; grid / ⋯ / filter sheet / tabs)
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and eight scenario screenshots under `workflow/issues/issue-143/demo/`

**Explicitly unchanged:** API / Alembic / `config.yaml`; Home hub (`page.tsx` / picker — #142); `app-shell.tsx` (#141); film detail (#144); status machine rules (#115).

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844 Playwright `iPhone 13`, desktop 1280×800). Part 2 seed: 12 films; Ready Film posters pointed at live TMDB assets for capture; Ambiguous Title left as **NO POSTER**.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Poster-first grid (phone) | **PASS** | screenshot below |
| 2a | ⋯ status actions menu | **PASS** | screenshot below |
| 2b | Poster/title → film detail | **PASS** | screenshot below |
| 3a | Filter / sort sheet open | **PASS** | screenshot below |
| 3b | Apply narrows grid | **PASS** | screenshot below |
| 4a | Watched tab empty copy | **PASS** | screenshot below |
| 4b | Archived tab empty copy | **PASS** | screenshot below |
| 5 | Desktop denser grid | **PASS** | screenshot below |

![Scenario 1 — Poster-first grid](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-1-poster-grid.png)

![Scenario 2a — Overflow menu](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-2-overflow-menu.png)

![Scenario 2b — Film detail](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-2-film-detail.png)

![Scenario 3a — Filter sheet](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-3-filter-sheet.png)

![Scenario 3b — Filter applied](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-3-filter-applied.png)

![Scenario 4a — Watched empty](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-4-watched-tab.png)

![Scenario 4b — Archived empty](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-4-archived-tab.png)

![Scenario 5 — Desktop denser grid](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7902eaafc6d884252cf381a4acd486f2441b38b/workflow/issues/issue-143/demo/scenario-5-desktop-grid.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-143-watchlist-poster-grid
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Open `http://localhost:3000/watchlist` at ~390px width (or DevTools device mode):
   - Poster-first grid (poster + title only) — no year / enrichment / RT / date columns in cells; no table headers
   - Status tabs **Watchlist** / **Watched** / **Archived**; page **Filter** control (separate from shell header search); **Add film** present
   - Bottom tabs Home · Watchlist · Recommend · More; Watchlist active
4. Tap ⋯ on a cell → **Mark watched** / **Archive** (status-specific) without navigating; hit target ≥44px. Tap poster or title → `/watchlist/{id}?tab=active` detail.
5. Open **Filter** → bottom sheet with search, enrichment, year, sort, direction, added-from/to. Set a search (e.g. a known title) → **Apply** → sheet closes, grid narrows, Filter control shows active state. **Clear** restores defaults and the broader list. Dismiss without Apply discards draft edits.
6. Switch to **Watched** / **Archived** (`tab=` in URL) — empty copy when empty; still poster-grid metaphor, not a metadata table.
7. Widen to ~1280px — denser multi-column poster+title grid (still not a sortable table); missing posters show **NO POSTER**.
8. Unit + targeted E2E (optional local):
   ```bash
   cd frontend && npm run test:unit -- --run \
     src/components/watchlist-poster-grid.test.tsx \
     src/components/watchlist-filter-sheet.test.tsx \
     src/app/watchlist/watchlist-page-content.test.tsx
   cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test \
     e2e/watchlist-poster-grid.spec.ts \
     e2e/watchlist-add.spec.ts \
     e2e/app-shell-mobile.spec.ts
   ```
9. Gate (PLAN / execute):
   ```bash
   bash scripts/verify-phase6-gates.sh
   ```
   Host build gotcha: stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Known Issues / Notes for Reviewer

* Demo seed Ready Film poster URLs were pointed at live TMDB assets for capture quality; seed defaults use non-existent `seed-poster-N.jpg` paths. Ambiguous Title intentionally left as **NO POSTER** (visible on desktop grid).
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute marked Phase 6 + frontend unit/tsc + targeted E2E path green at execute-ready.
* No migrations or config changes; restart/rebuild frontend only if the Compose bind mount has not picked up the new components.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #151.
* Sibling mobile slices (#142 Home, #144 film detail, etc.) are out of scope for this PR.

## Gate evidence

- [x] Phase 6 gate + frontend unit/tsc green at execute-ready (`b893ad8`) — per PLAN gate (`verify-phase6-gates.sh`) and execute-ready handoff
- [x] Demo: eight scenarios PASS (phone 390×844 + desktop 1280×800) — `demo/demo-notes.md`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` (create-pr)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone poster-grid + filter sheet verified against demo screenshots
