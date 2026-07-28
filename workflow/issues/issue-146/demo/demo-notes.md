# Demo notes — issue #146

- **Date:** 2026-07-28T21:20:00Z
- **Commit:** `docs(workflow): demo evidence for issue #146` on `cursor/issue-146-pr-156-demo-agent-9ce2` tip (see `git log -1`)
- **Branch:** `cursor/issue-146-pr-156-demo-agent-9ce2` (base `cursor/issue-146-questionnaire-first-run`)
- **PR:** #156 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport:** 390×844 (Playwright `devices['iPhone 13']`)
- **Stack:** Compose `postgres`, `api`, `frontend`, `backup` Up; health API + frontend proxy `"status":"ok"` / `"database":"ok"`; frontend HTTP 200
- **Seed:** Part 2 `python3 scripts/seed-dev-db.py` → **12** ready films (volume had 2; seed added 10)
- **Mocks:** Scenario 2 import job status + failure URI; Scenario 3 pending review list + Review badge count; Scenario 6 questionnaire POST `/recommendations` + session detail (ceremony stage-1 handoff). Scenarios 1/4/5 use live stack routes.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Questionnaire density + progress + Next (phone) | **PASS** | [scenario-1-questionnaire-phone.png](scenario-1-questionnaire-phone.png), [scenario-1-questionnaire-chips.png](scenario-1-questionnaire-chips.png) |
| 2 | Import upload + job progress (phone) | **PASS** | [scenario-2-import-upload.png](scenario-2-import-upload.png), [scenario-2-import-job-status.png](scenario-2-import-job-status.png) |
| 3 | Match review resolve actions (phone) | **PASS** | [scenario-3-review-actions.png](scenario-3-review-actions.png) |
| 4 | More → Sync/settings density (phone) | **PASS** | [scenario-4-settings-sync.png](scenario-4-settings-sync.png) |
| 5 | Reduced-motion step change (optional) | **PASS** | [scenario-5-reduced-motion.png](scenario-5-reduced-motion.png) |
| 6 | Ceremony handoff unchanged (smoke) | **PASS** | [scenario-6-ceremony-handoff.png](scenario-6-ceremony-handoff.png) |

### Scenario 1 — Questionnaire

- Single `h1` (**Genres**); progress **Step 1 of 11** + **1 / 11** + thin bar (`aria-label` questionnaire progress)
- Sticky **Back** / **Next** above tab bar; measured **Next** height **44px**; **No Preference** chip **44px**
- No horizontal overflow (`scrollWidth <= clientWidth`)
- Optional chips shot with Horror selection path

### Scenario 2 — Import

- Phone upload: **Tap to choose a CSV** + **Choose file** primary (**44px**); **Start import** **44px**
- Mocked complete job: aggregates Processed/Failed/Duplicates/Total; long Letterboxd URI wraps (`break-all`); **Review matches (1)** CTA **44px**

### Scenario 3 — Review

- Live pending count was `0` → mocked pending list + badge count **2**
- Tapped header **Review** badge → `/review`
- **Accept** / **Reject** / **Choose different match** each **44px**; single-column stack

### Scenario 4 — Sync

- **More** tab → `/settings/sync`
- CSV re-sync, Import watched history (3 compact pickers), RSS sync + status all present; RSS description fully readable; 4 **Choose file** controls (compact)

### Scenario 5 — Reduced motion

- `emulateMedia({ reducedMotion: 'reduce' })`; advanced Genres → Runtime (**Step 2 of 11**) without ceremony-level motion

### Scenario 6 — Ceremony handoff

- Mocked create recommendation after walking questionnaire → URL `/recommend/results/{id}?stage=1`
- Stage-1 chrome: **1 / 3**, **TOP PICK**, singular winner **Ceremony Winner (1973)**, short Key factors / Why it matches, **Next** — no ceremony restyle in this slice

## Narrative

First-run and supporting surfaces are phone-usable: questionnaire shows one title stack with progress + ≥44px Next; import emphasizes Choose file and wraps failure URIs; review resolve actions are thumb-sized via the Review badge; More → sync keeps CSV / watched / RSS operable under compact pickers. Questionnaire submit still arms ceremony and lands on `?stage=1`.

## Notes for babysit / create-pr

- Capture helper was a local Playwright script against the running Compose frontend (`PLAYWRIGHT_E2E_STACK=1`); not committed
- Scenario 2a empty-home Import CTA skipped (would require emptying Part 2 volume); home already links Import watchlist → `/import` per #142 unit/e2e coverage
- PR #156 base confirmed `feature/mobile-ui`
- No secrets in images or notes
