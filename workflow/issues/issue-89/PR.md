## Related Issue

Closes #89

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/89)

## Description

**What does this PR do?**

Bulk-imports Letterboxd watched history from the three export CSVs (`watched.csv` + `ratings.csv` + `diary.csv`) into Cuebox watch records. This is separate from watchlist CSV/RSS sync: Settings gets an **Import watched history** card, the API gains `POST /api/v1/sync/watched`, and `film_watches` can store null scores for unrated imports (`letterboxd_import` source) without inventing stars in the UI.

**Why is this the best approach?**

Watched history is modeled as completed (or pending) `film_watches` rows with merge rules from the SPEC — join on title+year, prefer `watched.csv` film URIs (diary URIs are log entries), default dates when ratings/diary lack them, and diary-without-score → review queue with staged rewatch dates. Idempotent unique `(film_id, watched_at)` on completed watches makes re-uploads safe. The active 500-film cap stays on watchlist sync only; watched import is uncapped and only transitions `active` → `watched` when a film is already on the watchlist.

## Changes Proposed

* Alembic `0008` — nullable `film_watches.score`, `WatchSource.letterboxd_import`, `staged_watched_dates`, unique index on completed `(film_id, watched_at)`
* New `watched_csv_parser.py` + `watched_import_service.py` — parse/merge three CSVs, resolve/create films, status transitions, enrichment enqueue, summary counters
* `POST /api/v1/sync/watched` multipart endpoint (`watched`, `ratings`, `diary`) + response schemas
* Review finalize materializes staged diary dates; repository stops coercing pending null scores to `0.5`
* Settings → Sync **Import watched history** card (three file inputs, summary, links); `useSyncWatched` / `postSyncWatched`
* Frontend null-score UI — Watched tab / film detail show `Unrated · {date}` instead of invented stars; types allow `score: null` and `letterboxd_import`
* Fixtures + tests from issue samples (`api/tests/fixtures/watched_import/`); docs updates in `api-contracts.md`, `database-design.md`, `how-cuebox-works.md`

**Key commits:** `5c890d3` feat(api): import Letterboxd watched history CSVs; `59b04e2` fix(frontend): null-score TypeScript and sync page unit tests; `c8b74a4` docs(workflow): demo evidence.

## Scenario Results

Application-tier demo on Docker Compose (migration `0008` head). Fixtures: `api/tests/fixtures/watched_import/{watched,ratings,diary}.csv`.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Settings Import watched history card | **PASS** | Separate card; Import CTA disabled until all three files selected |
| 2 | Import sample CSVs + Watched tab | **PASS** | films_seen=10, watches_created=10, pending_review=1; Unrated `12 Years a Slave`; Kneecap two dates |
| 3 | Active → watched | **PASS** | Active 3→2; `12 Years a Slave` status `watched` |
| 4 | Diary-without-score → review | **PASS** | Seven Samurai pending with Watched Date `2023-12-31`; completed at 4★ |
| 5 | Idempotent re-upload | **PASS** | watches_created=0, watches_skipped_duplicate=11; Kneecap still 2 watches |
| 6 | Cap unchanged | **PASS** | No `WATCHLIST_SIZE_EXCEEDED`; `MAX_ACTIVE_WATCHLIST = 500` for CSV sync only |

![Scenario 1 — Settings Import watched history](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-1-settings-watched-import.png)

![Scenario 2 — Import summary](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-2-import-summary.png)

![Scenario 2 — Watched tab](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-2-watched-tab.png)

![Scenario 2 — Unrated detail](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-2-unrated-detail.png)

![Scenario 3 — Active to watched](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-3-active-to-watched.png)

![Scenario 4 — Review queue](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-4-review-queue.png)

![Scenario 4 — After complete](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-4-after-complete.png)

![Scenario 5 — Re-upload summary](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c8b74a4ee34f31d92d190014fab75e30e746ac1a/workflow/issues/issue-89/demo/scenario-5-reupload-summary.png)

## How to Test

1. Checkout this branch: `git checkout cursor/issue-89-import-watched-list-9ab1`
2. Start the stack: `docker compose up` (API runs `alembic upgrade head` → migration `0008`)
3. Confirm health: `curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool`
4. Open http://localhost:3000/settings/sync — confirm **Import watched history** is separate from CSV re-sync / RSS
5. Upload the three fixtures:
   - `api/tests/fixtures/watched_import/watched.csv`
   - `api/tests/fixtures/watched_import/ratings.csv`
   - `api/tests/fixtures/watched_import/diary.csv`
6. Verify summary counters; open **Watched** tab — Hellraiser scored with default date; `12 Years a Slave` shows `Unrated · …` (no invented stars); Kneecap has two watch dates
7. Open http://localhost:3000/review — Seven Samurai pending with diary Watched Date `2023-12-31`; complete at 4★ → status `watched`
8. Re-upload the same three files — expect `watches_created=0` and duplicates skipped
9. Confirm active watchlist 500 cap is unchanged (watched import must not return `WATCHLIST_SIZE_EXCEEDED`)
10. Regression: `bash scripts/verify-phase8-gates.sh` (Postgres required; stop compose frontend before host build per AGENTS.md gotchas)

## Known Issues / Notes for Reviewer

* Migration `0008` is required; restart/rebuild the API container so `entrypoint.sh` runs `alembic upgrade head` if columns are missing.
* Demo notes cited commit `8f37273` for the demo tree, but the pushed demo evidence commit is `c8b74a4` (amend after notes write). Screenshots live under that commit on the branch.
* Scenario 4 needed a follow-up Playwright pass in demo (dialog open race on first capture); final result **PASS**.
* Watched import does not write back to Letterboxd; questionnaire/recommendation inclusion of imported watched films remains future work.
* Large Letterboxd exports may take a while on the request path (v1 sync + async enrichment); practical size limits are documented in contracts.
* No secrets in demo screenshots or fixture CSVs.

## Gate evidence

- [x] Application default: `bash scripts/verify-phase8-gates.sh` exit 0 at `59b04e2` (execute; all Phase 8 gates passed after clearing `frontend/.next` EACCES)
- [x] Focused watched-import pytest + frontend unit/tsc exit 0 at `59b04e2` (execute)
- [x] Workflow regression: `bash scripts/verify-workflow-paths.sh` exit 0 at `c8b74a4` (demo)
- [x] Demo scenarios 1–6 **PASS** on full Docker stack (see Scenario Results; evidence commit `c8b74a4`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated and passing
- [ ] Documentation updated (`api-contracts.md`, `database-design.md`, `how-cuebox-works.md`)
- [ ] No secrets in commits or demo artifacts
- [ ] UI changes verified via demo screenshots
- [ ] Migration `0008` reviewed
