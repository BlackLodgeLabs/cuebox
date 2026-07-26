# Demo spec — issue #140

Home inline search-picker + global header search. Demo agent follows this exactly on the cloud VM.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health OK:
  - `curl -sf "$APP_HEALTH_URL_FRONTEND"` (default `http://localhost:3000/api/v1/health`)
  - `curl -sf "$APP_HEALTH_URL_API"` (default `http://localhost:8000/api/v1/health`)
- Seeded watchlist present (Part 2: ≥10 films with `enrichment_status: ready`). Home must show the returning-user hub (**What do you want to watch?**), not the empty Import CTA.
- Source config first: `source scripts/cursor-workflow-config.sh`

### Seed steps

1. If films missing: `python3 scripts/seed-dev-db.py` (or restart stack per `documents/cloud-agent-part2-test-data.md`).
2. Confirm: `curl -sf "http://localhost:3000/api/v1/films?limit=1"` → `pagination.total >= 10`, first film `enrichment_status == "ready"`.
3. Open http://localhost:3000 — expect returning-user hub (not Import watchlist CTA).

No special API keys required for layout/focus/header demos. TMDB-backed live search needs `TMDB_API_KEY` in `.env` for Scenario 4; if the key is missing, capture the empty/error state and note it in `demo-notes.md`, then rely on execute’s mocked E2E for **Add & mark watched**.

## Scenarios

### Scenario 1: Home inline picker (returning user)

**Goal:** Prove the picker is embedded on Home and dual intent CTAs are gone.

**Steps:**

1. Open http://localhost:3000/
2. Confirm heading **What do you want to watch?** (or updated Home heading).
3. Confirm an inline search field (placeholder **Find a film…** or labeled Library/TMDB search) appears **above** New recommendation / Start questionnaire and History.
4. Confirm there are **no** links/buttons **Add a film** or **Mark watched** that navigate to `/search?intent=…`.
5. Type a short query that matches a seeded library title (e.g. part of a known seed film title). Confirm library hit(s) with status-aware actions (View / Mark watched as applicable).

**Capture:**

- Screenshot: `workflow/issues/issue-140/demo/scenario-1-home-inline-picker.png`

**Pass criteria:**

- Inline picker visible on Home without visiting `/search` as a standalone page.
- Dual intent CTAs absent.
- Picker sits above recommendation and History entry points.

### Scenario 2: `/search` alias focuses Home

**Goal:** Prove `/search` is redirect-only and focuses the Home field.

**Steps:**

1. Open http://localhost:3000/search
2. Confirm the URL resolves to Home (`/` or briefly `/?focus=search` then cleared to `/`).
3. Confirm the search input is focused (and scrolled into view if the page was long).
4. Optionally open http://localhost:3000/search?intent=mark-watched — same result (intent ignored).

**Capture:**

- Screenshot: `workflow/issues/issue-140/demo/scenario-2-search-alias-focus.png` (Home with focused/visible search field; address bar showing `/` without sticky `focus` if already cleared)

**Pass criteria:**

- No standalone `/search` picker chrome (old “Add a film” / “Mark a film watched” page titles gone).
- Home picker receives focus after alias navigation.

### Scenario 3: Header search icon

**Goal:** Prove global header search reaches the same alias.

**Steps:**

1. Open http://localhost:3000/watchlist (or any shell screen).
2. Locate the header control with accessible name **Search films** (magnifying glass).
3. Activate it.
4. Confirm navigation goes through `/search` to Home with the inline field focused.

**Capture:**

- Screenshot: `workflow/issues/issue-140/demo/scenario-3-header-search.png` (header icon visible on a non-Home page before or after click; prefer after landing on focused Home)

**Pass criteria:**

- Icon present on primary shell screens with name **Search films**.
- Activation lands on Home inline search (via `/search` alias).

### Scenario 4: TMDB actions (live or noted skip)

**Goal:** Prove TMDB-only hits expose **Add to watchlist** and **Add & mark watched** when TMDB search works.

**Steps:**

1. On Home, search for a title unlikely to be on the local watchlist but present on TMDB (e.g. a well-known title not in the seed set).
2. On a TMDB-only row, confirm both **Add to watchlist** and **Add & mark watched**.
3. If safe on this VM (and key present), click **Add & mark watched** once: expect enrichment wait → **Review watched film** dialog (do not need to submit the diary).
4. If `TMDB_API_KEY` missing or TMDB errors: screenshot the partial-error / no TMDB results state and record skip in `demo-notes.md`.

**Capture:**

- Screenshot: `workflow/issues/issue-140/demo/scenario-4-tmdb-actions.png`
- Optional short recording: `workflow/issues/issue-140/demo/scenario-4-add-mark-watched.mp4` (&lt;30s) if the dialog opens

**Pass criteria:**

- Both TMDB actions visible when TMDB hits render, **or** documented key/API skip with error-state screenshot.
- If exercised: dialog opens after ready enrichment without navigating away to film detail first.

### Scenario 5: Empty-watchlist focus no-op (optional if easy)

**Goal:** Prove empty hub stays Import-only when focus is requested.

**Steps:**

1. Only if a second browser profile / emptied DB is practical without destroying the seeded demo volume permanently. Prefer documenting “skipped — preserve Part 2 seed” over `docker compose down -v`.
2. If executed: with empty watchlist, open `/?focus=search` → Import CTA only, no picker, no crash.

**Capture:**

- Screenshot (only if run): `workflow/issues/issue-140/demo/scenario-5-empty-focus-noop.png`

**Pass criteria:**

- No picker on empty hub; page stable. Skip is acceptable to preserve seed data — note in `demo-notes.md`.

## Artifacts checklist

- [ ] `scenario-1-home-inline-picker.png`
- [ ] `scenario-2-search-alias-focus.png`
- [ ] `scenario-3-header-search.png`
- [ ] `scenario-4-tmdb-actions.png` (and optional `.mp4`)
- [ ] `scenario-5-empty-focus-noop.png` (or skip noted)
- [ ] `workflow/issues/issue-140/demo/demo-notes.md` — date, commit SHA, tier `application`, pass/fail per scenario, any TMDB skip
- [ ] No secrets in images or logs
