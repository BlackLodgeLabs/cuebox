# Demo spec — issue #99: Add a film to your watch list

Planning agent output. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — all four containers Up)
- Health checks pass:
  - `curl -sf http://localhost:3000/api/v1/health`
  - `curl -sf http://localhost:8000/api/v1/health`
- Seeded watchlist present (cloud Part 2 gate): at least 10 films with `enrichment_status: ready`
- `TMDB_API_KEY` set in `.env` (required for live TMDB search in UI)
- `OPENAI_API_KEY` set for enrichment to reach `ready` on newly added films (optional for scenarios that stop at `review_required`)

### Seed steps

Default Part 2 seed is sufficient for Scenarios 1–3. No extra seeding required unless execute adds scenario-specific fixtures.

To verify restore flow (Scenario 5), execute should document a seeded archived film URI in `demo-notes.md` or demo agent archives one film via API before recording:

```bash
# Example: pick a film URI from the seeded watchlist, archive via CSV sync diff in test DB only
# Prefer using a film execute marks in demo-notes.md during implementation
```

## Scenarios

### Scenario 1: Happy path — add film from Home

**Goal:** Prove TMDB search, confirm add, enrichment completes, film appears on watchlist.

**Steps:**

1. Open http://localhost:3000 — confirm **Add film to watchlist** appears between **New recommendation** and **History**.
2. Click **Add film to watchlist** → navigates to `/watchlist/add`.
3. Search for a film not already on the seeded watchlist (e.g. `The Matrix` or a title execute confirms is absent).
4. Select a result from the list (poster, title, year visible).
5. Click confirm/add.
6. Wait for enrichment to complete (poll UI or refresh watchlist).
7. Open watchlist and locate the added film with status **Ready**.

**Capture:**

- Screenshot: `workflow/issues/issue-99/demo/scenario-1-home-cta.png` (Home with three CTAs)
- Screenshot: `workflow/issues/issue-99/demo/scenario-1-search-results.png` (search results on `/watchlist/add`)
- Screenshot: `workflow/issues/issue-99/demo/scenario-1-added-ready.png` (film on watchlist with Ready status)
- Optional screen recording: `workflow/issues/issue-99/demo/scenario-1.mp4` (search → confirm → ready, under 45s)

**Pass criteria:**

- Home shows three actions in correct order when watchlist exists.
- Added film has real `letterboxd_uri` (not pending placeholder) and `enrichment_status: ready`.
- Film is eligible on watchlist list (`on_watchlist: true`).

### Scenario 2: Watchlist page entry point

**Goal:** Prove Watchlist page add button links to the same flow.

**Steps:**

1. Open http://localhost:3000/watchlist.
2. Confirm an **Add film** (or equivalent) button is visible in the page header area.
3. Click it → lands on `/watchlist/add`.

**Capture:**

- Screenshot: `workflow/issues/issue-99/demo/scenario-2-watchlist-button.png`

**Pass criteria:**

- Button visible and navigates to `/watchlist/add`.

### Scenario 3: Already on watchlist

**Goal:** Duplicate handling shows friendly message without creating a second row.

**Steps:**

1. Pick a film already on the seeded watchlist; note its TMDB id via API or film detail if needed.
2. Open `/watchlist/add`, search and select the same TMDB result.
3. Confirm add.
4. Observe UI message: already on watchlist with link to existing film detail.

**Capture:**

- Screenshot: `workflow/issues/issue-99/demo/scenario-3-duplicate.png`

**Pass criteria:**

- No duplicate watchlist row; message links to `/watchlist/{film_id}`.
- API returns `already_on_watchlist: true` (verify via browser network tab or curl if UI is subtle).

### Scenario 4: Letterboxd redirect failure → review queue

**Goal:** When Letterboxd redirect cannot resolve, user can paste URL on review page.

**Steps:**

1. Use a TMDB id that fails redirect in test (execute documents id in `demo-notes.md`, or use mocked dev fixture if execute provides `developer_mode` test hook).
2. Add via `/watchlist/add` → lands in `review_required`.
3. Open http://localhost:3000/review.
4. Confirm card shows **paste Letterboxd URL** copy (not TMDB accept/reject).
5. Paste a valid Letterboxd film URL for the same film; submit.
6. Wait for enrichment → `ready`.

**Capture:**

- Screenshot: `workflow/issues/issue-99/demo/scenario-4-review-paste.png` (review card with paste input)
- Screenshot: `workflow/issues/issue-99/demo/scenario-4-after-resolve.png` (film ready after paste)

**Pass criteria:**

- Distinct review UI for `letterboxd_uri` type.
- After paste, film gets canonical `letterboxd_uri` and reaches `ready`.

**Note:** If live Letterboxd redirect cannot be forced on VM, demo agent may use curl against API with a test TMDB id from `demo-notes.md` written by execute, then complete UI steps from review page only.

### Scenario 5: Restore archived film

**Goal:** Adding a previously archived film restores it to active watchlist.

**Steps:**

1. Use a film execute archived for demo (see Seed steps / `demo-notes.md`).
2. Add the same film via `/watchlist/add` (TMDB search).
3. Confirm success copy indicates restored / added back.
4. Verify film `status: active` on watchlist.

**Capture:**

- Screenshot: `workflow/issues/issue-99/demo/scenario-5-restored.png`

**Pass criteria:**

- Film restored to active watchlist without duplicate row.

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-99/demo/`
- [ ] `workflow/issues/issue-99/demo/demo-notes.md` with short narrative, test TMDB ids used, any seed commands run
- [ ] No secrets in images or logs
- [ ] Optional recordings under 45s each
