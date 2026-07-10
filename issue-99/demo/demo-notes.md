# Issue #99 demo notes

**Date:** 2026-07-10  
**Commit:** `f15773c` (demo-in-progress) + demo artifacts on branch `cursor/issue-99-add-film-to-watch-list`  
**Stack:** Docker Compose on cloud VM; `TMDB_API_KEY` and `OPENAI_API_KEY` present in `.env`

## Pass-back fixes (from prior demo)

Cloudflare blocks `GET https://letterboxd.com/tmdb/{id}` from datacenter IPs. Slug-probe fallback (`letterboxd_resolver._resolve_via_slug_probe`) now resolves common titles (e.g. Fight Club → `fight-club`) without manual paste. Duplicate retry returns existing pending review instead of opaque conflicts.

## Test TMDB ids

| Title | TMDB id | Letterboxd URI |
|-------|---------|----------------|
| The Matrix | 603 | `https://letterboxd.com/film/the-matrix/` (seeded; duplicate scenario) |
| Fight Club | 550 | `https://letterboxd.com/film/fight-club/` (happy path + restore) |
| Blade Runner 2049 | 335984 | `https://letterboxd.com/film/blade-runner-2049/` (review paste scenario) |

## Scenario results

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Happy path — add from Home | **PASS** | Home shows three CTAs in order; Fight Club added via `/watchlist/add`, enriched to `ready` via slug fallback |
| 2 | Watchlist add button | **PASS** | Header **Add film** links to `/watchlist/add` |
| 3 | Already on watchlist | **PASS** | The Matrix shows inline “Already on your watchlist” with link |
| 4 | Letterboxd review paste | **PASS** | Seeded `letterboxd_uri` review for Blade Runner 2049; `/review` shows paste UI; pasted URL completes add |
| 5 | Restore archived | **PASS** | Archived Fight Club via DB seed; re-add via UI restores to active watchlist |

## Gate evidence

- `bash scripts/verify-phase8-gates.sh` — exit 0 (2026-07-10)
- `pytest tests/test_integration_watchlist_add.py tests/test_letterboxd_resolver.py` — 20 passed

## Artifacts

- `scenario-1-home-cta.png`
- `scenario-1-search-results.png`
- `scenario-1-added-ready.png`
- `scenario-2-watchlist-button.png`
- `scenario-3-duplicate.png`
- `scenario-4-review-paste.png`
- `scenario-4-after-resolve.png`
- `scenario-5-restored.png`
