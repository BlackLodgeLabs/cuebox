# Issue #93: Review watched films

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/93

## Summary

When a film is marked as watched (manually in Cuebox or via Letterboxd RSS diary poll), it enters a **`pending_watch_review`** interim state until the user saves a short post-watch diary entry (score, watched date, optional notes). After save, the film becomes **`watched`** and the entry is persisted as a **watch record** (many-to-one with the film, enabling future rewatches). Manual marking opens an immediate review dialog; RSS-triggered watches queue on `/review` and the **Watched** tab. Users can view and edit watch history on the film detail page.

Coordinates with [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) (tabbed watchlist, status transitions). CSV sync is **out of scope**.

## Problem

Today, marking a film watched (manual or RSS) immediately sets `films.status = watched` with no user score, watched date, or notes. RSS does not parse `letterboxd:watchedDate` or `letterboxd:memberRating`. The `/review` page only handles metadata match review (`metadata_match_reviews`), not post-watch diary capture. There is no watch-history model, no half-star rating UI, and the film detail page shows no personal watch data.

Users need a lightweight diary step—similar in spirit to metadata match review—so Cuebox records *how* they watched a film, not just *that* they watched it. Downstream features (Insights “watched this year”, personal ratings, rewatches) depend on first-class watch-event persistence.

## Acceptance criteria

### Status and state machine

- [ ] New `FilmStatus` value: `pending_watch_review`
- [ ] `active → pending_watch_review`: manual **Mark watched** (opens review dialog) or RSS diary match for an existing DB film
- [ ] `pending_watch_review → watched`: user saves a complete watch review (score + watched date; notes optional)
- [ ] `pending_watch_review → active`: user dismisses/cancels the manual review dialog without saving (no watch record created)
- [ ] `watched → active`: **Return to watchlist** still works; existing watch records are retained as history
- [ ] `pending_watch_review` and `watched` are excluded from recommendation candidates (same as `watched` today)
- [ ] Forbidden transitions remain blocked (`watched ↔ archived`, etc. per #115); document behavior for `pending_watch_review` ↔ `archived`
- [ ] Deactivating the active watchlist entry on enter `pending_watch_review` (same side effect as marking watched today)

### Watch records (data model)

- [ ] New `film_watches` table (many-to-one `film_id → films.id`): `score` (0.5–5.0 in 0.5 steps), `watched_at` (date), `notes` (optional text), `source` (`manual` | `rss`), timestamps
- [ ] One **pending** watch record may exist while `films.status = pending_watch_review`; completing review marks it final and transitions film to `watched`
- [ ] Schema supports multiple watch records per film (rewatches are a future feature; this issue ships the shape and history UI)
- [ ] Alembic migration + ORM model + repository layer

### RSS integration

- [ ] Parse `letterboxd:watchedDate` and `letterboxd:memberRating` from diary RSS items in `parse_diary_feed()`
- [ ] On RSS watched match for a film **already in the DB** (current `find_for_rss_watched` behavior): transition to `pending_watch_review`, create pending watch record with pre-filled `watched_at` (from `watchedDate`) and `score` (from `memberRating` when present; user can amend on save)
- [ ] RSS watched events for films **not** in the DB remain a no-op (no review queue entry)
- [ ] Use `watchedDate` for the date field, not `pubDate` / `event_timestamp`

### Manual watch flow

- [ ] **Mark watched** (watchlist row + film detail) transitions to `pending_watch_review` and opens a review dialog styled like `EditFilmMatchDialog` (Radix `Dialog`, header/footer, primary save)
- [ ] Pre-fill watched date to **today** (local/user-appropriate date); score empty unless user selects
- [ ] **Save**: validate required fields, persist watch record, transition to `watched`
- [ ] **Cancel / dismiss dialog**: revert film to `active`, remove any draft pending watch record; film does not appear on Watched tab or Review page
- [ ] CSV sync does **not** trigger watch review (out of scope)

### Review page (`/review`)

- [ ] Same route; two sections when either queue has items:
  1. **Match review** — existing metadata match review cards (TMDB accept/reject, Letterboxd URI)
  2. **Watched films to review** — films in `pending_watch_review` from RSS (and any other non-dialog path)
- [ ] Section-level empty states (e.g. match section hidden when empty; page-level empty only when **both** queues are empty)
- [ ] Clicking a watched-review card opens the same review dialog (score, date, notes) as manual flow
- [ ] Suitable page title/subtitle copy, e.g. heading **Review** with subtitle covering both match and watch diary work
- [ ] Nav badge (`usePendingReviewCount` / `AppShell`) sums **metadata review count + pending watch review count**
- [ ] Home page warning card (if shown for pending reviews) reflects combined count

### Watched tab

- [ ] **Watched** tab lists films with `status IN (pending_watch_review, watched)`
- [ ] `pending_watch_review` rows show a clear indicator that diary entry is incomplete (e.g. badge or secondary label)
- [ ] Completed `watched` films show watch date from latest watch record (not `removed_at` alone) where available

### Review inputs (dialog)

- [ ] **Score**: 0.5–5.0 in half-star steps; interactive star control; **required** (minimum ½ star)
- [ ] **Watched date**: date picker/input; **required**; must not be in the future; RSS pre-fill from `watchedDate`; manual default today
- [ ] **Notes**: optional multiline text
- [ ] Client and API validation with clear error messages
- [ ] Save disabled or blocked until score and date are valid

### Film detail page — watch history

- [ ] When a film has one or more watch records, show a **Watch history** section (hidden when no records)
- [ ] List all watch records (newest first): score (stars), watched date, notes snippet
- [ ] **Edit** affordance per record (inline or edit dialog) to update score, date, and notes after initial save
- [ ] Section visible for `watched` films; for `pending_watch_review`, prompt to complete review (dialog or inline CTA)
- [ ] API: `GET /films/{id}` includes watch records; `PATCH /films/{id}/watches/{watch_id}` (or equivalent) for edits

### API

- [ ] `GET /films/watch-review-required` (or typed extension of review listing) for pending watch review queue
- [ ] `POST /films/{id}/watch-review` — complete pending review (or `POST /films/{id}/watches` with status transition)
- [ ] `PATCH /films/{id}/watches/{watch_id}` — edit existing watch record
- [ ] `GET /films?status=watched` behavior documented: includes `pending_watch_review` for Watched tab query (may be `status=watched` expanded server-side or explicit multi-status param)
- [ ] Combined pending-review count endpoint or client aggregation documented in `documents/api-contracts.md`
- [ ] OpenAPI / `frontend/src/types/api.ts` updated

### Tests

- [ ] API unit/integration: status transitions (`active → pending_watch_review → watched`, cancel revert, RSS pre-fill, validation)
- [ ] API: edit watch record; multiple records per film (insert second record manually in test for history UI)
- [ ] API: recommendation exclusion for `pending_watch_review`
- [ ] API: RSS no-op for unknown films; RSS pre-fill `watchedDate` + `memberRating`
- [ ] Frontend unit tests: star input, dialog cancel/save, review page sections, badge count, watch history edit
- [ ] Regression: metadata match review flow unchanged; #115 status transitions still pass

## Scope

### In scope

- `pending_watch_review` film status and transition rules
- `film_watches` table and CRUD for complete + pending records
- RSS parser fields: `letterboxd:watchedDate`, `letterboxd:memberRating`
- Manual review dialog on mark watched (save / cancel revert)
- `/review` two-section layout + combined nav badge
- Watched tab includes pending + completed; incomplete indicator
- Half-star score UI, date + notes fields
- Film detail watch history list with edit
- API contract and migration docs
- Tests listed above

### Out of scope

- CSV-triggered watch review or CSV watched-status diff
- Rewatch trigger flow (marking a already-watched film watched again)
- Letterboxd write-back of scores/notes
- Bulk complete or bulk edit of watch reviews
- Insights / Ask integration using watch data (depends on this issue landing first)
- New star-rating component reuse outside watch review (minimal scope: watch flows only)

## User flows / API changes

### Flow A — Manual mark watched (happy path)

1. User clicks **Mark watched** on watchlist row or film detail (`status = active`).
2. API: `POST /films/{id}/status` with `{ "status": "pending_watch_review" }` (or dedicated endpoint) — deactivates watchlist entry.
3. Review dialog opens: date = today, score empty.
4. User selects ≥½ star, confirms date, optional notes → **Save**.
5. API persists watch record; `status → watched`.
6. Film appears on **Watched** tab with score/date; detail page shows watch history.

### Flow B — Manual mark watched (cancel)

1. Steps 1–3 as Flow A.
2. User closes dialog or clicks **Cancel**.
3. API: `status → active`, reactivate watchlist entry if appropriate; delete draft watch record.
4. Film remains on **Watchlist** tab only.

### Flow C — RSS diary watched

1. RSS poll matches diary entry to existing film.
2. API: `status → pending_watch_review`; create pending watch record with RSS pre-fills.
3. Film appears on **Watched** tab (incomplete badge) and **Review → Watched films to review**.
4. User opens card → same dialog → **Save** → `watched`.

### Flow D — Edit watch record

1. User opens film detail for a `watched` film with history.
2. **Watch history** lists entries; user clicks **Edit** on a row.
3. Dialog pre-filled; user changes score/date/notes → **Save**.
4. API `PATCH` updates record; UI refreshes.

### Status diagram

```text
active ──Mark watched──► pending_watch_review ──Save review──► watched
  ▲                            │
  └──Cancel dialog─────────────┘

RSS match (film in DB) ──► pending_watch_review ──Save review──► watched

watched ──Return to watchlist──► active  (watch records retained)
```

## Data and integration notes

- **Enum migration**: add `pending_watch_review` to PostgreSQL `film_status` enum and `FilmStatus` in `api/app/database/enums.py`.
- **`film_watches`**: prefer this table over columns on `films` (per ROADMAP). Index on `(film_id, watched_at DESC)`.
- **RSS payload**: store raw `watchedDate` / `memberRating` on pending record at creation; `memberRating` may need normalization to 0.5-step 0.5–5 scale.
- **`SyncService._apply_watched`**: replace immediate `mark_watched()` with pending review path.
- **`FilmStatusService`**: extend transition matrix; cancel path must restore watchlist entry.
- **Recommendations**: `list_recommendation_candidates` excludes `pending_watch_review` and `watched`.
- **Badge**: extend `usePendingReviewCount` to fetch both queues or add `GET /reviews/pending-count` aggregate.
- **Design**: dialog follows `EditFilmMatchDialog` / `FilmStatusActions` archive dialog patterns; stars use design tokens from `documents/DESIGN.md`.

## Open questions

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/93
- Depends on: [#115 Tabbed watchlist](https://github.com/BlackLodgeLabs/cuebox/issues/115) (merged)
- ROADMAP theme: [Watched film review](documents/ROADMAP.md#theme-watched-film-review)
- Modal reference: `frontend/src/components/edit-film-match-dialog.tsx`
- RSS parser: `api/app/services/rss_parser.py`
- Current review page: `frontend/src/app/review/page.tsx`
