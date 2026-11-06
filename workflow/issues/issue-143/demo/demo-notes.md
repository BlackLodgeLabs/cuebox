# Demo notes — issue #143

- **Date:** 2026-07-26T19:13:43Z
- **Commit:** `docs(workflow): demo evidence for issue #143` on `cursor/issue-143-pr-151-demo-agent-c2d3` (see branch tip)
- **Branch:** `cursor/issue-143-pr-151-demo-agent-c2d3` (base `cursor/issue-143-watchlist-poster-grid`)
- **PR:** #151 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport (phone):** 390×844 (Playwright `devices['iPhone 13']`, deviceScaleFactor 2)
- **Viewport (desktop):** 1280×800

## Preconditions

- `docker compose ps`: postgres, api, frontend, backup **Up**
- Health API + frontend: `"status":"ok"`, `"database":"ok"`; frontend HTTP 200
- Part 2 seed: 12 films (`python3 scripts/seed-dev-db.py`); Ready Film poster URLs pointed at live TMDB assets for capture quality (seed defaults use non-existent `seed-poster-N.jpg` paths)
- Ambiguous Title remains **NO POSTER** (visible on desktop grid)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Poster-first grid (phone) | **PASS** | [scenario-1-poster-grid.png](scenario-1-poster-grid.png) |
| 2a | ⋯ status actions menu | **PASS** | [scenario-2-overflow-menu.png](scenario-2-overflow-menu.png) |
| 2b | Poster/title → film detail | **PASS** | [scenario-2-film-detail.png](scenario-2-film-detail.png) |
| 3a | Filter / sort sheet open | **PASS** | [scenario-3-filter-sheet.png](scenario-3-filter-sheet.png) |
| 3b | Apply narrows grid | **PASS** | [scenario-3-filter-applied.png](scenario-3-filter-applied.png) |
| 4a | Watched tab empty copy | **PASS** | [scenario-4-watched-tab.png](scenario-4-watched-tab.png) |
| 4b | Archived tab empty copy | **PASS** | [scenario-4-archived-tab.png](scenario-4-archived-tab.png) |
| 5 | Desktop denser grid | **PASS** | [scenario-5-desktop-grid.png](scenario-5-desktop-grid.png) |

### Scenario 1 — Poster-first grid (phone)

- `/watchlist` at 390×844: 2-column poster grid with titles below only
- No year / enrichment badges / RT / date columns in cells; no table headers
- Status tabs Watchlist / Watched / Archived present; **Filter** control in page chrome
- Shell header search icon separate from Filter; **Add film** present
- Bottom tabs Home · Watchlist · Recommend · More; Watchlist active; content clears tab bar

### Scenario 2 — ⋯ status actions + detail

- ⋯ opens menu with **Mark watched** / **Archive** without navigating away
- Hit target ≥44px (`min-h/w-[44px]` on trigger)
- Title tap lands on `/watchlist/{id}?tab=active` detail; back link to Watchlist

### Scenario 3 — Filter / sort sheet Apply + Clear

- Filter opens bottom sheet: search, enrichment, year, sort, direction, added-from/to
- Apply `search=Ready Film 9` → sheet closes; subtitle **1 film on your watchlist**; single matching card; Filter control highlighted
- Clear restores broader 12-film list (verified in capture flow before Scenario 4)

### Scenario 4 — Status tabs

- Watched: URL `tab=watched`; empty copy “No watched films yet…”
- Archived: URL `tab=archived`; empty copy “No archived films…”
- No metadata table on either tab

### Scenario 5 — Desktop denser grid

- 1280px: multi-column poster + title grid (not a sortable metadata table)
- One **NO POSTER** cell present (Ambiguous Title); others show posters + titles + ⋯

## Narrative

Watchlist is a phone-first poster grid: posters and titles only, status actions behind ⋯, and filters behind an Apply/Clear sheet. Watched/Archived keep the same metaphor (empty copy when empty). Desktop adds columns without regressing to a table.

## Notes

- No secrets in images or logs
- Capture used live Docker stack at `http://localhost:3000` via Playwright Chromium

## Babysit notes

- 2026-07-26: PR #151 marked ready for review after Frontend CI success on `652279c`; no Bugbot review threads; mergeable CLEAN prior to ready toggle.
- Loops at complete: bugbot=0/3, ci_autofix=0/2, total_runs=6/10.
- Cursor/Vercel check suites remain queued (same non-blocking pattern as #141/#142); required GitHub Actions checks green.

