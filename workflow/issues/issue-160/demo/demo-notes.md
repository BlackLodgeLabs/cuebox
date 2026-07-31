# Demo notes — issue #160

- **Date:** 2026-07-31T09:21:00Z
- **Commit:** `b731372` (`b7313728586f8e4e4edce36631a1164022753335`) — demo evidence tip
- **Branch:** `cursor/issue-160-pr-165-demo-agent-d1ed` → canonical `cursor/issue-160-mobile-surface-clarity-ccba`
- **PR:** #165 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport:** 390×844 (Playwright `devices['iPhone 13']`, `deviceScaleFactor: 2`)
- **Stack:** Compose `postgres`, `api`, `frontend`, `backup` Up; health API + frontend proxy `"status":"ok"` / `"database":"ok"`
- **Seed:** 2 films (The Matrix `ready`/`active` + Ambiguous Title `failed`/`active` null poster); 1 history session (Matrix)
- **Gate:** `bash scripts/verify-workflow-paths.sh` → **PASS: no legacy workflow paths found** (exit 0)
- **Home empty-path unit:** `frontend/src/app/page.test.tsx` — empty + returning assert no System status (vitest PASS)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification | **PASS** | [scenario-0-home-no-system-status.png](scenario-0-home-no-system-status.png), [scenario-0-history-filters-closed.png](scenario-0-history-filters-closed.png), [scenario-0-history-filter-sheet.png](scenario-0-history-filter-sheet.png), [scenario-0-watchlist-null-poster.png](scenario-0-watchlist-null-poster.png), [scenario-0-film-detail-user-status.png](scenario-0-film-detail-user-status.png) |
| 1 | Shared poster fallback on ceremony | **PASS** | [scenario-1-ceremony-poster.png](scenario-1-ceremony-poster.png) |
| 2 | Film detail actions still clear | **PASS** | [scenario-2-film-detail-actions.png](scenario-2-film-detail-actions.png) |
| 3 | Empty-watchlist Home no System status | **SKIP** | Unit coverage in `page.test.tsx` (empty path); shared seed DB not emptied |
| 4 | Watchlist cells poster + title | **PASS** | [scenario-4-watchlist-poster-title-only.png](scenario-4-watchlist-poster-title-only.png) |

### Scenario 0 — Bug fix verification (contrast)

| Gap | Before (bug-repro) | After (demo) |
|-----|--------------------|--------------|
| Home System status | Accordion under History ([bug-repro-home-system-status.png](bug-repro-home-system-status.png)) | **Gone** — Create + History only ([scenario-0-home-no-system-status.png](scenario-0-home-no-system-status.png)) |
| History filters | Permanent date/status stack ([bug-repro-history-filters.png](bug-repro-history-filters.png)) | Compact search + **Filter**; Matrix card above fold when closed; sheet has From/To/Watch status/Apply/Clear |
| Film detail jargon | **Ready** + **active** / **Failed** + **active** | **On watchlist** only; no Ready/Failed enrichment badge |
| Null poster | Intentional **NO POSTER** (already OK) | Still Cuebox **NO POSTER** on watchlist + Ambiguous detail |

Filter apply: Watched status hid Matrix history card; Filter button used primary active affordance; Clear restored defaults.

### Scenario 1 — Ceremony shared FilmPoster

- History mode stage 3 record with API route override `winner.poster_url = null` → **NO POSTER** placeholder (same language as watchlist).
- Load-error `onError` path covered by `film-poster` unit tests (not forced in UI demo).

### Scenario 2 — Detail actions

- **Mark watched** + **Archive** present with clear labels; **Edit film match** still available.
- Enriching hint N/A (no `enrichment_status === "enriching"` film in seed).

### Scenario 3 — Empty Home

- **Skipped** on shared seeded volume (would destroy Part 2 fixture). Relies on `page.test.tsx` empty-watchlist assertion: no System status + Import CTA.

### Scenario 4 — Watchlist cells

- Grid shows poster/placeholder + title only; no Ready/Failed/On watchlist badges on cell face; Filter control unchanged.

## Narrative

Phone-review surface-clarity gaps from #160 are closed on the full stack: returning Home has no System status; History date/status filters sit behind a watchlist-like Filter sheet so results sit higher; film detail shows mapped lifecycle labels without enrichment jargon; null posters use the shared Cuebox **NO POSTER** treatment on watchlist and ceremony (via `FilmPoster`).

## Notes for babysit / create-pr

- Capture helper was a local Playwright script against Compose frontend; not committed
- Planning `bug-repro-*` artifacts retained for before/after contrast
- PR #165 base confirmed `feature/mobile-ui`
- No secrets in images or notes
