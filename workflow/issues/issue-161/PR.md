## Related Issue

Closes #161

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/161)

## Description

**What does this PR do?**

Fixes phone thumb-ergonomics and sticky-chrome gaps on the shipped `feature/mobile-ui` flow (brief criterion **C**): questionnaire content clears sticky Back/Next + tab bar; library picker actions, Home History, and history-list remove meet ≥44×44px; Home search and questionnaire notes scroll into view on focus so they stay usable above the keyboard.

| Gap | Fix |
|-----|-----|
| Questionnaire content trapped under sticky Back/Next | Ceremony-class `pb-24` on `/recommend` + `data-testid="questionnaire-sticky-chrome"` |
| Picker View / Mark watched / TMDB add at 32px | `size="lg"` / `min-h-11`; stacked `flex-col` rows so ≥44px actions never squeeze the title |
| Home History thin 24px text link | Full-width outline `Button asChild` ≥44px; Create stays sole filled primary |
| History remove 40×40 | Ghost `min-h-11 min-w-11` (≥44×44) |
| Search / notes unusable under keyboard | `scrollIntoView({ block: "center" })` on focus (`scroll-field-into-view` helper) |

**Why is this the best approach?**

Questionnaire clearance mirrors the ceremony sticky pattern already shipped in #159 (`pb-24` + same tab-bar `bottom-[calc(4.5rem+…)]`), so clearance stays consistent across sticky chrome. Touch targets use the shared `Button` `lg` / `min-h-11` language already used by primary CTAs. Focus scroll reuses a small shared helper rather than a global keyboard framework. Execute kept stacked picker rows after `size="lg"` actions collapsed titles under the old `sm:flex-row` layout. Neo-Noir / no-FAB / questionnaire content-order-validation / API / Dev Mode stay unchanged. Draft PR **#163** remains based on **`feature/mobile-ui`** (do not retarget to `main`).

## Changes Proposed

* `recommend/page.tsx`: content wrapper `pb-4` → `pb-24`; sticky chrome testid; notes textarea focus → `scrollFieldIntoView`
* `library-search-picker.tsx`: row actions `size="lg"` / `min-h-11`; stacked hit rows (no `sm:flex-row` squeeze); search input focus scroll
* `page.tsx` (Home): History as full-width outline `Button asChild` ≥44px under sole filled Create CTA
* `history/page.tsx`: remove control `min-h-11 min-w-11`
* `scroll-field-into-view.ts` (+ unit test): shared `scrollIntoView({ block: "center" })` helper
* Unit + Playwright regressions: questionnaire inset / sticky clearance; picker + History + remove ≥44px; focus-scroll hooks
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, bug-repro + scenario screenshots under `workflow/issues/issue-161/demo/`

**Explicitly unchanged:** Questionnaire step definitions / validation; ceremony sticky (#159); shell / More hub (#158); surface clarity (#160); `api/` / DB / sync; Neo-Noir tokens; no FAB; Developer Mode.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `devices['iPhone 13']`). Seeded 2 films + 1 history session. Scenario 5 real virtual keyboard is **manual / blocked in VM** (headless Chromium); Scenarios 3–4 cover focus-scroll hooks.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification (targets + inset) | **PASS** | screenshots below |
| 1 | Questionnaire sticky chrome usable | **PASS** | screenshot below |
| 2 | Home History secondary weight | **PASS** | screenshot below |
| 3 | Focus scroll — Home search | **PASS** | screenshot below |
| 4 | Focus scroll — questionnaire notes | **PASS** | screenshot below |
| 5 | Manual keyboard audit (iPhone-class) | **PASS*** | screenshots below (VKB manual / blocked in VM) |
| 6 | Design constraints smoke | **PASS** | screenshot below |

\*Scenario 5: real virtual keyboard not available headless; relied on Scenarios 3–4 focus-scroll + screenshots.

![Scenario 0 — Home History 44px](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-0-home-history-44.png)

![Scenario 0 — Picker actions 44px](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-0-picker-actions-44.png)

![Scenario 0 — History remove 44px](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-0-history-remove-44.png)

![Scenario 0 — Questionnaire clearance](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-0-questionnaire-clearance.png)

![Scenario 1 — Sticky Next usable](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-1-sticky-next-usable.png)

![Scenario 2 — Home CTA hierarchy](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-2-home-cta-hierarchy.png)

![Scenario 3 — Search focus scroll](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-3-search-focus-scroll.png)

![Scenario 4 — Notes focus scroll](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-4-notes-focus-scroll.png)

![Scenario 5 — Keyboard search](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-5-keyboard-search.png)

![Scenario 5 — Keyboard notes](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-5-keyboard-notes.png)

![Scenario 6 — No FAB / Neo-Noir](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8f519f6fef73a131133335507096549fd0d8c8dc/workflow/issues/issue-161/demo/scenario-6-no-fab-noir.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-161-thumb-ergonomics-sticky-chrome-4647
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Phone viewport ~390×844 — questionnaire inset:
   - Open `/recommend`, advance to Genres, scroll through chips
   - Mid-scroll: chips must not sit permanently under sticky Back/Next (`data-testid="questionnaire-sticky-chrome"`)
   - Max-scroll: last chip clears sticky; sticky stays above the tab bar
4. Touch targets ≥44×44:
   - Home: History outline button ≥44px tall, secondary to filled **Create a recommendation**
   - Library search (Home): View / Mark watched (and TMDB add if shown) ≥44×44; titles still readable (stacked rows)
   - History list: remove ✕ ≥44×44, light ghost weight
5. Focus scroll:
   - Tap Home library search → input scrolls into view (`block: "center"`)
   - Questionnaire → Notes → focus textarea → field + sticky **Get recommendation** remain reachable
6. Manual (real device / iPhone Chrome): open virtual keyboard on search + notes; confirm no permanent dead-end under VKB
7. Design constraints: Neo-Noir dark UI; no FAB; questionnaire Genres / Notes content unchanged
8. Unit + targeted Playwright (optional local):
   ```bash
   cd frontend && npm run test:unit && npx tsc --noEmit
   cd frontend && npx playwright test \
     e2e/questionnaire-mobile.spec.ts \
     e2e/library-search-picker.spec.ts \
     e2e/history-delete.spec.ts \
     e2e/app-shell-mobile.spec.ts
   ```
9. Gate (PLAN / execute):
   ```bash
   # Host pytest: use reachable DB, not compose hostname `postgres`
   export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
   export TEST_DATABASE_URL=$DATABASE_URL
   # Host build gotcha: stop Compose frontend and sudo rm -rf frontend/.next first (AGENTS.md)
   bash scripts/verify-phase8-gates.sh
   ```

## Known Issues / Notes for Reviewer

* Capture helper was a local Playwright script against the running Compose frontend; not committed.
* Planning `bug-repro-*` artifacts retained under `demo/` for before/after contrast (History 24px → 44px; picker 32px → 44px; remove 40→44; `pb-4` → `pb-24`).
* Scenario 5 real iPhone-class virtual keyboard is **manual / blocked in this VM** (headless Chromium). Focus-scroll Scenarios 3–4 passed; please spot-check VKB on a real phone if practical.
* Execute layout revision: stacked picker rows required so `size="lg"` actions do not collapse titles (documented in PLAN).
* No Alembic / API / config changes — frontend layout only. Restart frontend after pull if the Compose volume is stale.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #163.
* Demo volume used a Tier-3-like watchlist (2 ready films + 1 history session); sufficient for Home / picker / history remove / questionnaire.

## Gate evidence

- [x] Phase 8 gate (`scripts/verify-phase8-gates.sh`) + targeted mobile Playwright + unit/tsc green at execute-ready (`5473316`) — per execute commit message
- [x] Demo: seven scenarios PASS (phone 390×844; Scenario 5 VKB manual/blocked in VM) — `demo/demo-notes.md` at `8f519f6`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at demo tip (`8f519f6`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated for the changes
- [ ] Docs updated if behavior or public API changed
- [ ] No secrets or PII in the diff or PR body
- [ ] Draft PR #163 stays based on `feature/mobile-ui`
