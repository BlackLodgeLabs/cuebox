## Related Issue

Closes #158

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/158)

## Description

**What does this PR do?**

Fixes phone shell wayfinding gaps on the shipped `feature/mobile-ui` app shell (brief criterion **D3**): More opens a real hub instead of dumping users on Sync; the sticky header clears top safe-area; active tabs read clearly; Review / History / Import expose compact ← Home chrome.

| Gap | Fix |
|-----|-----|
| More → Sync shortcut; `/more` 404 | New `/more` hub (Sync → Import → History); More tab `href` → `/more` |
| Sticky header `paddingTop: 0` / no `viewport-fit` | Header `pt-[env(safe-area-inset-top,0px)]`; layout `viewportFit: "cover"` |
| Active tab near-muted (`#e3e3de` vs `#c3c8bd`) | Active: `text-primary` + filled icon + top `data-active-indicator` + `font-bold` |
| Review / History / Import title-only | Shared `OffTabPageHeader` with ← Home (`min-h-11`) on list + nested routes |

**Why is this the best approach?**

More stays a fourth primary tab with a destination hub rather than a Sync deep-link, matching the locked D3 tab set (Home · Watchlist · Recommend · More). Sync remains at `/settings/sync` with CSV / watched / RSS unchanged — hub is additive. Active affordances use existing Neo-Noir tokens (`text-primary`, indicator bar, weight) instead of a new chrome system. Off-tab ← Home mirrors the film-detail light back strip via a shared helper so Review / History / Import stay consistent without a second nav bar, FAB, or History tab. No API / DB / sync-protocol changes; siblings #159–#161 surfaces untouched. Draft PR **#164** remains based on **`feature/mobile-ui`** (do not retarget to `main`).

## Changes Proposed

* `frontend/src/app/more/page.tsx` (+ unit): More hub link rows — Sync → `/settings/sync`, Import → `/import`, History → `/history` (locked order)
* `frontend/src/components/app-shell.tsx` (+ unit): More → `/more`; `isActive` on `/more` + `/settings*`; sticky header top safe-area; active tab primary + indicator + bold weight
* `frontend/src/app/layout.tsx`: Next.js `viewportFit: "cover"`
* `frontend/src/components/off-tab-page-header.tsx` (+ unit): shared ← Home (`min-h-11`) + title strip
* Wire `OffTabPageHeader` on Review, History list/detail, Import list/job status
* `frontend/e2e/app-shell-mobile.spec.ts`: More→hub (not Sync), active matrix, safe-area / affordance checks
* Follow-up unit fix: assert active tab weight on the label span (not the link root)
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, bug-repro + scenario screenshots under `workflow/issues/issue-158/demo/`

**Explicitly unchanged:** Sync page capabilities / API; tab set / Review header badge / Search; ceremony / questionnaire / picker (#159 / #161); surface clarity (#160); `api/` / DB / sync protocol; FAB / History as fifth tab; Neo-Noir tokens; Developer Mode.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `devices['iPhone 13']`). Part 2 seed → 12 ready films + existing Matrix history session. Scenario 4 uses simulated notch insets (no real device notch in VM).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification (More hub + chrome) | **PASS** | screenshots below |
| 1 | More active matrix | **PASS** | screenshots below |
| 2 | Nested off-tab routes | **PASS** | screenshots below |
| 3 | Design constraints intact | **PASS** | screenshot below |
| 4 | Safe-area on notched device (optional) | **PASS** (DOM + simulated inset) | screenshot below |

![Scenario 0 — More hub](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-0-more-hub.png)

![Scenario 0 — Sync from hub](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-0-sync-from-hub.png)

![Scenario 0 — Active tab](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-0-active-tab.png)

![Scenario 0 — History ← Home](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-0-history-offtab-chrome.png)

![Scenario 1 — More active on settings](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-1-more-active-on-settings.png)

![Scenario 1 — Import off-tab chrome](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-1-import-offtab.png)

![Scenario 2 — History detail chrome](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-2-history-detail-chrome.png)

![Scenario 2 — Import job chrome](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-2-import-job-chrome.png)

![Scenario 3 — Shell invariants](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-3-shell-invariants.png)

![Scenario 4 — Safe-area notch](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4f25fba5b07c31bf90b56d198d5fce4088173d5a/workflow/issues/issue-158/demo/scenario-4-safe-area-notch.png)

### Scenario 0 — contrasts vs bug-repro

| Bug-repro | After fix |
|-----------|-----------|
| More → Sync | More → `/more` hub with Sync → Import → History |
| `/more` 404 | `/more` hub page (HTTP 200) |
| Near-muted active | Active Home: `text-primary` `#aed0a3`, font-weight 700, top indicator |
| History no ← Home | History list ← Home `min-h-11` (measured 44px) |
| Header no top safe-area | `pt-[env(safe-area-inset-top,0px)]` + `viewport-fit=cover` |

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-158-shell-wayfinding-8cee
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Phone viewport ~390×844 — More hub:
   - Tap **More** → lands on `/more` (not Sync)
   - Hub order: Sync → Import → History
   - Open Sync from hub → `/settings/sync` still shows CSV / watched / RSS; More stays `aria-current="page"`
4. Active tab affordance:
   - On Home / Watchlist / Recommend / More: active tab shows primary tint + top indicator + bold label; inactive stay muted
   - On `/import` or `/history`: More is **not** `aria-current`
5. Top safe-area:
   - Sticky header uses `pt-[env(safe-area-inset-top,0px)]`; viewport meta includes `viewport-fit=cover`
   - Bottom tab bar safe-area padding preserved
6. Off-tab ← Home chrome (≥44px):
   - `/review`, `/history`, `/import` — ← Home → `/`
   - Nested: `/history/{sessionId}`, `/import/{jobId}` — ← Home outside ceremony / job UI
7. Design constraints: exactly four tabs (Home · Watchlist · Recommend · More); no History tab; no FAB; Review stays header badge; Neo-Noir dark UI
8. Unit + targeted Playwright (optional local):
   ```bash
   cd frontend && npm run test:unit && npx tsc --noEmit
   cd frontend && npx playwright test e2e/app-shell-mobile.spec.ts
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

* Capture used a local Playwright script against the running Compose frontend; not committed.
* Planning `bug-repro-*` artifacts retained under `demo/` for before/after contrast (More→Sync, missing `/more`, muted active, absent ← Home).
* Scenario 4 real device notch is **simulated** in the VM (CSS inset override); DOM classes for top/bottom safe-area + `viewport-fit=cover` verified.
* Scenario 2 import job used a stubbed running status (live job id unavailable); ← Home chrome still rendered via shared header.
* Next.js dev-tools badge hidden via CSS/DOM for screenshots.
* No Alembic / API / config changes — frontend shell / routing only. Restart frontend after pull if the Compose volume is stale.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #164.
* Demo seed: Part 2 watchlist (12 ready films) + existing Matrix history session.

## Gate evidence

- [x] Phase 8 gate (`scripts/verify-phase8-gates.sh`) + unit/tsc + `app-shell-mobile` Playwright green at execute-ready (`52f4b02`) — per execute commit message
- [x] Demo: five scenarios PASS (phone 390×844; Scenario 4 notch simulated) — `demo/demo-notes.md` (artifact commit `4f25fba`; notes tip SHA `79902b7`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated for the changes
- [ ] Docs updated if behavior or public API changed
- [ ] No secrets or PII in the diff or PR body
- [ ] Draft PR #164 stays based on `feature/mobile-ui`
