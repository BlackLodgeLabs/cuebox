## Related Issue

Closes #93

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/93)

## Description

**What does this PR do?**

Introduces a `pending_watch_review` interim film status and a `film_watches` table so marking a film watched (manually or via Letterboxd RSS diary) captures a lightweight diary entry — score, watched date, and optional notes — before the film becomes fully `watched`. Manual **Mark watched** opens a review dialog; cancel reverts to `active` with no watch record. RSS diary matches for films already in the database transition to `pending_watch_review` with `watchedDate` and `memberRating` pre-filled. The `/review` page gains a **Watched films to review** section alongside existing metadata match review; the nav badge sums both queues. The **Watched** tab lists pending and completed watches; film detail shows **Watch history** with per-record edit.

**Why is this the best approach?**

Watch events are modeled as many-to-one `film_watches` records (not columns on `films`), which supports future rewatches and Insights features while keeping the status machine simple: `active → pending_watch_review → watched`, with cancel reverting to `active`. RSS pre-fill uses Letterboxd diary fields (`watchedDate`, `memberRating`) rather than `pubDate`, matching user intent. Recommendation exclusion treats `pending_watch_review` like `watched`, so half-finished diary entries do not surface in picks.

## Changes Proposed

* Added `pending_watch_review` to `FilmStatus` enum (Alembic migration + Python/Pydantic types).
* Created `film_watches` table and `FilmWatch` ORM with pending/complete lifecycle (`is_pending` flag, partial unique index).
* Added `film_watch_repository.py` and `watch_review_service.py` for create, complete, cancel, and edit flows.
* Extended `FilmStatusService` transition matrix; `active → watched` blocked — must go through watch review.
* Updated RSS parser to parse `letterboxd:watchedDate` and `letterboxd:memberRating`; `SyncService._apply_watched()` creates pending review instead of immediate `mark_watched()`.
* New API endpoints: watch-review queue, complete/cancel review, `PATCH /films/{id}/watches/{watch_id}`, combined `GET /films/reviews/pending-count`.
* Frontend: `WatchReviewDialog`, `HalfStarRatingInput`, two-section `/review` page, Watched tab incomplete badge, film detail watch history with edit, combined nav/home badge counts.
* Updated `documents/api-contracts.md` and `documents/database-design.md`.
* Tests: API status transitions, watch review validation, RSS pre-fill, recommendation exclusion; frontend unit tests for dialog, stars, review page, badge.

## Scenario Results

| # | Scenario | Result | Screenshot |
|---|----------|--------|------------|
| 1 | Manual mark watched — complete review | **PASS** | Dialog, Watched tab, detail history below |
| 2 | Manual mark watched — cancel revert | **PASS** | Film remains on Active tab |
| 3 | Review page + nav badge | **PASS** | Two sections, badge count |
| 4 | Edit watch record on film detail | **PASS** | Edit dialog, updated history |
| 5 | Metadata match review regression | **N/A (seed)** | Covered by `verify-phase8-gates.sh` in execute |

**Films used:** The Matrix (scenarios 1 & 4), Ready Film 0 (cancel), Ready Film 1 (review queue via API seed).

### Scenario 1 — Manual mark watched (Flow A)

![Scenario 1 dialog](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-1-dialog.png)

![Scenario 1 watched tab](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-1-watched-tab.png)

![Scenario 1 detail history](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-1-detail-history.png)

### Scenario 2 — Cancel revert (Flow B)

![Scenario 2 cancel](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-2-cancel.png)

### Scenario 3 — Review page + badge

![Scenario 3 review page](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-3-review-page.png)

![Scenario 3 nav badge](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-3-nav-badge.png)

### Scenario 4 — Edit watch record (Flow D)

![Scenario 4 edit dialog](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-4-edit-dialog.png)

![Scenario 4 updated history](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/8e261be12162bd08fab4a2547112cc6e93fa4fab/workflow/issues/issue-93/demo/scenario-4-updated-history.png)

## How to Test

1. Checkout this branch: `git checkout cursor/issue-93-review-watched-films-7684`
2. Start the stack: `docker compose up` (or use existing cloud VM stack)
3. Confirm health: `curl -sf http://localhost:3000/api/v1/health`
4. **Manual mark watched:** Open http://localhost:3000/watchlist?tab=active → **Mark watched** on a film → select ≥½ star, confirm date, optional notes → **Save** → film appears on **Watched** tab with score/date; detail page shows **Watch history**.
5. **Cancel revert:** Mark another film watched → **Cancel** without saving → film stays on Active tab only; no watch history.
6. **Review queue:** `POST /api/v1/films/{id}/status` with `{"status":"pending_watch_review"}` on a film, or wait for RSS diary match → open http://localhost:3000/review → complete from **Watched films to review** section; nav badge decrements.
7. **Edit history:** On a watched film detail page → **Edit** on a watch record → change score/notes → save → list refreshes.
8. **Regression:** `bash scripts/verify-phase8-gates.sh` (requires Postgres; stop compose frontend before host build per AGENTS.md gotchas).

## Known Issues / Notes for Reviewer

* CSV sync does **not** trigger watch review (out of scope per spec).
* Scenario 5 (metadata match review UI) was not exercised in cloud seed — no `review_required` films present; API/frontend regression covered by phase 8 gate.
* Alembic migration adds `pending_watch_review` enum value and `film_watches` table; API container runs `alembic upgrade head` on start.
* Depends on #115 (tabbed watchlist) — merged.

## Gate evidence

- [x] Application default: `bash scripts/verify-phase8-gates.sh` exit 0 at `91488dd` (execute stage, post-fix commits)
- [x] Demo scenarios 1–4 pass on full Docker stack (see Scenario Results; evidence commit `65b5310`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated and passing
- [ ] Documentation updated (`api-contracts.md`, `database-design.md`)
- [ ] No secrets in commits or demo artifacts
- [ ] UI changes verified via demo screenshots
