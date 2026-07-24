# Demo spec — issue #136

Demo agent follows this exactly after execute. Application tier — full Docker stack on the cloud VM.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health checks (from config):
  - `curl -sf "$APP_HEALTH_URL_FRONTEND"` → `"status":"ok"`, `"database":"ok"`
  - `curl -sf "$APP_HEALTH_URL_API"` → same
- Seeded watchlist present (Part 2): at least 10 films with `enrichment_status=ready`; Home shows returning-user CTAs (not empty Import CTA)
- `source scripts/cursor-workflow-config.sh` before using health URL vars
- TMDB: live key preferred for Scenario 3; if TMDB health is `error`, use mocked browser route **or** rely on API-backed local-only Scenario 2 and note TMDB skip in `demo-notes.md`

### Seed steps

1. Confirm Part 2 seed (or run `python3 scripts/seed-dev-db.py` if empty).
2. Ensure at least one **active** library film with known title (for Mark watched).
3. Optional: promote one film to `pending_watch_review` via watchlist Mark watched **without** completing review (for Complete review chrome), if not already present.
4. Optional: one `watched` film for View-only chrome.
5. Confirm no reliance on archived titles for positive cases.

```bash
curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] >= 10
assert d['data'][0]['enrichment_status'] == 'ready'
print('PASS: ready films present')
"
```

## Scenarios

### Scenario 1: Home entry points open shared picker

**Goal:** Returning Home exposes **Add a film** and **Mark watched**; both open the same picker surface with intent emphasis.

**Steps:**

1. Open http://localhost:3000/
2. Confirm returning-user home (not Import watchlist CTA).
3. Note **Add a film** and **Mark watched** controls.
4. Click **Add a film** → expect `/search` (or equivalent) with add intent (URL query and/or placeholder emphasis).
5. Return Home; click **Mark watched** → same picker route with mark-watched intent.

**Capture:**

- Screenshot: `workflow/issues/issue-136/demo/scenario-1-home-entries.png`
- Screenshot: `workflow/issues/issue-136/demo/scenario-1-picker-add-intent.png`
- Screenshot: `workflow/issues/issue-136/demo/scenario-1-picker-mark-intent.png`

**Pass criteria:**

- Both Home intents visible and open the shared picker.
- Helper copy indicates library (including watched) + TMDB; does not claim archived.

### Scenario 2: Local library hit — status-aware actions

**Goal:** Searching a known local title shows a library row with correct actions (not blind Add).

**Steps:**

1. Open picker via **Mark watched**.
2. Type a distinctive title of an **active** seeded film; wait for debounce/results.
3. Confirm local row with status badge/label and **View** + **Mark watched** (no **Add to watchlist** for that title if TMDB also returns it).
4. Click **View** → lands on `/watchlist/{filmId}`.
5. Back to picker; click **Mark watched** → pending watch-review path / `WatchReviewDialog` (same product rules as watchlist). Cancel or complete per existing UX; do not invent new transitions.
6. If a `pending_watch_review` film is available, search it and confirm **Complete review** (not Mark watched).
7. If a `watched` film is available, search it and confirm **View** only (no Mark watched).

**Capture:**

- Screenshot: `workflow/issues/issue-136/demo/scenario-2-local-active-actions.png`
- Screenshot: `workflow/issues/issue-136/demo/scenario-2-mark-watched-dialog.png` (dialog open)
- Optional: `workflow/issues/issue-136/demo/scenario-2-pending-or-watched.png` if those statuses were seeded

**Pass criteria:**

- Local active hit: View + Mark watched; reconciled TMDB duplicate not offered as Add.
- Mark watched uses existing review dialog / status transition (not a bypass to `watched`).
- Pending / watched chrome matches SPEC when those films are present.

### Scenario 3: TMDB-only hit — Add to watchlist

**Goal:** A title not in the local library shows **Add to watchlist** and succeeds via existing add path.

**Steps:**

1. Open picker via **Add a film**.
2. Search a TMDB title unlikely to be in the seed library (or confirm no local fold-in).
3. Select TMDB-only row → **Add to watchlist**.
4. Confirm navigation to film detail (or documented success path) without a blank error.

**Capture:**

- Screenshot: `workflow/issues/issue-136/demo/scenario-3-tmdb-add.png`
- Screenshot: `workflow/issues/issue-136/demo/scenario-3-after-add.png`

**Pass criteria:**

- TMDB-only primary action is Add; success lands on film detail (or Home if plan documented otherwise — match PLAN: film detail).
- If TMDB API unavailable, document skip and show picker TMDB error state instead (still not a blank dead end); capture `scenario-3-tmdb-error.png`.

### Scenario 4: Empty / no-results / archived excluded

**Goal:** UX states and archived exclusion.

**Steps:**

1. Open picker with empty query → idle/empty guidance (not a spinner forever).
2. Search a nonsense string → no-results message.
3. Spot-check API or UI: archived titles do not appear as local hits for a known archived film (if none archived, call `GET /films?statuses=active,pending_watch_review,watched&search=…` and note archived absence in `demo-notes.md`).

**Capture:**

- Screenshot: `workflow/issues/issue-136/demo/scenario-4-empty-query.png`
- Screenshot: `workflow/issues/issue-136/demo/scenario-4-no-results.png`

**Pass criteria:**

- Empty and no-results states are clear.
- Archived not listed in local picker results (API or UI evidence).

### Scenario 5: Legacy add URL redirects

**Goal:** `/watchlist/add` does not keep a divergent add-only UI.

**Steps:**

1. Open http://localhost:3000/watchlist/add
2. Confirm redirect or equivalent landing on shared picker (`/search?intent=add` or same component).

**Capture:**

- Screenshot: `workflow/issues/issue-136/demo/scenario-5-add-redirect.png`

**Pass criteria:**

- User ends on shared picker, not a separate TMDB-only page that diverges long-term.

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-136/demo/`
- [ ] `workflow/issues/issue-136/demo/demo-notes.md` with date, commit SHA, tier `application`, scenario results, any TMDB skip notes
- [ ] No secrets in images or logs
- [ ] No Scenario 0 / `bug-repro-*` (feature, not bug)
