# Demo spec — issue #144

Application-tier film detail poster-led reskin (mobile UI slice d / D6–D7). Demo agent captures phone-first detail hierarchy, status actions, where-to-watch, external links, and back-nav on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Part 2 seeded watchlist present (≥10 ready films) so film detail can load a ready film with poster/metadata
- Branch: `cursor/issue-144-mobile-ui-film-detail` (or merged agent side-branch tip)
- Draft PR **#152** linked in `workflow.state.json` (base **must** be `feature/mobile-ui`)
- #141 shell present: bottom tabs + header search / Review badge
- Watchlist may still be table or poster-grid (#143) — do **not** fail this demo on watchlist metaphor; only use watchlist as an entry point when convenient

### Seed steps

1. Confirm Part 2 data and pick a ready film id:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=5" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 10
   ready = next(f for f in d['data'] if f.get('enrichment_status') == 'ready')
   print(ready['id'])
   print(ready['title'])
   "
   ```

2. Prefer a film with `poster_url` and TMDB id when choosing captures. Resolve full detail if needed:

   ```bash
   FILM_ID=<id from step 1>
   curl -sf "http://localhost:3000/api/v1/films/$FILM_ID" | python3 -m json.tool | head -80
   ```

3. Use a phone viewport for primary captures: **390×844** (or Playwright `devices['iPhone 13']` equivalent). One desktop capture (≥768px) is enough to show the same poster-led metaphor (optional two-column), not a backdrop-overlay card dashboard.

4. **Enrichment-empty / missing-poster** scenarios: prefer a seeded film that is not ready, **or** temporarily open detail with network-mocked film payload (Playwright `page.route`) showing `enrichment_status: "enriching"` / `metadata: null` / `poster_url: null`. Do **not** wipe the compose volume permanently; re-seed with `python3 scripts/seed-dev-db.py` only if a live DB change was required.

5. No API keys required for detail layout capture (watch providers may show empty/error states — that is acceptable if the section chrome remains reachable).

## Scenarios

### Scenario 1: Poster-led first viewport (phone)

**Goal:** Prove poster is the dominant first-viewport visual; title/status/actions sit with the poster — not a small inset on a backdrop banner with a peer-card stack competing in the hero.

**Steps:**

1. Open `http://localhost:3000/watchlist/{FILM_ID}` at 390×844 (or navigate from Watchlist → a film).
2. Confirm first viewport: **large poster plane** (clearly larger than the old ~120×180 inset), title + year, enrichment/status cues, and status / edit actions.
3. Confirm the hero is **not** primarily a full-bleed backdrop with a tiny poster overlay and cramped chrome.
4. Confirm content uses ~16px side margins (shell `px-4`); bottom tabs still clear the content.
5. Scroll slightly — confirm metadata/synopsis begin **below** the poster region as a vertical scan, not a hero card collage.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-1-poster-led-phone.png`

**Pass criteria:**

- Poster dominates the first viewport
- Title/year/status/actions adjacent to or under the poster
- No backdrop-overlay chrome outranking the poster
- Neo-Noir tokens; readable title on phone

### Scenario 2: Status actions + hit targets

**Goal:** Status actions remain available and usable one-handed (criterion **C**); #115 labels preserved.

**Steps:**

1. On an **active** film detail at 390×844, confirm **Mark watched** and **Archive** (or equivalent detail labels) are visible without hover.
2. Confirm primary action controls look thumb-friendly (~≥44px tall) — not tiny `sm` chips only.
3. Tap **Mark watched** only if safe in the demo DB (opens review dialog) — prefer opening then dismissing/canceling without destroying seed usefulness; **or** capture the actions row without completing the transition.
4. Confirm **Edit film match** remains reachable.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-2-status-actions.png`

**Pass criteria:**

- Detail status actions visible for the film’s status
- No essential hover-only actions
- Hit targets appear ≥44px

### Scenario 3: Where-to-watch + external links

**Goal:** Where-to-watch remains reachable; Letterboxd / TMDB / IMDb are clear and tappable when IDs exist.

**Steps:**

1. On a ready film detail, scroll to **Where to Watch** (section may show providers, empty, or match-guidance — all OK if present and usable).
2. Locate **Letterboxd** link (always expected when `letterboxd_uri` exists).
3. Locate **TMDB** / **IMDb** when the film has those IDs — links should not be buried only in an unlabeled late card.
4. Optionally long-press/open-in-new-tab is not required; visibility + `href` presence is enough.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-3-where-to-watch-links.png` (section + links in view)

**Pass criteria:**

- Where-to-watch section reachable without hunting
- External links clearly labeled when present

### Scenario 4: Back navigation to watchlist tab

**Goal:** ← Watchlist returns to the appropriate tab.

**Steps:**

1. Open `http://localhost:3000/watchlist/{FILM_ID}?tab=watched` at 390×844.
2. Confirm back control **← Watchlist** (or equivalent) is present.
3. Tap back → land on `/watchlist?tab=watched` (or watched tab selected).
4. Optional: open an archived film with `?tab=archived` and confirm back returns to archived; active film without `tab` returns to `/watchlist`.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-4-back-nav.png` (detail with `?tab=watched` before tap, **or** watchlist watched tab after tap — note which in `demo-notes.md`)

**Pass criteria:**

- Back honors `?tab=` / `watchlistTab`
- Status fallback behavior unchanged when `tab` omitted (spot-check one status if time)

### Scenario 5: Graceful degrade (enrichment / missing poster)

**Goal:** Enrichment-not-ready / missing poster do not look like broken empty card shells.

**Steps:**

1. Open a detail state with missing poster and/or non-ready enrichment (mocked payload or real non-ready film).
2. Confirm **NO POSTER** (or equivalent) placeholder when poster missing.
3. Confirm enrichment status is visible; missing metadata/semantic blocks are omitted or stubbed without an empty peer-card collage that looks broken.
4. If only ready films exist and mocking is unavailable, document the limitation in `demo-notes.md` and rely on unit tests — do not block the whole demo.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-5-degrade.png` (when achievable)

**Pass criteria:**

- Missing poster placeholder clear
- Enrichment status clear; no broken empty card shell

### Scenario 6: Desktop poster-led metaphor (optional)

**Goal:** `md+` keeps poster-led metaphor (optional two-column) without regressing to backdrop-overlay dashboard.

**Steps:**

1. Open the same ready film detail at ≥768px width.
2. Confirm poster remains the primary visual anchor; metadata scans beside/below — not a dense card dashboard hero.

**Capture:**

- Screenshot: `workflow/issues/issue-144/demo/scenario-6-desktop.png`

**Pass criteria:**

- Same poster-led metaphor at desktop width

## Artifacts checklist

- [ ] `scenario-1-poster-led-phone.png`
- [ ] `scenario-2-status-actions.png`
- [ ] `scenario-3-where-to-watch-links.png`
- [ ] `scenario-4-back-nav.png`
- [ ] `scenario-5-degrade.png` (when achievable)
- [ ] `scenario-6-desktop.png` (optional)
- [ ] `demo-notes.md` with short narrative, date, commit SHA, pass/fail per scenario
- [ ] No secrets in images or logs
