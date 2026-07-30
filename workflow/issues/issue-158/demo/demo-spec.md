# Demo spec — issue #158

Application-tier shell & wayfinding follow-up. Demo agent verifies the bugs in `bug-repro-notes.md` are fixed on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health (after `source scripts/cursor-workflow-config.sh`):
  - `curl -sf $APP_HEALTH_URL_FRONTEND`
  - `curl -sf $APP_HEALTH_URL_API`
- Branch tip includes execute changes for #158; draft PR **#164** base **`feature/mobile-ui`**
- Phone viewport for primary captures: **390×844**
- Returning-user Home (seeded watchlist) — no live provider keys required for shell chrome

### Seed steps

1. Confirm watchlist present:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 1
   print('films', d['pagination']['total'])
   "
   ```

2. If empty: `python3 scripts/seed-dev-db.py` (or Part 2 bootstrap per AGENTS.md), then re-check.

3. Optional: seed or stub pending reviews if capturing Review with match cards (empty “All caught up” state is acceptable if ← Home chrome is visible).

## Scenarios

### Scenario 0: Bug fix verification (More hub + chrome)

**Goal:** Confirm reproduced defects from `bug-repro-notes.md` are fixed.

**Steps:**

1. Open `/` at 390×844. Confirm four tabs Home · Watchlist · Recommend · More.
2. Tap **More** → lands on `/more` hub (not Sync). Confirm Sync, Import, History destination links in that order.
3. Tap **Sync** → `/settings/sync` with Sync settings heading; CSV / watched / RSS sections still present; More remains `aria-current="page"`.
4. Inspect sticky header classes/style for `safe-area-inset-top` (and viewport-fit if asserted in execute notes).
5. On Home, confirm active tab is visually stronger than inactive (accent and/or indicator — not near-muted pair alone).
6. Open `/history`, `/import`, `/review` — each shows compact **← Home** (or Back to Home) ≥44px linking to `/`.

**Capture:**

- Screenshot: `workflow/issues/issue-158/demo/scenario-0-more-hub.png`
- Screenshot: `workflow/issues/issue-158/demo/scenario-0-sync-from-hub.png`
- Screenshot: `workflow/issues/issue-158/demo/scenario-0-active-tab.png`
- Screenshot: `workflow/issues/issue-158/demo/scenario-0-history-offtab-chrome.png`

**Pass criteria:**

- Contrast `bug-repro-screenshot-2-more-lands-on-sync.png` — More no longer dumps on Sync; hub first
- Contrast `bug-repro-screenshot-6-more-route-missing.png` — `/more` is a real hub page
- Contrast `bug-repro-screenshot-1-home-tabs.png` — active tab clearly stronger
- Contrast `bug-repro-screenshot-3-history-no-offtab-chrome.png` — ← Home present
- Header safe-area class/style present (metrics or DOM assert OK if notch not emulated)

### Scenario 1: More active matrix

**Goal:** More stays active on hub + settings; Import/History stay off-tab.

**Steps:**

1. On `/more` and `/settings/sync`, confirm More has `aria-current="page"` and active visual affordance.
2. On `/import` and `/history`, confirm More is **not** `aria-current`; off-tab chrome is visible instead.

**Capture:**

- Screenshot: `workflow/issues/issue-158/demo/scenario-1-more-active-on-settings.png`
- Screenshot: `workflow/issues/issue-158/demo/scenario-1-import-offtab.png`

**Pass criteria:**

- Active matrix matches SPEC locked `isActive` rules

### Scenario 2: Nested off-tab routes

**Goal:** History detail and Import job status also expose return chrome.

**Steps:**

1. Open an existing history session (`/history/[sessionId]`) — confirm ← Home (outside ceremony stage chrome).
2. Open or stub `/import/[jobId]` — confirm ← Home available (Import-parent affordance optional).

**Capture:**

- Screenshot: `workflow/issues/issue-158/demo/scenario-2-history-detail-chrome.png`
- Screenshot: `workflow/issues/issue-158/demo/scenario-2-import-job-chrome.png` (skip with note in demo-notes if no job id and stubbing is impractical)

**Pass criteria:**

- Home return available; ceremony stage UI not broken; no FAB / extra tabs

### Scenario 3: Design constraints intact

**Goal:** D3 shell invariants hold after the fix.

**Steps:**

1. Confirm exactly four bottom tabs; no History tab; no FAB.
2. With pending reviews (seed/stub), Review remains a header badge (not a tab).
3. Visual: Neo-Noir tokens; no new brand palette.

**Capture:**

- Screenshot: `workflow/issues/issue-158/demo/scenario-3-shell-invariants.png`

**Pass criteria:**

- Tab set + Review badge + Neo-Noir preserved

### Scenario 4 (optional): Safe-area on notched device

**Goal:** Manual or DevTools proof that header content clears the status area.

**Steps:**

1. If available, Chrome device mode with notch / or iOS Safari; confirm Cuebox brand + Search clear the inset.
2. Confirm bottom tab safe-area still applies.

**Capture:**

- Screenshot: `workflow/issues/issue-158/demo/scenario-4-safe-area-notch.png` (optional — document DOM class assert in `demo-notes.md` if notch unavailable)

**Pass criteria:**

- Top inset applied; bottom inset unchanged

## Artifacts checklist

- [ ] All required scenario screenshots saved under `workflow/issues/issue-158/demo/`
- [ ] `workflow/issues/issue-158/demo/demo-notes.md` with short narrative (date, SHA, tier, what passed)
- [ ] No secrets in images or logs
- [ ] Contrast against `bug-repro-*` called out for Scenario 0
