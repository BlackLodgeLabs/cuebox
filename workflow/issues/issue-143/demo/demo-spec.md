# Demo spec — issue #143

Application-tier watchlist poster grid + filter sheet (mobile UI slice c / criterion B). Demo agent captures phone-first grid metaphor, ⋯ actions, and filter sheet on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Part 2 seeded watchlist present (≥10 ready films) so `/watchlist` is non-empty
- Branch: `cursor/issue-143-watchlist-poster-grid` (or merged agent side-branch tip)
- Draft PR **#151** linked in `workflow.state.json` (base **must** be `feature/mobile-ui`)
- #141 shell present: bottom tabs + header search / Review badge
- Home hub (#142) may be present — do **not** use Home scenarios for this demo beyond navigating via the Watchlist tab

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

2. Use a phone viewport for primary captures: **390×844** (or Playwright `devices['iPhone 13']` equivalent). One desktop capture (≥1024px) is enough to show a denser grid that is still poster+title (not a metadata table).

3. Prefer films with posters when available; if a cell shows **NO POSTER**, that is acceptable for one cell in Scenario 1.

4. No DB wipe required. Filter no-match scenario uses a nonsense search string via the sheet (no seed change).

## Scenarios

### Scenario 1: Poster-first grid (phone)

**Goal:** Prove criterion B / D6 — posters + titles only; no cell metadata; table metaphor gone.

**Steps:**

1. Open `http://localhost:3000/watchlist` at 390×844 (or tap bottom-tab **Watchlist** from Home).
2. Confirm status tabs **Watchlist / Watched / Archived** remain.
3. Confirm a **grid** of posters with **titles below**; scan cells for absence of year, enrichment badges, RT, or date columns.
4. Confirm a **Filter** control is present in page chrome (not a fifth bottom tab; not the shell header search).
5. Confirm **Add film** still reachable (header/link to `/search`).
6. Confirm bottom tabs still Home · Watchlist · Recommend · More; Watchlist tab active.

**Capture:**

- Screenshot: `workflow/issues/issue-143/demo/scenario-1-poster-grid.png`

**Pass criteria:**

- Grid of posters + titles visible
- No table headers / enrichment badges / year columns in cells
- Filter control visible; shell search icon still in header (separate)
- Content clears the bottom tab bar

### Scenario 2: ⋯ status actions

**Goal:** Overflow menu hosts status actions; poster/title still navigate to detail.

**Steps:**

1. On Watchlist (active) tab at 390×844, tap **⋯** on one film (do not tap the poster body).
2. Confirm menu lists applicable actions (e.g. **Mark watched**, **Archive** for active films).
3. Dismiss the menu without confirming archive.
4. Tap the film’s **title** (or poster) → land on `/watchlist/{id}` (detail); `?tab=` may be present for back navigation.
5. Navigate back to `/watchlist`.

**Capture:**

- Screenshot: `workflow/issues/issue-143/demo/scenario-2-overflow-menu.png` (menu open)
- Screenshot: `workflow/issues/issue-143/demo/scenario-2-film-detail.png` (after title/poster tap)

**Pass criteria:**

- ⋯ opens actions without navigating away
- Detail navigation works from poster or title
- Hit target for ⋯ feels tappable (~≥44px)

### Scenario 3: Filter / sort sheet Apply + Clear

**Goal:** Filters live in a sheet; Apply updates the grid; Clear restores defaults; metaphor unbroken.

**Steps:**

1. From `/watchlist`, tap **Filter**.
2. Confirm sheet opens with search, enrichment, year, sort, sort direction (date-added range optional).
3. Set search to a title substring known to match at least one seeded film (or a distinctive word from a visible title); tap **Apply**.
4. Confirm sheet closes and grid narrows (fewer cards or matching titles).
5. Re-open Filter → **Clear** → confirm defaults restored and grid returns to the broader list.
6. Optional: open Filter, change a field, dismiss without Apply → confirm URL/grid unchanged.

**Capture:**

- Screenshot: `workflow/issues/issue-143/demo/scenario-3-filter-sheet.png` (sheet open)
- Screenshot: `workflow/issues/issue-143/demo/scenario-3-filter-applied.png` (grid after Apply)

**Pass criteria:**

- Filters are not an always-visible inline form over the grid
- Apply updates results; Clear restores defaults
- Grid metaphor remains (still posters + titles)

### Scenario 4: Status tabs (same metaphor)

**Goal:** Watched / Archived use the same poster grid, different dataset.

**Steps:**

1. Tap **Watched** tab — grid metaphor remains (or clear empty copy if none watched).
2. Tap **Archived** — same.
3. Return to **Watchlist** tab.

**Capture:**

- Screenshot: `workflow/issues/issue-143/demo/scenario-4-watched-tab.png`
- Screenshot: `workflow/issues/issue-143/demo/scenario-4-archived-tab.png` (empty state OK if no archived films)

**Pass criteria:**

- URL reflects `tab=watched` / `tab=archived` when those tabs are selected
- No return to metadata table on any tab
- Empty copy remains clear when a tab has zero films

### Scenario 5: Desktop denser grid (same metaphor)

**Goal:** Desktop may show more columns but must not regress to a table.

**Steps:**

1. Open `/watchlist` at ≥1024px width.
2. Confirm denser poster grid (more columns) with titles only — no table layout.

**Capture:**

- Screenshot: `workflow/issues/issue-143/demo/scenario-5-desktop-grid.png`

**Pass criteria:**

- Poster + title grid at desktop width
- No sortable metadata table as the default watchlist UX

## Artifacts checklist

- [ ] `scenario-1-poster-grid.png`
- [ ] `scenario-2-overflow-menu.png`
- [ ] `scenario-2-film-detail.png`
- [ ] `scenario-3-filter-sheet.png`
- [ ] `scenario-3-filter-applied.png`
- [ ] `scenario-4-watched-tab.png`
- [ ] `scenario-4-archived-tab.png`
- [ ] `scenario-5-desktop-grid.png`
- [ ] `demo-notes.md` with short narrative (date, SHA, tier, gate line if run)
- [ ] No secrets in images or logs
