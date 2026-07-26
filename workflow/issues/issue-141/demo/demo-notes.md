# Demo notes — issue #141

- **Date:** 2026-07-26T14:55:00Z
- **Commit:** 6a75235 (demo evidence; tip e4c6bfa)
- **Branch:** `cursor/issue-141-pr-149-demo-agent-49e6` (base `cursor/issue-141-mobile-ui-app-shell`)
- **PR:** #149
- **Tier:** application
- **Viewport (phone):** 390×844 (Playwright `devices['iPhone 13']`, deviceScaleFactor 2)
- **Viewport (desktop):** 1280×800
- **pending-count used:** `{"metadata_count":1,"watch_review_count":0,"total":1}` (seeded `review_required` + pending `metadata_match_reviews` on Ready Film 0; left unresolved)

## Preconditions

- `docker compose ps`: postgres, api, frontend, backup **Up**
- Health API + frontend: `"status":"ok"`, `"database":"ok"`; frontend HTTP 200
- Part 2 seed: 12 films with ready enrichment (home shows recommendation entry, not empty-import CTA)
- Review badge seed: film set to `enrichment_status=review_required` + pending metadata match review (API pending-count requires both)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Bottom tabs on Home (phone) | **PASS** | [scenario-1-home-bottom-tabs.png](scenario-1-home-bottom-tabs.png) |
| 2a | More → Settings sync | **PASS** | [scenario-2-more-settings.png](scenario-2-more-settings.png) |
| 2b | History → no tab active | **PASS** | [scenario-2-history-no-tab.png](scenario-2-history-no-tab.png) |
| 3a | Header search → Home picker focus | **PASS** | [scenario-3-search-focused.png](scenario-3-search-focused.png) |
| 3b | Review badge (pending > 0) | **PASS** | [scenario-3-review-badge.png](scenario-3-review-badge.png) |
| 4a | Content clears tab bar | **PASS** | [scenario-4-scroll-clearance.png](scenario-4-scroll-clearance.png) |
| 4b | Desktop IA (four destinations only) | **PASS** | [scenario-4-desktop-ia.png](scenario-4-desktop-ia.png) |

### Scenario 1 — Bottom tabs on Home

- Exactly four bottom tabs: **Home**, **Watchlist**, **Recommend**, **More**
- Home active (`aria-current="page"`); no History/Settings tab labels
- Header: Cuebox brand, Search films control, Review badge (count 1)

### Scenario 2 — Active states + More → Settings

- `/watchlist*` → Watchlist active; `/recommend*` → Recommend active
- More → `/settings/sync` with Sync settings content; More active (`aria-current="page"`, `text-foreground`)
- `/history` → no bottom tab forced active (all tabs `aria-current=null`, muted styles)

### Scenario 3 — Header search + Review badge

- Header **Search films** → `/search` → Home; library search input focused (`#library-search-input`); Home then `router.replace("/")` strips `?focus=search` after focus (existing #140 behavior)
- Review badge visible with count **1**; navigates to `/review`
- No FAB on Home / Watchlist / Recommend

### Scenario 4 — Scroll clearance + desktop IA

- Watchlist scrolled to end: pagination + last rows clear of fixed tab bar (`main` `paddingBottom` ≈ 72px)
- Desktop 1280px: same four bottom tabs; History appears only as a Home content card (not a primary peer tab); Settings not a peer tab

## Gate evidence

```text
bash scripts/verify-workflow-paths.sh
… PASS: no legacy workflow paths found
EXIT:0
```

Also: `npm run test:unit -- --run src/components/app-shell.test.tsx` — 15 passed.

## Notes

- Captured via Playwright against the live Compose frontend (`localhost:3000`).
- Next.js floating “N” portal hidden via CSS for cleaner chrome shots.
- No secrets in images or notes.
