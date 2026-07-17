# Demo notes — issue #93: Review watched films

**Date:** 2026-07-17  
**Commit:** `c73b7ee8c4e347f4a3001a6b8d125360205bd9f6`  
**Tier:** application  
**Branch:** `cursor/issue-93-review-watched-films-7684`

## Environment

- Full Docker stack running (`postgres`, `api`, `frontend`, `backup` Up)
- Health checks: frontend and API `status: ok`, `database: ok`
- Seeded via `scripts/seed-dev-db.py` (12 active films, 10 ready)

## Films used

| Film | Scenario | Role |
|------|----------|------|
| **The Matrix** | 1, 4 | Manual mark watched (3.5★ → edited to 4.5★) |
| **Ready Film 0** | 2 | Cancel revert — remained on Active tab |
| **Ready Film 1** | 3 | API-seeded `pending_watch_review`, completed on `/review` |

## Scenario results

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Manual mark watched — complete review | **PASS** | `scenario-1-dialog.png`, `scenario-1-watched-tab.png`, `scenario-1-detail-history.png` |
| 2 | Manual mark watched — cancel revert | **PASS** | `scenario-2-cancel.png` |
| 3 | Review page — two sections + nav badge | **PASS** | `scenario-3-review-page.png`, `scenario-3-nav-badge.png` |
| 4 | Edit watch record on film detail | **PASS** | `scenario-4-edit-dialog.png`, `scenario-4-updated-history.png` |
| 5 | Metadata match review regression | **N/A (seed)** | No `review_required` films in seed — regression covered by `verify-phase8-gates.sh` in execute stage |

### Scenario 1 — Manual mark watched (Flow A)

1. Opened `/watchlist?tab=active`, clicked **Mark watched** on **The Matrix**
2. Review dialog opened with today's date and empty score; Save disabled until score selected
3. Selected 3.5★, confirmed date, entered note "Great rewatch"
4. Saved — film moved to **Watched** tab with score and date
5. Film detail **Watch history** shows 3.5★, date, and notes snippet
6. Film no longer on Active tab

### Scenario 2 — Cancel revert (Flow B)

1. Clicked **Mark watched** on **Ready Film 0**, then **Cancel**
2. Film remained on Active tab only; no watch history on detail

### Scenario 3 — Review page + badge

1. Seeded **Ready Film 1** to `pending_watch_review` via `POST /api/v1/films/{id}/status`
2. `/review` showed **Watched films to review** section with pending card
3. Nav **Review** badge showed count `1`
4. Completed review from card — film removed from queue; badge cleared

### Scenario 4 — Edit watch record (Flow D)

1. Opened **The Matrix** detail, clicked **Edit** on watch record
2. Changed score to 4.5★, updated notes to "Updated after rewatch — even better"
3. UI refreshed with updated values; film remains `watched`

### Scenario 5 — Metadata match regression

No `enrichment_status = review_required` films in cloud seed. Execute stage ran `verify-phase8-gates.sh` which includes metadata review regression tests.

## API verification (post-demo)

- `GET /api/v1/films/reviews/pending-count` → `total: 0`
- **The Matrix** status `watched`, watch record score `4.5`, notes updated
- **Ready Film 0** status `active` (cancel path)
- **Ready Film 1** status `watched` (review page completion)
