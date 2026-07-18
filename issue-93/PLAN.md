# Implementation Plan — Issue #93: Review watched films

**Tier:** application

## Overview

Introduce a `pending_watch_review` interim film status and a `film_watches` table so marking a film watched (manually or via RSS diary) captures a lightweight diary entry (score, watched date, optional notes) before the film becomes fully `watched`. Manual marking opens an immediate review dialog; RSS-triggered watches queue on `/review` and the **Watched** tab with pre-filled date/rating from Letterboxd. Film detail gains a **Watch history** section with per-record edit.

Today, `POST /films/{id}/status` with `watched` immediately sets `films.status = watched` with no personal watch data, and RSS `_apply_watched()` calls `mark_watched()` directly. This plan replaces that path with the interim state + watch-record lifecycle while preserving metadata match review and #115 tabbed watchlist behavior.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `api/alembic/versions/NNNN_pending_watch_review.py` | Add | Enum value + `film_watches` table |
| `api/app/database/enums.py` | Modify | `FilmStatus.PENDING_WATCH_REVIEW`, `WatchSource` enum |
| `api/app/database/models.py` | Modify | `FilmWatch` ORM model + `Film.watches` relationship |
| `api/app/repositories/film_watch_repository.py` | Add | CRUD for pending/complete watch records |
| `api/app/repositories/film_repository.py` | Modify | `mark_pending_watch_review()`, expand `list_films` watched filter |
| `api/app/services/film_status_service.py` | Modify | Transition matrix for `pending_watch_review` |
| `api/app/services/watch_review_service.py` | Add | Complete/cancel review, validation, edit |
| `api/app/services/rss_parser.py` | Modify | Parse `letterboxd:watchedDate`, `letterboxd:memberRating` |
| `api/app/services/sync_service.py` | Modify | `_apply_watched()` → pending review path |
| `api/app/schemas/film_schemas.py` | Modify | `FilmWatch` schemas, extend `FilmDetail` |
| `api/app/schemas/watch_review_schemas.py` | Add | Request/response for watch review endpoints |
| `api/app/routers/v1/films.py` | Modify | Watch-review queue, complete, list watches |
| `api/app/routers/v1/reviews.py` or new router | Modify | Combined pending-count endpoint (optional) |
| `api/app/services/film_presenter.py` | Modify | Include watches, latest `watched_at` for list rows |
| `frontend/src/types/api.ts` | Modify | New status, watch types, endpoint shapes |
| `frontend/src/lib/api-client.ts` | Modify | Watch-review API calls |
| `frontend/src/hooks/use-films.ts` | Modify | Combined pending count, watch-review hooks |
| `frontend/src/components/watch-review-dialog.tsx` | Add | Score/date/notes dialog (EditFilmMatchDialog pattern) |
| `frontend/src/components/half-star-rating-input.tsx` | Add | Interactive 0.5–5.0 star control |
| `frontend/src/components/film-status-actions.tsx` | Modify | Mark watched → open dialog, not direct `watched` |
| `frontend/src/components/watchlist-table.tsx` | Modify | Incomplete badge, mark-watched dialog wiring |
| `frontend/src/components/film-detail-view.tsx` | Modify | Watch history section + edit CTA |
| `frontend/src/app/review/page.tsx` | Modify | Two-section layout (match + watch review) |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | Modify | Watched tab includes pending; date from watch record |
| `frontend/src/components/app-shell.tsx` | Modify | Combined badge count |
| `frontend/src/app/page.tsx` | Modify | Home warning card combined count |
| `documents/api-contracts.md` | Modify | New endpoints, enum, watched-tab query semantics |
| `documents/database-design.md` | Modify | `film_watches` table + status enum |
| `api/tests/test_film_status_transition.py` | Modify | New transitions + forbidden paths |
| `api/tests/test_film_watch_review.py` | Add | Complete/cancel/edit/validation |
| `api/tests/test_rss_parser.py` | Modify | `watchedDate` + `memberRating` parsing |
| `api/tests/test_integration_watchlist_add.py` | Modify | RSS → `pending_watch_review` |
| `api/tests/test_watched_excluded_from_candidates.py` | Modify | Explicit `pending_watch_review` exclusion |
| `frontend/src/components/watch-review-dialog.test.tsx` | Add | Save/cancel/validation |
| `frontend/src/components/half-star-rating-input.test.tsx` | Add | Half-step selection |
| `frontend/src/app/review/page.test.tsx` | Add | Two-section layout |
| `frontend/src/components/app-shell.test.tsx` | Modify | Combined badge count |

## Implementation steps

### 1. Database migration and models

1. Alembic migration:
   - `ALTER TYPE film_status ADD VALUE 'pending_watch_review'` (after `active`, before `watched` if ordering matters for readability).
   - Create `film_watches` table:
     - `id` UUID PK
     - `film_id` UUID FK → `films.id` ON DELETE CASCADE
     - `score` NUMERIC(2,1) NOT NULL (0.5–5.0)
     - `watched_at` DATE NOT NULL
     - `notes` TEXT NULL
     - `source` enum `manual` | `rss`
     - `is_pending` BOOLEAN NOT NULL DEFAULT false (draft while status is `pending_watch_review`)
     - `created_at`, `updated_at` timestamps
     - Index `(film_id, watched_at DESC)`
     - Partial unique index: at most one `is_pending = true` per `film_id`
2. Add `FilmWatch` ORM model and `WatchSource` enum in `enums.py`.
3. Add `FilmStatus.PENDING_WATCH_REVIEW` to Python enum and Pydantic schemas.

### 2. Repository and service layer (backend core)

1. `film_watch_repository.py`:
   - `create_pending(film_id, source, watched_at?, score?)`
   - `get_pending_for_film(film_id)`
   - `finalize_pending(watch_id, score, watched_at, notes?)` → `is_pending = false`
   - `delete_pending_for_film(film_id)` (cancel path)
   - `list_for_film(film_id)` ordered by `watched_at DESC`
   - `update_watch(watch_id, score, watched_at, notes?)`
2. Extend `FilmStatusService.transition()`:
   - `active → pending_watch_review`: deactivate watchlist entry (same as watched today); do **not** set `watched` yet.
   - `pending_watch_review → active`: reactivate watchlist entry (if under cap); delete pending watch record.
   - `pending_watch_review → watched`: only via `WatchReviewService.complete()` (not raw status POST).
   - `watched → active`: unchanged (retain watch records).
   - **Forbidden** (409, mirror #115):
     - `pending_watch_review ↔ archived`
     - `watched ↔ archived` (existing)
     - `archived → pending_watch_review`
   - Document forbidden transitions in `documents/api-contracts.md`.
3. `WatchReviewService`:
   - `complete_review(film_id, score, watched_at, notes?)`: validate score (0.5–5.0, 0.5 steps), date (not future), finalize pending record, transition to `watched`.
   - `cancel_review(film_id)`: `pending_watch_review → active`, delete pending record, restore watchlist.
   - `edit_watch(film_id, watch_id, ...)`: update finalized record only.

### 3. RSS integration

1. In `parse_diary_feed()`, extract:
   - `letterboxd:watchedDate` → ISO date in event `payload["watched_date"]`
   - `letterboxd:memberRating` → float in `payload["member_rating"]`
2. Add `normalize_member_rating(raw) → float | None` (clamp to 0.5–5.0, round to nearest 0.5).
3. In `SyncService._apply_watched()`:
   - If film not found → no-op (unchanged).
   - Else: transition to `pending_watch_review`, create pending watch record with `source=rss`, `watched_at` from `watched_date` (fallback: `event_timestamp.date()` only if `watched_date` missing — log warning), `score` from normalized rating when present.
   - Do **not** call `mark_watched()`.

### 4. API endpoints

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/films/watch-review-required` | List films with `status = pending_watch_review` (paginated, same shape as review-required list) |
| `POST` | `/films/{id}/watch-review` | Body: `{ score, watched_at, notes? }` — complete pending review |
| `DELETE` | `/films/{id}/watch-review` | Cancel pending review → `active` |
| `PATCH` | `/films/{id}/watches/{watch_id}` | Edit finalized watch record |
| `GET` | `/films/{id}` | Include `watches: FilmWatch[]` |
| `GET` | `/films/reviews/pending-count` | `{ metadata_count, watch_review_count, total }` (preferred over client double-fetch) |
| `POST` | `/films/{id}/status` | Accept `pending_watch_review` as target; block direct `watched` from `active` (force review completion endpoint) |

Expand `GET /films?status=watched` server-side to return films where `status IN ('pending_watch_review', 'watched')`. Presenter adds `latest_watched_at` and `watch_review_incomplete: bool` on list items.

### 5. Frontend — watch review dialog

1. `half-star-rating-input.tsx`: clickable stars, 10 half-steps (0.5–5.0), keyboard accessible, design tokens from `documents/DESIGN.md`.
2. `watch-review-dialog.tsx` (pattern from `edit-film-match-dialog.tsx`):
   - Props: `film`, `open`, `onOpenChange`, optional `initialScore`, `initialWatchedAt`, `mode: 'complete' | 'edit'`, optional `watchId` for edit.
   - Fields: score (required), date input (required, max=today), notes (optional textarea).
   - Save disabled until score ≥ 0.5 and valid date.
   - **Complete mode cancel**: call `DELETE /films/{id}/watch-review` then close.
   - **Edit mode cancel**: close without API call.
3. Wire dialog from `FilmStatusActions` and `WatchlistTable` mark-watched buttons:
   - On click: `POST /films/{id}/status` with `pending_watch_review` → open dialog with today’s date.
   - On save: `POST /films/{id}/watch-review`.

### 6. Frontend — review page, badge, watched tab

1. `/review/page.tsx`:
   - Fetch metadata queue (`useReviewRequired`) and watch queue (`useWatchReviewRequired`).
   - Heading **Review**; subtitle covers both queues.
   - Section 1: **Match review** (existing cards) — hidden when empty.
   - Section 2: **Watched films to review** — cards open `WatchReviewDialog` with RSS pre-fills from pending watch record.
   - Page-level empty state only when both queues empty.
2. `usePendingReviewCount`: switch to `GET /films/reviews/pending-count` (or sum two queries). Update `AppShell` badge and home warning card.
3. Watched tab:
   - Query `status=watched` (server-expanded).
   - Show incomplete badge when `watch_review_incomplete` or `status === 'pending_watch_review'`.
   - Date column: `latest_watched_at` when available, else `removed_at`.

### 7. Frontend — film detail watch history

1. `film-detail-view.tsx`:
   - **Watch history** section when `film.watches.length > 0` OR `status === 'pending_watch_review'`.
   - List records newest-first: stars, formatted date, notes snippet.
   - Edit button per record → dialog in edit mode → `PATCH`.
   - For `pending_watch_review` with no finalized records: prominent CTA to complete review.

### 8. Documentation

1. `documents/api-contracts.md`: new status, endpoints, watched-tab query expansion, combined count.
2. `documents/database-design.md`: `film_watches` schema, pending flag semantics.

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| `active → pending_watch_review` deactivates watchlist | API integration | Status + state machine |
| `pending_watch_review → watched` on complete | API integration | Save review path |
| `pending_watch_review → active` on cancel deletes pending record | API integration | Cancel revert |
| Forbidden `pending_watch_review ↔ archived` | API integration | #115 matrix |
| `watched → active` retains watch records | API integration | Return to watchlist |
| Score validation (0.5–5.0, 0.5 steps) | API unit | Review inputs |
| Date not in future | API unit | Review inputs |
| RSS parses `watchedDate` + `memberRating` | API unit | RSS integration |
| RSS watched → `pending_watch_review` with pre-fill | API integration | Flow C |
| RSS unknown film → no-op | API integration | RSS no-op |
| `pending_watch_review` excluded from candidates | API integration | Recommendation exclusion |
| Edit watch record via PATCH | API integration | Flow D |
| Two watch records on one film (test seed) | API integration | History UI shape |
| Metadata match review unchanged | API regression | Existing review tests pass |
| #115 status transitions still pass | API regression | `test_film_status_transition.py` |
| Half-star input selects 0.5 steps | Frontend unit | Score UI |
| Dialog save/cancel/validation | Frontend unit | Manual flow |
| Review page two sections | Frontend unit | Review page layout |
| Combined badge count | Frontend unit | Nav badge |
| Watch history edit | Frontend unit | Film detail |

## Gate script

```bash
bash scripts/verify-phase8-gates.sh
```

Narrower pre-check during development: `bash scripts/verify-phase4-gates.sh` after RSS/sync changes; `bash scripts/verify-phase5-gates.sh` after recommendation exclusion; frontend `npx tsc --noEmit` + `npm run test:unit` after UI work. Full `$APP_DEFAULT_GATE` required before execute handoff.

## Documentation updates

- `documents/api-contracts.md` — endpoints, enum, watched query
- `documents/database-design.md` — `film_watches` table
- `documents/how-cuebox-works.md` — brief mention of watch review flow (if user-facing narrative exists for watched status)

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| PostgreSQL enum migration on live DB | Use `ADD VALUE` migration; test on compose Postgres |
| Breaking direct `→ watched` clients | Block `active → watched` via status endpoint; only allow via watch-review complete |
| RSS films stuck in `pending_watch_review` | Visible on Watched tab + Review queue; user can complete or cancel |
| Half-star UI accessibility | Keyboard + aria labels; unit tests for value steps |
| Rollback | Revert migration + code; films in `pending_watch_review` would need manual SQL cleanup — document in migration downgrade if feasible |

## Definition of done

- [ ] All acceptance criteria in `SPEC.md` implemented
- [ ] Alembic migration applies cleanly on fresh and existing DB
- [ ] API + frontend types in sync (`api.ts`, OpenAPI)
- [ ] All tests in **Tests required** table pass
- [ ] `bash scripts/verify-phase8-gates.sh` exits 0
- [ ] `documents/api-contracts.md` and `documents/database-design.md` updated
- [ ] No regression in metadata match review or #115 tabbed watchlist flows
- [ ] Demo scenarios in `demo/demo-spec.md` capturable on cloud VM

## PR seed

**Tier:** application
**What / why:** Add `pending_watch_review` status and `film_watches` table so marking a film watched captures score, date, and notes before it becomes fully watched — matching Letterboxd diary spirit and enabling watch history.
**Key changes:** New status + migration; RSS pre-fill from `watchedDate`/`memberRating`; watch review dialog; two-section `/review` page; Watched tab shows pending + complete; film detail watch history with edit; combined nav badge count.
**Gate:** Application default: `bash scripts/verify-phase8-gates.sh` exit 0 at `<short-sha>`
**How to test:** Mark a film watched → complete dialog; cancel reverts to watchlist; seed RSS pending review → complete on `/review`; edit watch record on film detail; confirm badge counts both queues.
