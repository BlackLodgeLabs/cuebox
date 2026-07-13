# Demo notes — Issue #115

**Date:** 2026-07-13  
**Commit:** `8ec8707` (demo artifacts committed separately)  
**Branch:** `cursor/issue-115-tabbed-watchlist-watched-archived`  
**Stack:** Docker Compose (postgres, api, frontend, backup) on localhost:3000/8000  
**Seed:** Part 2 bootstrap + `python3 scripts/seed-dev-db.py` (12 active ready films)

## Scenario results

| # | Scenario | Result | Artifacts |
|---|----------|--------|-----------|
| 1 | Tabbed watchlist navigation and counts | **PASS** | [scenario-1-tabs.png](./scenario-1-tabs.png) |
| 2 | Manual mark watched and archive | **PASS** | [scenario-2-archive-dialog.png](./scenario-2-archive-dialog.png), [scenario-2-watched-archived-tabs.png](./scenario-2-watched-archived-tabs.png) |
| 3 | Restore from Watched/Archived + forbidden transition | **PASS** | [scenario-3-restore-watchlist.png](./scenario-3-restore-watchlist.png), [scenario-3-forbidden-409.json](./scenario-3-forbidden-409.json) |
| 4 | Film detail status actions and back link | **PASS** | [scenario-4-detail-back-link.png](./scenario-4-detail-back-link.png) |
| 5 | Additive-only CSV re-sync | **PASS** | [scenario-5-sync-settings-results.png](./scenario-5-sync-settings-results.png), [scenario-5-film-still-active.png](./scenario-5-film-still-active.png) |
| 6 | Recommendation exclusion after manual watched | **PASS** | [scenario-6-recommendation-excludes-watched.png](./scenario-6-recommendation-excludes-watched.png) |

## Narrative

### Scenario 1
Opened `/watchlist` and confirmed three tabs — **Watchlist**, **Watched**, **Archived** — each with numeric count badges sourced from API totals. Tab clicks updated the URL (`?tab=watched`, `?tab=archived`, back to active). Applied title filter "Ready" on the Watchlist tab; filtering and pagination behavior preserved.

### Scenario 2
Marked **Ready Film 2** watched from the Watchlist row action; it disappeared from the active list and appeared on the Watched tab with a **Removed** date. Marked **Ready Film 0** archived via row action; confirmation dialog explained soft archive (not delete). After confirm, film moved to Archived tab.

### Scenario 3
Restored **Ready Film 0** from Archived ("Re-enable on watchlist") and **Ready Film 2** from Watched ("Return to watchlist"); both reappeared on the Watchlist tab. API check on a watched film attempting `watched → archived` returned HTTP **409** with `CONFLICT` / "Cannot transition from watched to archived" (see JSON log).

### Scenario 4
Opened **Ready Film 1** from Watchlist (`/watchlist/{id}?tab=active`); status actions (mark watched / archive) visible. Back link returned to `/watchlist?tab=active`. Marked watched from detail; reopening from Watched tab, back link used `?tab=watched`. **Edit film match** remained available on the watched film detail page.

### Scenario 5
Uploaded a Letterboxd-format CSV (`Date,Title,Year,Letterboxd URI`) containing only **Ready Film 0** (existing) plus one new URI, omitting other active films. Sync results showed **added / unchanged / failed** only (no removed or watched counts). **Ready Film 2**, omitted from the CSV, remained on the active Watchlist. New URI was added as active.

> **Note:** Initial demo attempt used wrong CSV column order (`Letterboxd URI` first); Letterboxd export format requires `Date,Title,Year,Letterboxd URI`. Retried with correct format — PASS.

### Scenario 6
Marked **Ready Film 4** watched, completed a new recommendation questionnaire. Results showed other ready films; **Ready Film 4** was absent from top pick and runners-up, confirming watched films are excluded from recommendation candidates.

## Environment notes

- No secrets captured in screenshots or logs.
- Provider keys reported `ok` on health endpoint during demo.
