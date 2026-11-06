# Demo spec — issue #161

Application-tier thumb ergonomics & sticky chrome follow-up. Demo agent verifies the bugs in `bug-repro-notes.md` are fixed on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health (after `source scripts/cursor-workflow-config.sh`):
  - `curl -sf $APP_HEALTH_URL_FRONTEND`
  - `curl -sf $APP_HEALTH_URL_API`
- Branch tip includes execute changes for #161; draft PR **#163** base **`feature/mobile-ui`**
- Phone viewport for primary captures: **390×844**
- Returning-user Home (watchlist present) and at least one history row for remove control

### Seed steps

1. Confirm watchlist + history:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 1
   print('films', d['pagination']['total'])
   "
   curl -sf "http://localhost:3000/api/v1/recommendations?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   print('history_total', d.get('pagination', {}).get('total', len(d.get('data') or [])))
   "
   ```

2. If empty: `python3 scripts/seed-dev-db.py` (or Part 2 bootstrap per AGENTS.md), then re-check.

3. Optional mocked Playwright routes for picker TMDB hits if live TMDB is unavailable — library hits alone are enough for View / Mark watched.

## Scenarios

### Scenario 0: Bug fix verification (targets + inset)

**Goal:** Confirm reproduced defects from `bug-repro-notes.md` are fixed.

**Steps:**

1. Open `/` at 390×844. Measure **History** control height ≥44px; confirm it is outline/ghost/secondary (not peer filled primary to **Create a recommendation**).
2. Type in library search until a library hit appears. Measure **View** and **Mark watched** (or status peer) ≥44px tall.
3. Open `/history`. Measure remove (✕) hit box ≥44×44.
4. Open `/recommend` Genres. Scroll mid-list and to end. Confirm chips are not permanently trapped under sticky Back/Next; at max scroll last chip clears sticky top; sticky remains above tab bar.

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-0-home-history-44.png`
- Screenshot: `workflow/issues/issue-161/demo/scenario-0-picker-actions-44.png`
- Screenshot: `workflow/issues/issue-161/demo/scenario-0-history-remove-44.png`
- Screenshot: `workflow/issues/issue-161/demo/scenario-0-questionnaire-clearance.png`

**Pass criteria:**

- Contrast `bug-repro-screenshot-1-home-history.png` (24px → ≥44px)
- Contrast `bug-repro-screenshot-2-picker-actions.png` (32px → ≥44px)
- Contrast `bug-repro-screenshot-3-history-remove.png` (40×40 → ≥44×44)
- Contrast `bug-repro-screenshot-4c-mid-scroll-sticky.png` — no permanent trap; adequate content bottom padding (ceremony-class clearance)

### Scenario 1: Questionnaire sticky chrome still usable

**Goal:** Sticky Back/Next remain ≥44px and above the tab bar after inset fix.

**Steps:**

1. On `/recommend` Genres at 390×844, confirm sticky Next visible above bottom tabs.
2. Select a late-list chip (e.g. Urban Fantasy), tap **Next** without hunting under chrome.

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-1-sticky-next-usable.png`

**Pass criteria:**

- Next/Back ≥44px; sticky above tab bar; late chip tappable then Next reachable

### Scenario 2: Home History secondary weight

**Goal:** History is easy to tap but Create remains the sole filled primary.

**Steps:**

1. On returning-user Home, confirm Create is filled primary; History is outline/ghost/secondary full-width ≥44px.
2. Tap History → lands on `/history`.

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-2-home-cta-hierarchy.png`

**Pass criteria:**

- Visual hierarchy preserved; History navigates correctly

### Scenario 3: Focus scroll — Home search (automatable)

**Goal:** Focusing library search scrolls the field into view.

**Steps:**

1. On Home, scroll so search is near/below fold if possible (or open with content above).
2. Focus `data-testid="library-search-input"` (tap).
3. Confirm input is centered/visible in the viewport (not permanently under sticky chrome).

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-3-search-focus-scroll.png`

**Pass criteria:**

- Focused search field visible in viewport after focus

### Scenario 4: Focus scroll — questionnaire notes (automatable)

**Goal:** Focusing notes textarea keeps field + Get recommendation reachable in layout (no focus dead-end).

**Steps:**

1. Advance `/recommend` to Notes step.
2. Focus the textarea.
3. Confirm textarea and sticky **Get recommendation** are not permanently unreachable (both in or scrollable into viewport).

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-4-notes-focus-scroll.png`

**Pass criteria:**

- Notes field and primary forward action reachable after focus

### Scenario 5: Manual keyboard audit (iPhone-class Chrome)

**Goal:** Real on-screen keyboard does not leave search/notes or essential actions unreachable.

**Steps:**

1. On a phone or Chrome device-emulation with virtual keyboard if available, focus Home search and type.
2. On Notes step, focus textarea and type; confirm sticky **Get recommendation** remains reachable (scroll or layout).
3. If only headless VM: document keyboard as **manual / blocked in VM** in `demo-notes.md` and rely on Scenarios 3–4 + code hooks; still capture focus-scroll screenshots.

**Capture:**

- Screenshot or short recording if keyboard available: `workflow/issues/issue-161/demo/scenario-5-keyboard-search.png` (and/or `.mp4`)
- Screenshot: `workflow/issues/issue-161/demo/scenario-5-keyboard-notes.png`
- If skipped: note in `demo-notes.md` with reason

**Pass criteria:**

- No permanent dead-end with keyboard open; or explicit VM limitation noted with Scenarios 3–4 green

### Scenario 6: Design constraints smoke

**Goal:** No FAB; Neo-Noir look preserved; questionnaire still Genres → … → Notes with same copy.

**Steps:**

1. Spot-check Home, Recommend Genres, History — dark Neo-Noir, no floating action button.
2. Confirm step 1 title still “Genres” / notes still optional free-text (no question rewrite).

**Capture:**

- Screenshot: `workflow/issues/issue-161/demo/scenario-6-no-fab-noir.png`

**Pass criteria:**

- Constraints held

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-161/demo/`
- [ ] `workflow/issues/issue-161/demo/demo-notes.md` with short narrative, date, SHA, viewport, seed notes
- [ ] No secrets in images or logs
- [ ] Scenario 0 contrasts against `bug-repro-*` baselines
