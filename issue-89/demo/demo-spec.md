# Demo spec — issue #89

Demo agent follows this exactly after execute. Application tier — full Docker stack required.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health OK:
  - `curl -sf "$APP_HEALTH_URL_API"` → `"status":"ok"`, `"database":"ok"`
  - `curl -sf "$APP_HEALTH_URL_FRONTEND"` → same
- Frontend HTTP 200: `http://localhost:3000`
- Resolve health URLs via `source scripts/cursor-workflow-config.sh` (`APP_HEALTH_URL_*`)
- API migrated through `0008` (compose API entrypoint runs `alembic upgrade head`)
- Fixture CSVs available at `api/tests/fixtures/watched_import/{watched,ratings,diary}.csv` (same shape as issue attachments)

### Seed steps

1. Prefer a **clean or known** DB for import demos. If Part 2 seed data is present, that is fine — import must merge without duplicating films by URI.
2. Optional reset for a crisp demo: `docker compose down -v && bash scripts/cloud-start-stack.sh` (or compose up + `python3 scripts/seed-dev-db.py` only if scenarios need a non-empty active list for status-transition demos).
3. For Scenario 3 (active → watched), ensure at least one film from the fixture set exists as **active** on the watchlist (e.g. add via URI match or temporary seed). If none overlap, skip Scenario 3 and note in `demo-notes.md`, or create an active film matching `https://boxd.it/2D2e` (12 Years a Slave) before import.
4. Copy fixtures to a reachable path for browser upload (they are already in the repo bind-mount).

**No Scenario 0** — this is a feature, not a bug fix.

## Scenarios

### Scenario 1: Settings shows separate Import watched history card

**Goal:** Prove watched import is visually separate from watchlist CSV sync.

**Steps:**

1. Open `http://localhost:3000/settings/sync`.
2. Confirm existing **CSV re-sync** and **RSS sync** cards remain.
3. Confirm a distinct **Import watched history** card with three file inputs (`watched.csv`, `ratings.csv`, `diary.csv`) and an Import action disabled until all three are selected.

**Capture:**

- Screenshot: `workflow/issues/issue-89/demo/scenario-1-settings-watched-import.png`

**Pass criteria:**

- Three-file import UI is present and visually separate from watchlist CSV sync.
- Import CTA stays disabled with fewer than three files selected.

### Scenario 2: Import sample CSVs — summary and Watched tab

**Goal:** End-to-end import of issue fixtures; completed watches appear on Watched.

**Steps:**

1. On Settings → Sync, select:
   - `api/tests/fixtures/watched_import/watched.csv`
   - `api/tests/fixtures/watched_import/ratings.csv`
   - `api/tests/fixtures/watched_import/diary.csv`
2. Click Import; wait for success summary.
3. Note counts: films processed, watches created, duplicates skipped (0 on first run), pending review (≥1 for Seven Samurai), failures.
4. Follow CTA / open `http://localhost:3000/watchlist?tab=watched`.
5. Confirm imported films appear (e.g. Hellraiser, Kneecap, Sid and Nancy, 12 Years a Slave).
6. Open **12 Years a Slave** detail; confirm a completed watch dated `1984-09-28` with **unrated** / null score (no fake star value).
7. Open **Hellraiser**; confirm completed watch with score and default date `1984-09-28`.
8. Open **Kneecap**; confirm **two** completed watch dates (`2024-11-03`, `2026-02-25`).

**Capture:**

- Screenshot: `workflow/issues/issue-89/demo/scenario-2-import-summary.png`
- Screenshot: `workflow/issues/issue-89/demo/scenario-2-watched-tab.png`
- Screenshot: `workflow/issues/issue-89/demo/scenario-2-unrated-detail.png`
- Optional API proof: save `curl` multipart response as `workflow/issues/issue-89/demo/scenario-2-api-response.json`

**Pass criteria:**

- Summary shows watches created and `pending_review >= 1`.
- Watched tab lists imported films.
- Unrated completed watch renders without inventing a star rating.
- Kneecap shows two distinct watch events.

### Scenario 3: Status transition active → watched (if seeded)

**Goal:** Film previously on active watchlist moves to Watched and frees an active slot.

**Steps:**

1. Before or after ensuring an overlapping active film exists (see Seed steps), note active count (`GET /api/v1/films?status=active&limit=1` → `pagination.total`).
2. Run the three-file import (or re-run if already imported — duplicates should skip watches but status transition still applies if still active).
3. Confirm the film is no longer active and appears under Watched.
4. Confirm active count decreased by the transitioned film(s) (or document if already transitioned on first import).

**Capture:**

- Screenshot: `workflow/issues/issue-89/demo/scenario-3-active-to-watched.png`
- Optional: `scenario-3-active-count.json` before/after

**Pass criteria:**

- Former active film is `watched` (or pending if diary-without-score) and not on Active tab.
- Active 500 cap path was not blocked by watched import.

### Scenario 4: Diary-without-score → review queue

**Goal:** Seven Samurai enters pending watch review with diary Watched Date.

**Steps:**

1. After import, open the watch-review queue (home / watchlist pending review entry used by #93 UI).
2. Find **Seven Samurai**; confirm pending watched date `2023-12-31` (diary Watched Date, not `2024-07-19`).
3. Complete the review with a score (e.g. 4.0); confirm film moves to Watched.

**Capture:**

- Screenshot: `workflow/issues/issue-89/demo/scenario-4-review-queue.png`
- Screenshot: `workflow/issues/issue-89/demo/scenario-4-after-complete.png`

**Pass criteria:**

- Seven Samurai is pending with correct Watched Date.
- Completing review yields `status=watched` and a scored watch row.

### Scenario 5: Idempotent re-upload

**Goal:** Second upload of the same three files skips duplicate watch events.

**Steps:**

1. Upload the same three fixture files again.
2. Confirm summary: `watches_skipped_duplicate` > 0 (or watches_created == 0 for already-imported events); no deletion of existing watches.
3. Watched tab counts / Kneecap still show two watches (not four).

**Capture:**

- Screenshot: `workflow/issues/issue-89/demo/scenario-5-reupload-summary.png`
- Optional: `scenario-5-api-response.json`

**Pass criteria:**

- Re-upload is additive/idempotent; no duplicate watch rows for same film + `watched_at`.

### Scenario 6: Cap unchanged (API check)

**Goal:** Watched import does not apply the 500 active watchlist cap.

**Steps:**

1. `curl -sf -X POST` multipart to `http://localhost:8000/api/v1/sync/watched` with fixtures (or rely on UI run).
2. Confirm response is not `WATCHLIST_SIZE_EXCEEDED`.
3. Optionally note in `demo-notes.md` that active cap constant remains 500 for `/sync/csv` only (cite code or a quick CSV sync validation if easy).

**Capture:**

- File: `workflow/issues/issue-89/demo/scenario-6-cap-notes.md` (short note + response snippet)

**Pass criteria:**

- Watched import succeeds without watchlist size errors.
- No evidence that imported watched films were counted toward the active 500.

## Artifacts checklist

- [ ] `scenario-1-settings-watched-import.png`
- [ ] `scenario-2-import-summary.png`
- [ ] `scenario-2-watched-tab.png`
- [ ] `scenario-2-unrated-detail.png`
- [ ] `scenario-3-active-to-watched.png` (or skip noted)
- [ ] `scenario-4-review-queue.png`
- [ ] `scenario-4-after-complete.png`
- [ ] `scenario-5-reupload-summary.png`
- [ ] `scenario-6-cap-notes.md`
- [ ] `workflow/issues/issue-89/demo/demo-notes.md` — date, commit SHA, tier `application`, gate line, narrative of pass/fail per scenario
- [ ] No secrets in images or logs
