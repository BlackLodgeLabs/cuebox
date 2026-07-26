## Related Issue

Closes #142

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/142)

## Description

**What does this PR do?**

Recomposes returning-user Home (`frontend/src/app/page.tsx`) from a peer-card dashboard into a single phone-first **hub**: short headline + support copy, inline `LibrarySearchPicker` near the top, primary **Create a recommendation** → `/recommend`, and a lighter **History** link → `/history`. Removes Home peer cards for Watchlist and Review (those stay in the #141 shell — Watchlist tab + header Review badge). Empty-watchlist **Import watchlist** remains the obvious first action. Picker behavior is unchanged (#140); only library-or-add placeholder/helper tone is updated via optional props.

**Why is this the best approach?**

Brief **D4** jobs need a clear hierarchy on Home. Peer cards duplicated shell destinations and diluted Recommend/History. One vertical hub keeps Job 1 (picker), Job 2 (create recommendation, ≤ 2 taps), and Job 3 (History) stacked without competing CTAs. Frontend-only: no API, DB, or config changes. PR base stays `feature/mobile-ui` (draft #150).

## Changes Proposed

* Rewrote `frontend/src/app/page.tsx` returning-user layout — single hub stack (picker → **Create a recommendation** → **History**); dropped Watchlist/Review peer cards and unused pending/watchlist-count hooks
* Added optional `placeholder` / `helperText` on `LibrarySearchPicker` for library-or-add tone (`Find a film in your library or add one…`); `data-testid="library-search-input"` and merge/action behavior unchanged
* Added `frontend/src/app/page.test.tsx` — hub CTAs, picker presence, empty Import, no Review/Watchlist peer cards
* Updated picker unit tests plus E2E (`library-search-picker.spec.ts`, `watchlist-add.spec.ts`) for new CTA labels and hub assertions
* One-line **Home hub** composition note in `documents/DESIGN.md`
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and six scenario screenshots under `workflow/issues/issue-142/demo/`

**Explicitly unchanged:** `app-shell.tsx` (#141); picker result actions / merge APIs; API / Alembic / `config.yaml`; sibling mobile slices (#143–#146).

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `iPhone 13`). Pending-count seed: `{"metadata_count":1,"watch_review_count":0,"total":1}` (one `review_required` film left unresolved). Empty-state capture stubbed `GET /api/v1/films` → `total: 0`.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Returning-user hub (phone) | **PASS** | screenshot below |
| 2a | Create CTA → `/recommend` (1 tap) | **PASS** | screenshot below |
| 2b | History quick link → `/history` | **PASS** | screenshot below |
| 3 | Picker library-or-add + header search focus | **PASS** | screenshot below |
| 4 | Empty watchlist Import path | **PASS** | screenshot below |
| 5 | Review via shell badge only | **PASS** | screenshot below |

![Scenario 1 — Returning-user hub](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-1-home-hub.png)

![Scenario 2a — Create a recommendation](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-2-recommend.png)

![Scenario 2b — History](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-2-history.png)

![Scenario 3 — Picker focus](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-3-picker-focus.png)

![Scenario 4 — Empty Import](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-4-empty-import.png)

![Scenario 5 — Review badge only](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c2254cb8d2bc8464f0d10abf9595b037259cbcdd/workflow/issues/issue-142/demo/scenario-5-review-badge.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-142-home-hub-composition
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Open `http://localhost:3000` at ~390px width (or DevTools device mode) with a seeded watchlist:
   - Hub headline **What do you want to watch?**
   - Inline picker near the top (`data-testid="library-search-input"`)
   - Primary **Create a recommendation** (full-width)
   - Secondary **History** text link
   - No Home peer cards/links for **View watchlist**, **Review now**, **Start questionnaire**, or **New recommendation**
4. Tap **Create a recommendation** → lands on `/recommend` in one tap (questionnaire Step 1); Recommend tab active.
5. Back to Home → tap **History** → `/history` (History is not a bottom tab).
6. Confirm picker placeholder/helper is library-or-add tone; no dual-intent Add/Mark watched CTAs on Home.
7. Header **Search films** → `/search` → `/?focus=search` focuses the Home picker (gold focus ring).
8. With pending review > 0, header Review badge shows the count and navigates to `/review` — no Review card on Home.
9. Empty watchlist (or stub films `total: 0`): **Welcome to Cuebox** + primary **Import watchlist**; hub picker / Create CTA absent.
10. Unit + targeted E2E (optional local):
    ```bash
    cd frontend && npm run test:unit -- --run src/app/page.test.tsx src/components/library-search-picker.test.tsx
    cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test \
      e2e/library-search-picker.spec.ts \
      e2e/watchlist-add.spec.ts \
      e2e/app-shell-mobile.spec.ts
    ```
11. Gate (PLAN / execute):
    ```bash
    bash scripts/verify-phase6-gates.sh
    ```

## Known Issues / Notes for Reviewer

* Demo left one film in `review_required` so the Review badge shows count **1**; empty-state screenshot used a Playwright route stub rather than wiping the seeded volume.
* System status remains on Home but collapsed / secondary — not first-viewport dominant.
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute marked Phase 6 + unit + targeted E2E green at execute-ready.
* No migrations or config changes; restart frontend only if the Compose bind mount has not picked up `page.tsx` / picker props.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #150.

## Gate evidence

- [x] Phase 6 gate + frontend unit/tsc + targeted E2E green at execute-ready (`fc1397b`) — per execute commit message
- [x] Demo: six scenarios PASS (phone 390×844) — `demo/demo-notes.md`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at `4e595ed` (create-pr)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone hub composition verified against demo screenshots
