# Demo notes — issue #144

- **Date:** 2026-07-27T08:05:00Z
- **Commit:** `docs(workflow): demo evidence for issue #144` on `cursor/issue-144-pr-152-demo-agent-7abe` tip (see `git log -1`)
- **Branch:** `cursor/issue-144-pr-152-demo-agent-7abe` (base `cursor/issue-144-mobile-ui-film-detail`)
- **PR:** #152 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport (phone):** 390×844 (Playwright `devices['iPhone 13']`; captures at 2× where noted)
- **Film under test (ready):** `b3714da2-1efd-4fc5-9768-12cfa12abcd4` — *The Matrix* (1999), poster + TMDB/IMDb IDs
- **Film under test (degrade):** `d7f420da-e6c4-42d9-9248-be3d18884c9e` — *Ambiguous Title* (failed enrichment, null metadata / no poster)

## Preconditions

- `docker compose ps`: postgres, api, frontend, backup **Up**
- Health API + frontend: `"status":"ok"`, `"database":"ok"`; frontend HTTP 200
- Part 2 seed: ran `python3 scripts/seed-dev-db.py` (volume previously had only 2 films); **12** films total, **≥10 ready**
- #141 shell present: Cuebox header search + bottom tabs (Home / Watchlist / Recommend / More)
- Scenario 3 used a temporary Playwright `page.route` stub of watch-providers → empty categories so the W2W card stayed compact enough to composite with **Links** in one artifact (live providers also verified reachable; empty UK listing chrome is acceptable per spec)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Poster-led first viewport (phone) | **PASS** | [scenario-1-poster-led-phone.png](scenario-1-poster-led-phone.png) |
| 2 | Status actions + hit targets | **PASS** | [scenario-2-status-actions.png](scenario-2-status-actions.png) |
| 3 | Where-to-watch + external links | **PASS** | [scenario-3-where-to-watch-links.png](scenario-3-where-to-watch-links.png) |
| 4 | Back navigation `?tab=watched` | **PASS** | [scenario-4-back-nav.png](scenario-4-back-nav.png) |
| 5 | Graceful degrade (no poster / failed) | **PASS** | [scenario-5-degrade.png](scenario-5-degrade.png) |
| 6 | Desktop poster-led metaphor | **PASS** | [scenario-6-desktop.png](scenario-6-desktop.png) |

### Scenario 1 — Poster-led first viewport

- Large `FilmPoster` `size="fill"` dominates the phone first viewport (poster ~320×480 CSS px; clearly larger than the old ~120×180 inset)
- No full-bleed backdrop-overlay hero with tiny poster chrome
- Title / Ready + active badges / Edit + status actions sit immediately under the poster in the same vertical scan (title starts just below the fold on 390×844 — short scroll; composition is poster-led, not a peer-card collage)
- Shell `px-4` margins; bottom tabs clear content

### Scenario 2 — Status actions

- **Mark watched** and **Archive** visible without hover on an active film
- Measured hit targets: **Mark watched** / **Archive** / **Edit film match** all **44px** tall (`min-h-11`)
- **Edit film match** reachable above the status row
- Capture shows actions row + Overview beginning below (did not complete Mark watched transition)

### Scenario 3 — Where to watch + links

- **Where to Watch** section reachable mid-page (empty-region chrome: “No streaming options currently listed for the UK” + JustWatch/TMDB attribution — usable)
- **Links** section exposes labeled **View on Letterboxd**, **View on TMDB**, **View on IMDb** (hrefs present for Matrix Letterboxd URI + TMDB 603 + IMDb `tt0133093`)
- Artifact is a stacked crop (W2W strip + Links strip) because scores/semantic content between them exceeds one phone viewport; both sections verified in the live page

### Scenario 4 — Back navigation

- Capture: detail at `/watchlist/{id}?tab=watched` **before** tap, with **← Watchlist** visible
- Back `href` = `/watchlist?tab=watched`
- Tap verified in Playwright → lands on `http://localhost:3000/watchlist?tab=watched`

### Scenario 5 — Graceful degrade

- Failed film shows clear **NO POSTER** placeholder (not an empty broken card shell)
- Title **Ambiguous Title (1981)** + enrichment badge **Failed** + **active** + **Edit film match** visible under the placeholder
- No peer-card collage of empty metadata/semantic cards in the first scan

### Scenario 6 — Desktop

- 1280×800: poster remains primary visual anchor in a two-column row with title / badges / actions beside it
- Overview metadata scans below — not a backdrop-overlay dashboard hero

## Narrative

Film detail on this branch reads as a poster-led phone screen: dominant poster plane, chrome and actions attached under/beside it, then a single vertical scan (overview → where-to-watch → scores/tags → semantic → links). Status actions meet the ~44px thumb target, back-nav honors `?tab=`, and missing-poster / failed enrichment degrade with an explicit **NO POSTER** placeholder plus status badges instead of empty card shells.

## Notes for babysit / create-pr

- Watchlist entry metaphor may still be table (#143) — not in scope; demo entered detail via direct URL
- Scenario 3 composite documents both W2W and Links; live provider lists also work when unmocked (earlier capture showed STREAM/RENT/BUY for Matrix)

## Babysit notes

- 2026-07-27: PR #152 marked ready for review via `gh pr ready 152` after GitHub MCP `update_pull_request` (`draft: false`) failed with PAT scope error (`Resource not accessible by personal access token`). Required checks at ready: Frontend CI success on `28527f0`; no Bugbot review threads; mergeable CLEAN prior to ready toggle.
- Loops at complete: bugbot=0/3, ci_autofix=0/2, total_runs=5/10.
- Cursor/Vercel check suites remain queued (same non-blocking pattern as #141/#142); required GitHub Actions checks green.
