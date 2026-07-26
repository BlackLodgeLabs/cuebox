# Demo spec — issue #141

Application-tier UI chrome change. Demo agent captures phone-first AppShell (bottom tabs + header) on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Part 2 seeded watchlist present (≥10 ready films) — home shows recommendation entry, not empty-import CTA
- Branch: `cursor/issue-141-mobile-ui-app-shell` (or merged agent side-branch tip)
- Draft PR **#149** linked in `workflow.state.json`

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

2. **Review badge scenarios** need `pending-count.total > 0`. Check:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films/reviews/pending-count" | python3 -m json.tool
   ```

   If `total` is `0`, insert one pending metadata match review against an existing film (compose Postgres on host port **5433**):

   ```bash
   docker compose exec -T postgres psql -U cuebox -d cuebox <<'SQL'
   INSERT INTO metadata_match_reviews (
     film_id, candidate_tmdb_id, confidence_score, candidate_payload, review_status
   )
   SELECT id, 550, 0.4200, '{"title":"Demo Candidate"}'::jsonb, 'pending'
   FROM films
   WHERE NOT EXISTS (
     SELECT 1 FROM metadata_match_reviews WHERE review_status = 'pending'
   )
   LIMIT 1;
   SQL
   ```

   Re-check pending-count until `total >= 1`. Leave the row for badge scenarios; do not accept/reject it during the demo.

3. Use a phone viewport for chrome captures: **390×844** (or Playwright `devices['iPhone 13']` equivalent). One desktop capture at ≥768px width is enough to show the same four-tab IA.

## Scenarios

### Scenario 1: Bottom tabs on Home (phone)

**Goal:** Prove four primary destinations in the thumb zone; History/Settings are not tabs.

**Steps:**

1. Open `http://localhost:3000/` at 390×844.
2. Confirm fixed bottom tab bar labels: **Home**, **Watchlist**, **Recommend**, **More**.
3. Confirm Home tab shows filled/active styling; no fifth tab; no “History” or “Settings” tab labels.
4. Confirm slim header: Cuebox brand, search icon, and Review badge only if pending > 0.

**Capture:**

- Screenshot: `workflow/issues/issue-141/demo/scenario-1-home-bottom-tabs.png`

**Pass criteria:**

- Exactly four bottom tabs with those labels
- Home active; History/Settings absent from the tab bar
- Header search control present (`aria-label` / accessible name “Search films”)

### Scenario 2: Active states + More → Settings

**Goal:** Route-driven tab highlighting and More lands on sync settings.

**Steps:**

1. From Home, tap **Watchlist** → URL under `/watchlist*`; Watchlist tab active.
2. Tap **Recommend** → `/recommend*`; Recommend tab active.
3. Tap **More** → `/settings/sync`; More tab active; sync settings page content visible.
4. Navigate to `/history` (address bar or Home “View history” if present) → **no** bottom tab forced active.

**Capture:**

- Screenshot: `workflow/issues/issue-141/demo/scenario-2-more-settings.png` (on `/settings/sync` with More active)
- Screenshot: `workflow/issues/issue-141/demo/scenario-2-history-no-tab.png` (on `/history`, no tab active)

**Pass criteria:**

- Active tab matches SPEC route table
- More → settings sync; History does not activate a tab

### Scenario 3: Header search (#140) + Review badge

**Goal:** Search and Review stay in the header; no FAB; badge only when pending.

**Steps:**

1. On any primary shell screen, activate header **Search films** → navigates via `/search` to Home with picker focused (`/?focus=search` or focused search field).
2. With pending-count ≥ 1 (seed step 2), confirm Review badge visible with count; tap → `/review`.
3. Confirm no floating action button on Home / Watchlist / Recommend.

**Capture:**

- Screenshot: `workflow/issues/issue-141/demo/scenario-3-search-focused.png`
- Screenshot: `workflow/issues/issue-141/demo/scenario-3-review-badge.png` (badge visible in header)

**Pass criteria:**

- Search reachable from header; lands on Home picker focus behavior from #140
- Review badge visible only with pending > 0; opens `/review`
- No FAB

### Scenario 4: Content clears the tab bar + desktop IA

**Goal:** Safe-area / bottom padding; desktop does not reintroduce peer History/Settings tabs.

**Steps:**

1. On phone viewport, open Watchlist (or Home) and scroll to the bottom of the page — last content remains above the tab bar (not clipped underneath).
2. Resize to desktop width (≥768px) on Home — same four bottom tabs (or compact top bar exposing only the same four destinations + header search/Review). History and Settings must not appear as additional primary peers.

**Capture:**

- Screenshot: `workflow/issues/issue-141/demo/scenario-4-scroll-clearance.png`
- Screenshot: `workflow/issues/issue-141/demo/scenario-4-desktop-ia.png`

**Pass criteria:**

- Content not hidden behind tabs
- Desktop IA still obeys D3 (four primary destinations only)

## Artifacts checklist

- [ ] `scenario-1-home-bottom-tabs.png`
- [ ] `scenario-2-more-settings.png`
- [ ] `scenario-2-history-no-tab.png`
- [ ] `scenario-3-search-focused.png`
- [ ] `scenario-3-review-badge.png`
- [ ] `scenario-4-scroll-clearance.png`
- [ ] `scenario-4-desktop-ia.png`
- [ ] `workflow/issues/issue-141/demo/demo-notes.md` — date, commit SHA, viewport sizes, pending-count value used, gate command + exit line
- [ ] No secrets in images or logs
