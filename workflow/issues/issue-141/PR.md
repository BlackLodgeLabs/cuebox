## Related Issue

Closes #141

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/141)

## Description

**What does this PR do?**

Rewrites the Cuebox `AppShell` from a five-item top horizontal nav (Home · Watchlist · Recommend · History · Settings, plus Search and Review in the same strip) into the phone-first chrome locked in the mobile product brief (**D3**): a slim top header (Cuebox brand, Search films → `/search`, conditional Review badge → `/review`) and a fixed bottom tab bar (**Home · Watchlist · Recommend · More**). More opens Settings (`/settings/sync`); History is reachable from Home / `/history` only — not a primary tab. Main content gets bottom safe-area padding so the tab bar never obscures page content. No FAB. Neo-Noir tokens preserved; `#140` search alias behavior is unchanged.

**Why is this the best approach?**

~90% of use is phone-first, so one shared IA at all breakpoints (bottom tabs + header chrome on desktop too) avoids History/Settings reappearing as peer primary tabs and gives later mobile slices (#142–#146) a single shell to build on. Frontend-only: no API, DB, or config changes.

## Changes Proposed

* Rewrote `frontend/src/components/app-shell.tsx` — slim header + fixed Home/Watchlist/Recommend/More bottom tabs, active-state rules, safe-area main padding, no History/Settings peer tabs, no FAB
* Expanded `frontend/src/components/app-shell.test.tsx` — tab IA, More → settings, Review badge, search, active states, history-not-a-tab
* Added `frontend/e2e/app-shell-mobile.spec.ts` — Playwright coverage for phone chrome (tabs, More, Review badge, search, scroll clearance)
* Hardened E2E assertions (`b97ff94`) and disambiguated import-toast text match (`35f8a49`) so shell/regression specs stay green under Playwright strict mode
* Touched `frontend/e2e/pr-review-regression.spec.ts` for Home link selector compatibility
* Documented app chrome IA in `documents/DESIGN.md` (one paragraph under Component Layout & Shapes)
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and seven scenario screenshots under `workflow/issues/issue-141/demo/`

**Explicitly unchanged:** API / Alembic / `config.yaml`; `/search`, Home picker, Review, History, and Settings **page** content; sibling mobile slices (#142–#146).

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844 iPhone 13; desktop 1280×800). Pending-count seed: `{"metadata_count":1,"watch_review_count":0,"total":1}`.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Bottom tabs on Home (phone) | **PASS** | screenshot below |
| 2a | More → Settings sync | **PASS** | screenshot below |
| 2b | History → no tab active | **PASS** | screenshot below |
| 3a | Header search → Home picker focus | **PASS** | screenshot below |
| 3b | Review badge (pending > 0) | **PASS** | screenshot below |
| 4a | Content clears tab bar | **PASS** | screenshot below |
| 4b | Desktop IA (four destinations only) | **PASS** | screenshot below |

![Scenario 1 — Bottom tabs on Home](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-1-home-bottom-tabs.png)

![Scenario 2a — More → Settings sync](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-2-more-settings.png)

![Scenario 2b — History with no tab active](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-2-history-no-tab.png)

![Scenario 3a — Header search focused](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-3-search-focused.png)

![Scenario 3b — Review badge (count 1)](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-3-review-badge.png)

![Scenario 4a — Scroll clearance above tab bar](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-4-scroll-clearance.png)

![Scenario 4b — Desktop IA (four destinations)](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/6a752353144080ac85e70511b4ae5b2a9f420c47/workflow/issues/issue-141/demo/scenario-4-desktop-ia.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-141-mobile-ui-app-shell
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`.
3. Open `http://localhost:3000` at ~390px width (or DevTools device mode):
   - Exactly four bottom tabs: **Home · Watchlist · Recommend · More** (no History/Settings tab labels)
   - Header shows Cuebox brand, **Search films**, and Review badge when pending count > 0
4. Tap **More** → lands on `/settings/sync` with More still active (`aria-current="page"`).
5. Open `/history` (Home history card or address bar) → no bottom tab forced active.
6. Tap header **Search films** → `/search` → Home picker focused (`#library-search-input`); `#140` `?focus=search` strip behavior still works.
7. With a pending review seed, tap the Review badge → `/review`.
8. On Watchlist, scroll to the end — pagination/last rows clear the fixed tab bar (`main` bottom padding / safe-area).
9. At ≥768px (e.g. 1280×800): same four bottom tabs; History only as Home content, not a peer tab.
10. Unit + E2E (optional local):
    ```bash
    cd frontend && npm run test:unit -- --run src/components/app-shell.test.tsx
    cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/app-shell-mobile.spec.ts
    ```
11. Gate (PLAN / execute):
    ```bash
    bash scripts/verify-phase6-gates.sh
    ```

## Known Issues / Notes for Reviewer

* Demo seeded a `review_required` film plus pending `metadata_match_reviews` so the Review badge shows count **1** (API pending-count requires both).
* Next.js floating “N” portal was hidden via CSS during demo captures for cleaner chrome shots.
* Desktop keeps the **same** bottom-tab chrome (SPEC recommended default) — not a separate top-nav desktop IA.
* No migrations or config changes; restart frontend only if the Compose bind mount has not picked up `app-shell.tsx`.
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute commit notes Phase 6/8 green at execute-ready.

## Gate evidence

- [x] Phase 6 / Phase 8 gates green at execute-ready (`2d54d5b`) — per execute commit message
- [x] `npm run test:unit -- --run src/components/app-shell.test.tsx` — 15 passed (demo)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0` at `6a75235` (demo)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone + desktop IA verified against demo screenshots
