## Related Issue

Closes #144

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/144)

## Description

**What does this PR do?**

Reskins film detail (`/watchlist/[filmId]`) into a **poster-led** phone screen so metadata scans below a dominant poster instead of a backdrop-overlay + peer-card dashboard (mobile UI slice d / brief **D6–D7**). The first viewport is a large `FilmPoster` `size="fill"` plane with title, enrichment/status badges, Edit match, and `FilmStatusActions` (`variant="detail"`) attached under/beside it. Below: a single vertical scan — overview → where-to-watch → watch history → scores/tags → semantic → promoted Letterboxd/TMDB/IMDb links. Detail status and Edit hit targets are ≥44px (`min-h-11`). Enrichment-empty / missing-poster paths show status + a clear **NO POSTER** placeholder instead of empty card shells. Loading uses a poster-shaped `FilmDetailSkeleton`.

**Why is this the best approach?**

Phone-first continuity with the watchlist poster metaphor needs one dominant visual plane, not competing backdrop chrome and equal Cards. Reusing `FilmStatusActions` preserves #115 labels/rules while only bumping presentation size. Frontend-only: no API, DB, or config changes. Draft PR **#152** stays based on `feature/mobile-ui` (do not retarget to `main`).

## Changes Proposed

* Rewrote `frontend/src/components/film-detail-view.tsx` — poster-led hero, section hierarchy, promoted Links section, graceful empty/degrade paths; preserved back-nav (`?tab=` / status fallback), `?editMatch=1`, enrichment toasts, dialogs
* Bumped `FilmStatusActions` `variant="detail"` hit targets to ≥44px (`min-h-11`); left `table` variant alone
* Extended `FilmPoster` with fluid `fill` size for the dominant frame; kept **NO POSTER** copy
* Light density/spacing polish on `where-to-watch-section.tsx` (no provider API/behavior changes)
* Added `FilmDetailSkeleton` in `loading-state.tsx`; wired `/watchlist/[filmId]` loading away from `CardGridSkeleton`
* Added `film-detail-view.test.tsx` (poster-led layout, back `href`, status actions, external links, enrichment-empty) and cleanup on null-score regression tests
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and six scenario screenshots under `workflow/issues/issue-144/demo/`

**Explicitly unchanged:** API / Alembic / `config.yaml`; watchlist grid (#143); Home (#142); AppShell (#141); ceremony (#145); status-machine transition rules (#115).

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `iPhone 13`; desktop 1280×800). Ready film: *The Matrix* (`b3714da2-1efd-4fc5-9768-12cfa12abcd4`). Degrade film: *Ambiguous Title* (`d7f420da-e6c4-42d9-9248-be3d18884c9e`). Scenario 3 temporarily stubbed watch-providers → empty categories so W2W + Links could composite in one artifact (live providers also verified reachable).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Poster-led first viewport (phone) | **PASS** | screenshot below |
| 2 | Status actions + hit targets | **PASS** | screenshot below |
| 3 | Where-to-watch + external links | **PASS** | screenshot below |
| 4 | Back navigation `?tab=watched` | **PASS** | screenshot below |
| 5 | Graceful degrade (no poster / failed) | **PASS** | screenshot below |
| 6 | Desktop poster-led metaphor | **PASS** | screenshot below |

![Scenario 1 — Poster-led first viewport](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-1-poster-led-phone.png)

![Scenario 2 — Status actions](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-2-status-actions.png)

![Scenario 3 — Where to watch + links](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-3-where-to-watch-links.png)

![Scenario 4 — Back navigation](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-4-back-nav.png)

![Scenario 5 — Graceful degrade](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-5-degrade.png)

![Scenario 6 — Desktop](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/2d473dc31a15b300cfbb11992709e0f921975403/workflow/issues/issue-144/demo/scenario-6-desktop.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-144-mobile-ui-film-detail
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Open a ready film at phone width (~390px), e.g. `http://localhost:3000/watchlist/b3714da2-1efd-4fc5-9768-12cfa12abcd4`:
   - Large poster dominates the first viewport (not a small inset on a backdrop banner)
   - Title / enrichment / status badges and **Edit film match** sit under/beside the poster
   - **Mark watched** / **Archive** (or status-appropriate #115 labels) visible without hover; hit targets ≥44px tall
4. Scroll the page: Overview → Where to Watch → (history/scores/semantic as present) → **Links** with labeled Letterboxd / TMDB / IMDb when IDs exist.
5. Open with tab query: `/watchlist/{id}?tab=watched` → tap **← Watchlist** → lands on `/watchlist?tab=watched`.
6. Open a failed/no-poster film (e.g. `d7f420da-e6c4-42d9-9248-be3d18884c9e`): **NO POSTER** placeholder + Failed/status badges; no empty peer-card collage in the first scan.
7. At ≥768px (e.g. 1280×800): same poster-led metaphor (poster primary; title/actions beside on `md+`).
8. Unit tests (optional local):
   ```bash
   cd frontend && npm run test:unit -- --run src/components/film-detail-view.test.tsx src/components/film-detail-view.null-score.test.tsx
   ```
9. Gate (PLAN / execute):
   ```bash
   bash scripts/verify-phase6-gates.sh
   ```

## Known Issues / Notes for Reviewer

* Watchlist entry metaphor may still be table (#143) — out of scope; demo entered detail via direct URL.
* Scenario 3 artifact is a stacked W2W + Links crop; live STREAM/RENT/BUY listings also work when unmocked.
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute marked Phase 6 + frontend unit/tsc green at execute-ready.
* No migrations or config changes; restart frontend only if the Compose bind mount has not picked up `film-detail-view.tsx`.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #152.

## Gate evidence

- [x] Phase 6 gate + frontend unit/tsc green at execute-ready (`5e1d057`) — per execute commit message; PR body also recorded `npm run test:unit` 80 passed
- [x] Demo: six scenarios PASS (phone 390×844 / desktop 1280×800) — `demo/demo-notes.md`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at `adda2dc` (create-pr-in-progress); reconfirmed `verify-workflow-paths.sh` exit 0 before this PR.md

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone + desktop poster-led detail verified against demo screenshots
