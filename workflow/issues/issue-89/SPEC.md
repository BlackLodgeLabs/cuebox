# Issue #89: Import watched list

## Summary

Add a Letterboxd **watched-library import** that accepts three CSVs (`watched.csv`, `ratings.csv`, `diary.csv`), merges them into Cuebox watch history, and surfaces results on the existing Watched list / review queue. Keep this visually separate from watchlist CSV sync on Settings, while reusing import/sync patterns where sensible. Active watchlist remains capped at 500; imported watched films do not count toward that cap.

## Problem

Cuebox can import an active Letterboxd watchlist and mark individual films watched (manual + RSS review flow from #93), but there is no way to bulk-load existing watched history and ratings from Letterboxd’s export files. Users with a large diary/watched library cannot seed Cuebox without manually reviewing each film. The current `film_watches.score NOT NULL` and `WatchSource ∈ {manual, rss}` model also cannot represent Letterboxd watched-only rows that have no score.

## Acceptance criteria

- [ ] Settings → Sync exposes a **separate** “Import watched history” section (distinct from watchlist CSV sync) that requires uploading all three files: `watched.csv`, `ratings.csv`, `diary.csv`
- [ ] API accepts the three files in one request, validates Letterboxd export headers, and returns a job/status (or equivalent) summarizing created/updated/skipped watches and any failures
- [ ] Merge rules start from `watched.csv`, left-join `ratings.csv` and `diary.csv` on **Name + Year**, and use diary **`Watched Date`** (never diary `Date`)
- [ ] Films with no diary row get `watched_at = 1984-09-28` and may have a null score when unscored
- [ ] Films with one or more diary rows and no score enter `pending_watch_review` so the user can supply a score in the existing review UI
- [ ] Films with a rating (from `ratings.csv`) write completed `film_watches` rows (`is_pending = false`) and set film `status = watched` (no review queue), including rated-but-no-diary rows (score + default date)
- [ ] Multiple diary rows for the same film create **one watch event per diary row** (rewatches)
- [ ] Re-upload is additive: skip duplicate watch events keyed by **film + `watched_at`**; do not delete or rewrite existing watches
- [ ] Status transitions when a film appears in `watched.csv`:
  - `active` → `watched` (deactivate watchlist entry)
  - `pending_watch_review` → finalize to `watched` when import supplies a score; otherwise keep/refresh pending with imported date
  - `archived` → `watched`
  - already `watched` → add only new watch records (no duplicate film row)
- [ ] Films already in the DB are matched (prefer `letterboxd_uri`, else title+year) and not duplicated; watch history is updated per rules above
- [ ] New films not in the DB get the full enrichment pipeline (TMDB + semantic + embedding), same quality bar as watchlist import
- [ ] Imported / transitioned watched films appear on the frontend **Watched** tab
- [ ] Active watchlist **500-film cap is unchanged**; watched-library import is uncapped and watched films never count toward the active 500
- [ ] Schema allows null `film_watches.score` for completed watched-only imports; check constraints and API/UI tolerate unrated completed watches
- [ ] Unit/integration tests cover the sample scenarios in the issue (watched-only, rated-no-diary, diary-no-rating → review queue, multi-diary, Date ≠ Watched Date, rewatch, idempotent re-upload, status transitions, cap behavior)
- [ ] Fixture CSVs under `test/` (or `api/tests/fixtures/`) mirror the issue’s sample shape for regression

## Scope

### In scope

- Backend: parse/merge the three Letterboxd CSVs; persist `film_watches`; status transitions; enrichment enqueue for new films
- Schema: nullable `film_watches.score`; extend `WatchSource` (e.g. `letterboxd_import`); idempotent uniqueness for non-pending `(film_id, watched_at)`
- API: new multipart endpoint (suggested `POST /api/v1/sync/watched` or `/import/watched`) + status payload
- Frontend: Settings watched-import UI section; Watched list / detail display for null scores; review-queue path for diary-without-score imports
- Docs: brief API/contract notes for the new endpoint and score nullability
- Tests + sample fixtures from the issue’s scenario table

### Out of scope

- Merging watchlist + watched into a single four-file upload UX (future)
- Questionnaire / recommendation option to include watched films as candidates (future)
- Removing or raising the active 500 watchlist cap
- Letterboxd write-back
- Importing rating-entry dates or “marked watched” timestamps unrelated to diary `Watched Date`
- Changing RSS / manual mark-watched flows beyond what import status transitions require
- Insights / Ask surfaces consuming imported history (#51)

## User flows / API changes

### Settings UI

1. User opens **Settings → Sync**.
2. Existing **Watchlist CSV** and **RSS** cards remain unchanged.
3. New card **Import watched history** asks for three files (`watched.csv`, `ratings.csv`, `diary.csv`) and an Import action.
4. On success, show counts: films processed, watches created, watches skipped (duplicates), films sent to review queue, enrichment failures (if any).
5. Link/CTA to **Watched** tab and, when `pending_review > 0`, to the existing watch-review queue.

### Merge algorithm (authoritative)

```
DEFAULT_WATCHED_AT = 1984-09-28

For each row in watched.csv (key = Name.strip + Year.strip):
  rating = ratings_by[key]            # optional, at most one
  diary_rows = diary_by[key]          # 0..N, preserve all

  If diary_rows empty:
    emit one watch event:
      watched_at = DEFAULT_WATCHED_AT
      score = rating.Rating if present else null
      completed = true   # even when score is null

  Else:
    For each diary_row:
      watched_at = diary_row["Watched Date"]   # NOT "Date"
      score = rating.Rating if present else null
      if score is null:
        completed = false  # pending_watch_review path
      else:
        completed = true
```

Ignore ratings.csv `Date` and any non–Watched-Date diary timestamps.

### Score / review rules (clarified)

| Situation | Film status | `film_watches` |
|-----------|-------------|----------------|
| Watched only, no diary, no rating | `watched` | 1 completed row, `score = null`, `watched_at = 1984-09-28` |
| Rated, no diary | `watched` | 1 completed row, score from ratings, default date |
| Diary + rating (1..N diary rows) | `watched` | N completed rows, same score, each diary `Watched Date` |
| Diary, no rating (1 diary row) | `pending_watch_review` | 1 pending row, date from diary; user must score via existing review UI |
| Diary, no rating (N diary rows) | `pending_watch_review` | 1 pending row for earliest `Watched Date`; remaining diary dates staged and materialized as additional **completed** watches **with the same score** when the user finalizes the review |

Bulk import writes completed watches and `status=watched` directly **except** the diary-without-score cases above (those use `/review` / pending watch review).

### Idempotency

On a second upload of the same three files:

- For each candidate watch event, if a non-pending `film_watches` row already exists for `(film_id, watched_at)`, **skip** (do not update score/notes/source).
- Pending rows: if the film is already `pending_watch_review`, refresh pending `watched_at` from import when helpful; do not create a second pending (unique pending-per-film constraint).
- Never delete CSV-sourced or other watches on re-upload.

### Status transitions (existing DB films)

When the film is present in `watched.csv`:

| Current status | Behavior |
|----------------|----------|
| `active` | Deactivate watchlist entry; apply watch events; set `watched` or `pending_watch_review` per score rules |
| `pending_watch_review` | If import supplies a score → finalize pending (or replace with completed imports) and set `watched`. If still unscored diary → keep pending with imported date(s) |
| `archived` | Move to `watched` (or `pending_watch_review` if diary-without-score); apply watch events |
| `watched` | Add only new watch events; **do not** demote to `pending_watch_review` (forbidden by the #93 status machine, and RSS already no-ops once `watched`). Scored diary/rating events → completed watches. New **unscored** diary dates → completed watches with `score = null` (user can edit score later on the film detail watch list). |

### New films

1. Create film stub from Letterboxd URI / title / year (same identity rules as watchlist import where applicable).
2. Do **not** add an active watchlist entry solely because the film was watched-imported.
3. Enqueue full enrichment (TMDB match + metadata + semantic + embedding).
4. Apply watch events / status as above. Films may appear on Watched before enrichment completes; enrichment status remains visible as today.

### Suggested API shape

`POST /api/v1/sync/watched` (multipart):

- fields: `watched`, `ratings`, `diary` (each a CSV file)
- response: job id + immediate validation errors, or sync summary if synchronous for small files

Status fields (illustrative): `films_seen`, `watches_created`, `watches_skipped_duplicate`, `pending_review`, `films_enriched`, `failures[]`.

Exact path/schema is a planning detail; contracts must be documented in `documents/api-contracts.md`.

## Data and integration notes

### Schema changes required

- `film_watches.score`: drop `NOT NULL`; keep range check for non-null values (`NULL OR (score >= 0.5 AND score <= 5.0)`).
- `WatchSource`: add `letterboxd_import` (name flexible; must be distinct from `manual` / `rss`).
- Prefer unique index on `(film_id, watched_at)` for `is_pending = false` to enforce idempotency.
- Frontend types: `FilmWatchBlock.score: number | null`; Watched tab / detail render unrated watches without inventing a star value.

### Cap behavior

- `MAX_ACTIVE_WATCHLIST = 500` remains for active watchlist CSV sync / add paths that enforce it.
- Watched import must **not** call active-cap checks for imported watched films.
- Transitioning `active` → `watched` **frees** an active slot.

### Fixtures / scenarios (from issue)

| Film | Expected import outcome |
|------|-------------------------|
| 12 Years a Slave | Completed watch, default date, null score |
| Hellraiser | Completed watch, score + default date |
| Seven Samurai | `pending_watch_review`, diary watched date, no score |
| Love Lies Bleeding / The Lady Vanishes / Predator… / Sid and Nancy | Completed watches; diary `Watched Date` used even when `Date` differs |
| Groundhog Day | Rewatch diary row imported as its own watch event |
| Kneecap | Two completed watches if rated; two diary dates preserved |

### Dependencies

- Builds on #93 (`film_watches`, `pending_watch_review`) and #115 (Watched tab / status model).
- Reuse CSV parsing patterns from `csv_parser.py` / sync services; do not overload `POST /import` (watchlist-only) without a clear separate contract.

## Open questions

None — clarified on the issue (2026-07-20):

1. Unrated watches: diary-without-score → review queue; watched-only-without-diary → null score allowed.
2. 500 limit: keep active cap; watched import uncapped.
3. Re-upload: additive; skip duplicates by film + `watched_at`.
4. Status transitions: as listed in Acceptance criteria.
5. Enrichment: full pipeline for new films; bulk completed watches except diary-without-score → review queue.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/89
- Related: #93 Review watched films, #115 Tabbed watchlist
- Branch: `cursor/issue-89-import-watched-list-9ab1`
- Sample attachments on the issue: `watched.csv`, `ratings.csv`, `diary.csv`
