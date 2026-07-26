# Demo notes — issue #142

- **Date:** 2026-07-26T17:12:00Z
- **Commit:** `docs(workflow): demo evidence for issue #142` on `cursor/issue-142-pr-150-demo-agent-60aa` (see branch tip)
- **Branch:** `cursor/issue-142-pr-150-demo-agent-60aa` (base `cursor/issue-142-home-hub-composition`)
- **PR:** #150
- **Tier:** application
- **Viewport (phone):** 390×844 (Playwright `devices['iPhone 13']`, deviceScaleFactor 2)
- **pending-count used:** `{"metadata_count":1,"watch_review_count":0,"total":1}` (film set to `review_required` so pending metadata review is counted; left unresolved)

## Preconditions

- `docker compose ps`: postgres, api, frontend, backup **Up**
- Health API + frontend: `"status":"ok"`, `"database":"ok"`; frontend HTTP 200
- Part 2 seed: 12 films with ready enrichment (after `python3 scripts/seed-dev-db.py`; home shows hub, not empty-import CTA)
- Empty-state capture used Playwright `page.route` stub of `GET /api/v1/films` → `total: 0` (seeded volume not wiped)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Returning-user hub (phone) | **PASS** | [scenario-1-home-hub.png](scenario-1-home-hub.png) |
| 2a | Create CTA → `/recommend` (1 tap) | **PASS** | [scenario-2-recommend.png](scenario-2-recommend.png) |
| 2b | History quick link → `/history` | **PASS** | [scenario-2-history.png](scenario-2-history.png) |
| 3 | Picker library-or-add + header search focus | **PASS** | [scenario-3-picker-focus.png](scenario-3-picker-focus.png) |
| 4 | Empty watchlist Import path | **PASS** | [scenario-4-empty-import.png](scenario-4-empty-import.png) |
| 5 | Review via shell badge only | **PASS** | [scenario-5-review-badge.png](scenario-5-review-badge.png) |

### Scenario 1 — Returning-user hub

- Single hub stack: headline **What do you want to watch?**, support copy, inline picker (`data-testid="library-search-input"`), primary **Create a recommendation**, secondary **History** text link
- No peer cards/links for View watchlist, Start questionnaire, New recommendation (card title), or Review now
- Bottom tabs: Home · Watchlist · Recommend · More; History is not a tab
- System status present and collapsed; does not dominate first viewport
- Content has shell `px-4` (16px-class) mobile margins

### Scenario 2 — ≤ 2 taps to recommend + History

- Home → **Create a recommendation** lands on `/recommend` (questionnaire Step 1) in one tap
- Recommend tab active on `/recommend` (shell); History still not a tab
- Home → **History** lands on `/history`; no History tab; Home remains the nearest shell active state for a non-tab route

### Scenario 3 — Picker tone + #140 focus regression

- Placeholder: `Find a film in your library or add one…`
- Helper: library + TMDB / archived note (library-or-add tone)
- No **Add a film** / **Mark watched** dual-intent links on Home
- Header **Search films** → `/search` → `/?focus=search` focuses `library-search-input` (gold focus ring visible)

### Scenario 4 — Empty Import path

- Mocked empty films list shows **Welcome to Cuebox** + primary **Import watchlist**
- Hub picker / Create CTA absent

### Scenario 5 — Review badge only

- Header Review badge shows count **1**; no **Review now** / Films need review card in hub
- Badge navigates to `/review`

## Narrative

Returning-user Home now reads as one phone-first hub: picker near the top, one primary Create CTA, and a lighter History link. Watchlist and Review stay in the #141 shell (tab + badge) instead of competing Home cards. Empty-state Import and header-search focus remain intact.
