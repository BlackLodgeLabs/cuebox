# Demo notes — issue #158

- **Date:** 2026-07-30T14:40:16Z
- **Commit:** `79902b7b239596c1a1e07d1df0a46e5989e89268`
- **Branch:** `cursor/issue-158-shell-wayfinding-8cee` (artifacts merged from demo agent side-branch)
- **PR:** #164 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport:** 390×844 (Playwright `devices['iPhone 13']`, `deviceScaleFactor: 2`)
- **Stack:** Compose `postgres`, `api`, `frontend`, `backup` Up; `$APP_HEALTH_URL_API` + `$APP_HEALTH_URL_FRONTEND` → `"status":"ok"` / `"database":"ok"`; frontend HTTP 200
- **Seed:** Part 2 `python3 scripts/seed-dev-db.py` → **12** ready films; existing history session `c618464a-…` (The Matrix)
- **Mocks:** Scenario 2 import job status (`/api/v1/import/{jobId}/status` running stub); Scenario 3 pending review count (`/films/reviews/pending-count` → `total: 2`). Scenario 4 notch insets simulated via CSS `padding-top/bottom` override (no real device notch in VM).

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification (More hub + chrome) | **PASS** | [scenario-0-more-hub.png](scenario-0-more-hub.png), [scenario-0-sync-from-hub.png](scenario-0-sync-from-hub.png), [scenario-0-active-tab.png](scenario-0-active-tab.png), [scenario-0-history-offtab-chrome.png](scenario-0-history-offtab-chrome.png) |
| 1 | More active matrix | **PASS** | [scenario-1-more-active-on-settings.png](scenario-1-more-active-on-settings.png), [scenario-1-import-offtab.png](scenario-1-import-offtab.png) |
| 2 | Nested off-tab routes | **PASS** | [scenario-2-history-detail-chrome.png](scenario-2-history-detail-chrome.png), [scenario-2-import-job-chrome.png](scenario-2-import-job-chrome.png) |
| 3 | Design constraints intact | **PASS** | [scenario-3-shell-invariants.png](scenario-3-shell-invariants.png) |
| 4 | Safe-area on notched device (optional) | **PASS** (DOM + simulated inset) | [scenario-4-safe-area-notch.png](scenario-4-safe-area-notch.png) |

### Scenario 0 — contrasts vs bug-repro

| Bug-repro | After fix |
|-----------|-----------|
| `bug-repro-screenshot-2-more-lands-on-sync.png` — More → Sync | More → **`/more` hub** with Sync → Import → History rows |
| `bug-repro-screenshot-6-more-route-missing.png` — `/more` 404 | `/more` is a real hub page (HTTP 200) |
| `bug-repro-screenshot-1-home-tabs.png` — near-muted active | Active Home: `text-primary` `#aed0a3`, **font-weight 700**, top `data-active-indicator` bar (inactive `#c3c8bd`) |
| `bug-repro-screenshot-3-history-no-offtab-chrome.png` — no ← Home | History list shows **← Home** `min-h-11` (measured height **44px**) |
| Header `paddingTop: 0` / no viewport-fit | Sticky header class `pt-[env(safe-area-inset-top,0px)]`; viewport meta includes **`viewport-fit=cover`** |

Also verified: `/import` and `/review` each expose ← Home ≥44px; Sync from hub still shows CSV / watched / RSS sections with More `aria-current="page"`.

### Scenario 1 — More active matrix

- `/more` and `/settings/sync`: More has `aria-current="page"` + primary tint + indicator
- `/import` and `/history`: More **not** `aria-current`; ← Home off-tab chrome visible

### Scenario 2 — Nested routes

- `/history/{sessionId}`: ← Home above ceremony stage chrome (Matrix session; stage UI intact; no FAB / no fifth tab)
- `/import/{jobId}`: stubbed running job renders shared OffTabPageHeader ← Home (live job id unavailable)

### Scenario 3 — Shell invariants

- Exactly **four** bottom tabs (Home · Watchlist · Recommend · More); **no** History tab; **no** FAB
- Stubbed pending count **2** → Review badge in header (not a tab)
- Neo-Noir tokens preserved (dark card shell, primary accent)

### Scenario 4 — Safe-area

- DOM: header `pt-[env(safe-area-inset-top,0px)]`; tab bar `pb-[env(safe-area-inset-bottom,0px)]`; `viewport-fit=cover`
- Screenshot uses simulated 47px top / 34px bottom insets (Chrome notch mode unavailable in headless VM)

## Narrative

Phone shell wayfinding gaps from #158 are closed on the running Compose stack: More opens a hub first (Sync remains a destination), active tabs read clearly via primary + indicator + weight, sticky header declares top safe-area with `viewport-fit=cover`, and off-tab surfaces (History / Import / Review + nested detail/job) expose compact ← Home chrome without adding tabs or a FAB.

## Notes for babysit / create-pr

- Capture used a local Playwright script against Compose frontend (not committed)
- Next.js dev-tools badge hidden via CSS/DOM for screenshots
- PR #164 base confirmed `feature/mobile-ui`
- No secrets in images or notes

## Babysit outcome (2026-07-30)

- **Frontend CI:** success on `dd12e9b` (run 30555354656); API CI path-skipped (no `api/**` changes)
- **Merge:** `MERGEABLE` / `CLEAN` vs `feature/mobile-ui`; no review threads
- **Bugbot:** check suite remained `queued` across PR SHAs with **no** review comments / must-fix items; not treated as blocking (merge already CLEAN)
- **PR ready:** marked ready for review (`draft: false`); MCP `update_pull_request` lacked PAT scope — used `gh pr ready` fallback
- **Loops:** bugbot 0/3, ci_autofix 0/2, total_runs 6/10 → `stage: complete`
