## Related Issue

Closes #115

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/115)

## Description

**What does this PR do?**

Cuebox previously treated Letterboxd CSV re-sync as authoritative for removals: films missing from a re-upload were archived or marked watched, and watched/archived films disappeared from `/watchlist` with no way to manage status in the app. This PR shifts watchlist lifecycle ownership to Cuebox:

1. **Tabbed `/watchlist`** — Watchlist / Watched / Archived with URL `?tab=` sync, count badges, filters, empty states, and tab-aware film detail back links.
2. **Manual status API + UI** — `POST /films/{id}/status` with a strict state machine (`active ↔ watched`, `active ↔ archived`; `watched ↮ archived` → 409), wired into table rows and film detail.
3. **Additive-only CSV re-sync (breaking)** — re-upload only adds new URIs; existing films in any status are no-ops. Destructive `csv_diff` remove/watched paths are gone.
4. **RSS unchanged** — diary poll still marks matched DB films watched and deactivates active watchlist entries.

**Why is this the best approach?**

No schema migration: reuse `films.status`, `watchlist_entries.active` / `removed_at`, and existing repository helpers (`mark_watched`, `archive_film`, `restore_active`, `deactivate_entry`, `ensure_active_entry`). Recommendation candidates already require `status=active`, so manual transitions exclude films immediately. Cap enforcement on restore mirrors product rules (500 active; clear 409). Frontend and API sync response shapes update together so the breaking CSV change stays consistent.

## Changes Proposed

* Added `FilmStatusService` and `POST /films/{id}/status` — allowed/forbidden transitions, idempotency, 500-cap on restore, watchlist entry side effects
* Extended `FilmSummary` / list responses with `removed_at` for Watched/Archived date columns
* Refactored `SyncService` CSV path to additive-only import; dropped `removed` / `watched` from `SyncCsvResponse`
* Updated `documents/api-contracts.md` for status endpoint, `removed_at`, and additive CSV §6.1
* Added tabbed `/watchlist` UI (`watchlist-page-content.tsx`) with count badges and tab-specific empty states
* Added `film-status-actions.tsx` (mark watched / archive with confirm / restore) on table rows and film detail
* Updated sync settings copy and results panel (added / unchanged / failed only)
* Added API tests (`test_film_status_transition.py`, additive CSV integration/unit) and frontend unit tests for tabs/actions
* Updated Phase 4 gate + PRD success-criteria scripts for additive CSV sync
* Demo artifacts under `workflow/issues/issue-115/demo/` (6 scenarios, all PASS)

## Scenario Results

All six demo scenarios passed on full Docker Compose with Part 2 seeded watchlist (2026-07-13, commit `083a6e5`).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Tabbed watchlist navigation and counts | **PASS** | ![Scenario 1](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-1-tabs.png) |
| 2 | Manual mark watched and archive | **PASS** | ![Archive dialog](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-2-archive-dialog.png) ![Watched/Archived tabs](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-2-watched-archived-tabs.png) |
| 3 | Restore + forbidden `watched→archived` | **PASS** | ![Restore](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-3-restore-watchlist.png) · [409 JSON](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-3-forbidden-409.json) |
| 4 | Film detail status actions and back link | **PASS** | ![Detail back link](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-4-detail-back-link.png) |
| 5 | Additive-only CSV re-sync | **PASS** | ![Sync results](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-5-sync-settings-results.png) ![Film still active](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-5-film-still-active.png) |
| 6 | Recommendation excludes manual watched | **PASS** | ![Recommendation](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/25722279263aa746f79b8d5f02a6684832303eef/workflow/issues/issue-115/demo/scenario-6-recommendation-excludes-watched.png) |

## How to Test

1. Checkout this branch:
   ```bash
   git checkout cursor/issue-115-tabbed-watchlist-watched-archived
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
3. Confirm health and seeded films:
   ```bash
   curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
   curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 10
   print('PASS')
   "
   ```
4. Open http://localhost:3000/watchlist — three tabs with counts; switch `?tab=watched` / `?tab=archived`.
5. On Watchlist: **Mark watched** and **Archive** (confirm dialog); confirm films move to the correct tabs with **Removed** dates.
6. On Watched/Archived: **Return to watchlist** / **Re-enable on watchlist**; confirm restore.
7. API forbidden transition:
   ```bash
   # After marking a film watched, attempt archive — expect 409
   curl -s -o /tmp/status.json -w "%{http_code}" -X POST \
     -H "Content-Type: application/json" \
     -d '{"status":"archived"}' \
     "http://localhost:8000/api/v1/films/<watched-film-id>/status"
   ```
8. Sync settings (http://localhost:3000/settings/sync): upload a Letterboxd-format CSV (`Date,Title,Year,Letterboxd URI`) that omits some active films and adds a new URI — expect added/unchanged only; omitted films stay active.
9. Mark a film watched, run a new recommendation — confirm it is absent from results.
10. Gates (Postgres required; see `AGENTS.md` for host `DATABASE_URL` vs Compose):
    ```bash
    bash scripts/verify-phase4-gates.sh
    bash scripts/verify-phase6-gates.sh
    ```

## Known Issues / Notes for Reviewer

* **Breaking API change:** `POST /sync/csv` response no longer includes `removed`, `watched`, `removed_films`, or `watched_films`. Frontend updated in this PR.
* Users who relied on CSV re-upload to prune the watchlist must use **Archive** (or mark watched) manually; sync settings copy explains supplemental import.
* Restore to active returns **409** when the 500-film active cap would be exceeded; manual `POST /watchlist/films` exemption for `add_source=manual` is unchanged.
* Status action buttons use text labels (not lucide-react icons) after a dependency fix during execute.
* Demo Scenario 5 initially failed with wrong CSV column order; Letterboxd export format is `Date,Title,Year,Letterboxd URI` — retried and passed.
* No DB migration required.
* Out of scope: bulk status changes, `watched_at`/`archived_at` columns, RSS add/remove feeds, Letterboxd write-back.

## Gate evidence

- [x] `Phase 4 gate exit 0 at d73ff22` (execute)
- [x] `Phase 6 gate exit 0 at d73ff22` (execute)
- [x] Focused API tests (`test_film_status_transition`, additive CSV, watched-excluded) at `d73ff22` (execute)
- [x] Demo scenarios 1–6 PASS at `083a6e5` (demo)
- [x] `api-tests` + `frontend` CI green (babysit recovery; handoff spawn failed on jq ARG_MAX)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Breaking CSV sync response change reviewed
