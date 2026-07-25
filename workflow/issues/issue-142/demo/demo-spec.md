# Demo spec — issue #142

Application-tier Home hub recomposition. Demo agent captures phone-first returning-user hub + empty Import path on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Part 2 seeded watchlist present (≥10 ready films) — Home shows hub, not empty-import CTA
- Branch: `cursor/issue-142-home-hub-composition` (or merged agent side-branch tip)
- Draft PR **#150** linked in `workflow.state.json` (base `feature/mobile-ui`)
- #141 shell present: bottom tabs + header search / Review badge

### Seed steps

1. Confirm Part 2 data:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 10
   print('PASS: ready films present')
   "
   ```

2. Use a phone viewport for hub captures: **390×844** (or Playwright `devices['iPhone 13']` equivalent). One desktop capture (≥768px) is enough to show the same hub stack (not a card dashboard).

3. **Empty-state scenario** needs a temporary empty watchlist view. Prefer **mocked API** in Playwright, or a disposable DB reset only if necessary — do **not** wipe the seeded compose volume permanently. Recommended: use `page.route` stubs in a short Playwright snippet / computer-use with network mock equivalent, **or** open a second browser context that stubs `films?limit=1` to `total: 0` if the demo tooling supports it. If a live empty DB is used, re-seed afterward with `python3 scripts/seed-dev-db.py`.

4. Optional Review-badge confirmation (prove Home has no Review card while badge remains): if `pending-count.total == 0`, insert one pending metadata review (compose Postgres host port **5433**) using the same SQL pattern as issue #141 demo-spec Scenario 3 seed.

## Scenarios

### Scenario 1: Returning-user hub (phone)

**Goal:** Prove single hub composition — picker near top, primary Create CTA, History quick link; no peer card dashboard.

**Steps:**

1. Open `http://localhost:3000/` at 390×844 with seeded watchlist.
2. Confirm first viewport reads as one hub: short headline/support, inline picker (`data-testid="library-search-input"`), primary **Create a recommendation**, secondary **History**.
3. Confirm **no** peer cards/links for **View watchlist**, **Start questionnaire**, **New recommendation** (as Home card title), or **Review now**.
4. Confirm bottom tabs still Home · Watchlist · Recommend · More (#141); History is **not** a tab.
5. Confirm System status (if present) is collapsed and does not dominate the first viewport.

**Capture:**

- Screenshot: `workflow/issues/issue-142/demo/scenario-1-home-hub.png`

**Pass criteria:**

- Picker visible near top of content
- Primary CTA label **Create a recommendation**
- History quick link present with secondary visual weight (not a twin primary card)
- No Watchlist/Review peer cards on Home
- 16px-class mobile margins via shell (content not flush to screen edge)

### Scenario 2: ≤ 2 taps to recommend + History navigation

**Goal:** Success criterion A — enter recommend flow in ≤ 2 taps from Home; History quick link works.

**Steps:**

1. From Home hub, tap **Create a recommendation**.
2. Confirm navigation to `/recommend` (questionnaire entry) — 1 tap to enter the flow.
3. Navigate back to Home (Home tab or browser back).
4. Tap **History** → `/history`.

**Capture:**

- Screenshot: `workflow/issues/issue-142/demo/scenario-2-recommend.png` (on `/recommend` after CTA)
- Screenshot: `workflow/issues/issue-142/demo/scenario-2-history.png` (on `/history`)

**Pass criteria:**

- Home → Recommend in one tap via the primary CTA
- History link lands on `/history`
- Recommend tab may become active on `/recommend` (shell behavior); History still not a tab

### Scenario 3: Picker library-or-add tone + #140 focus regression

**Goal:** Picker copy and header-search focus still work; no dual intent CTAs.

**Steps:**

1. On Home, confirm picker placeholder/helper reads as find-in-library-or-add (not open-ended discovery).
2. Confirm no **Add a film** / **Mark watched** separate intent links on Home.
3. Tap header search icon (`aria-label` / name **Search films**) → lands on Home with picker focused (`/search` → `/?focus=search` behavior).
4. Optional: type a short query and confirm status-aware result actions still appear (behavior unchanged).

**Capture:**

- Screenshot: `workflow/issues/issue-142/demo/scenario-3-picker-focus.png` (focused picker after header search)

**Pass criteria:**

- Library-or-add tone on placeholder/helper
- `data-testid="library-search-input"` focused after header search
- No dual intent CTAs reintroduced

### Scenario 4: Empty watchlist Import path

**Goal:** Empty first-run path remains obvious (no regression).

**Steps:**

1. With empty watchlist (mocked `films?limit=1` total 0, or temporary empty DB), open `/`.
2. Confirm **Welcome to Cuebox** (or equivalent) and primary **Import watchlist** → `/import`.
3. Confirm returning-user hub stack / picker are absent.
4. Restore seeded data if the live DB was emptied.

**Capture:**

- Screenshot: `workflow/issues/issue-142/demo/scenario-4-empty-import.png`

**Pass criteria:**

- Import is the obvious primary action
- Picker not shown on empty Home

### Scenario 5: Review via shell badge only (optional if pending > 0)

**Goal:** Review remains reachable via header badge; Home does not compete with a Review card.

**Steps:**

1. Ensure `pending-count.total >= 1` (seed step 4 if needed).
2. Open Home — confirm no **Review now** / **Films need review** card in the hub stack.
3. Confirm header Review badge visible; tap → `/review`.

**Capture:**

- Screenshot: `workflow/issues/issue-142/demo/scenario-5-review-badge.png` (Home with badge, no Review card)

**Pass criteria:**

- Badge present when pending > 0; Home has no Review peer card

## Artifacts checklist

- [ ] `scenario-1-home-hub.png`
- [ ] `scenario-2-recommend.png`
- [ ] `scenario-2-history.png`
- [ ] `scenario-3-picker-focus.png`
- [ ] `scenario-4-empty-import.png`
- [ ] `scenario-5-review-badge.png` (if pending reviews available)
- [ ] `demo-notes.md` with short narrative, date, commit SHA, pass/fail per scenario
- [ ] No secrets in images or logs
