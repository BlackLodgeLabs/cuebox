# Demo spec — issue #160

Application-tier surface clarity follow-up. Demo agent verifies the bugs in `bug-repro-notes.md` are fixed on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health (after `source scripts/cursor-workflow-config.sh`):
  - `curl -sf $APP_HEALTH_URL_FRONTEND`
  - `curl -sf $APP_HEALTH_URL_API`
- Branch tip includes execute changes for #160; draft PR **#165** base **`feature/mobile-ui`**
- Phone viewport for primary captures: **390×844**
- Returning-user Home (watchlist present); at least one film with null `poster_url`; at least one history row if available

### Seed steps

1. Confirm watchlist + optional history:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=20" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 1
   nulls = [f for f in d['data'] if not f.get('poster_url')]
   print('films', d['pagination']['total'], 'null_posters', len(nulls))
   "
   curl -sf "http://localhost:3000/api/v1/recommendations?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   print('history_total', d.get('pagination', {}).get('total', len(d.get('data') or [])))
   "
   ```

2. If empty: `python3 scripts/seed-dev-db.py` (or Part 2 / Tier 3 bootstrap per AGENTS.md), then re-check. Prefer at least one null-poster film for Scenario 0/1.

3. Ceremony scenarios may use existing mocked Playwright routes / in-app recommend flow if live ranking keys are unavailable — prefer opening a results/ceremony surface that shows winner + runners-up posters.

## Scenarios

### Scenario 0: Bug fix verification (repro contrast)

**Goal:** Confirm reproduced defects from `bug-repro-notes.md` are fixed.

**Steps:**

1. Open `/` at 390×844. Confirm **no** “System status” control on returning Home. Confirm one supporting sentence under H1 + picker helper; Create + History CTAs present.
2. Open `/history`. Confirm first viewport shows header + compact search + **Filter** (not a permanent date/status stack). Result cards (or empty state) appear above the fold when filters closed.
3. Tap **Filter** → sheet/panel with date from, date to, watch status. Apply a status filter; confirm list updates and Filter shows active affordance. Clear → defaults.
4. Open `/watchlist`. Confirm null-poster film shows Cuebox **NO POSTER** placeholder (not empty/broken).
5. Open a ready film detail (e.g. Matrix). Confirm lifecycle label is user-facing (e.g. **On watchlist**), **no** enrichment **Ready**/**Failed** badge, actions still available.
6. Open null-poster film detail. Confirm placeholder + user lifecycle label; no enrichment badge.

**Capture:**

- Screenshot: `workflow/issues/issue-160/demo/scenario-0-home-no-system-status.png`
- Screenshot: `workflow/issues/issue-160/demo/scenario-0-history-filters-closed.png`
- Screenshot: `workflow/issues/issue-160/demo/scenario-0-history-filter-sheet.png`
- Screenshot: `workflow/issues/issue-160/demo/scenario-0-watchlist-null-poster.png`
- Screenshot: `workflow/issues/issue-160/demo/scenario-0-film-detail-user-status.png`

**Pass criteria:**

- Contrast `bug-repro-home-system-status.png` — System status gone
- Contrast `bug-repro-history-filters.png` — date/status behind Filter; results higher when closed
- Contrast `bug-repro-film-detail-jargon.png` / `bug-repro-film-detail-null-poster.png` — no Ready/Failed/active raw jargon; mapped labels
- Null poster still intentional Cuebox placeholder (not broken-image chrome)

### Scenario 1: Shared poster fallback on ceremony

**Goal:** Ceremony winner / runners-up / record use shared `FilmPoster` fallback (null path at minimum).

**Steps:**

1. Reach ceremony stages (live recommend if keys available, else mocked E2E / stubbed results UI already in app).
2. If a stage film has null poster, confirm Cuebox placeholder (not raw broken `<img>`).
3. Optionally force a bad URL only if safe in demo tooling; otherwise rely on unit coverage for `onError` and document “error path covered by unit tests”.

**Capture:**

- Screenshot: `workflow/issues/issue-160/demo/scenario-1-ceremony-poster.png` (winner or runners-up; note null vs present)

**Pass criteria:**

- Ceremony posters go through shared component treatment; null → same placeholder language as watchlist

### Scenario 2: Film detail actions still clear

**Goal:** Lifecycle actions remain labeled and usable after badge changes.

**Steps:**

1. On an active film detail, confirm Mark watched / Archive (or peers) still present with clear labels.
2. Confirm enriching hint only appears when `enrichment_status === "enriching"` (skip if no enriching film — note N/A).

**Capture:**

- Screenshot: `workflow/issues/issue-160/demo/scenario-2-film-detail-actions.png`

**Pass criteria:**

- Actions unchanged in capability; no enrichment enum badge on normal detail

### Scenario 3: Empty-watchlist Home has no System status

**Goal:** Empty Home also loses health accordion (if seed allows emptying without destroying demo DB permanently).

**Steps:**

1. Prefer a temporary empty state only if reversible (e.g. separate volume / mock). If not safe on shared seed DB, **skip** and rely on unit test for empty path — note skip in `demo-notes.md`.
2. When shown: empty welcome + Import CTA, **no** System status.

**Capture:**

- Screenshot (if run): `workflow/issues/issue-160/demo/scenario-3-empty-home-no-system-status.png`

**Pass criteria:**

- No System status on empty Home, or documented unit-only coverage with skip reason

### Scenario 4: Watchlist cells stay poster + title

**Goal:** Shared poster hardening did not add metadata onto grid cells.

**Steps:**

1. Open `/watchlist` at 390×844.
2. Confirm cells show poster (or placeholder) + title only — no enrichment/lifecycle badges on the cell face.

**Capture:**

- Screenshot: `workflow/issues/issue-160/demo/scenario-4-watchlist-poster-title-only.png`

**Pass criteria:**

- Poster + title only; Neo-Noir intact; Filter control still present (unchanged dimensions)

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-160/demo/` (Scenario 3 optional)
- [ ] `workflow/issues/issue-160/demo/demo-notes.md` with short narrative, date, SHA, tier, gate line, any skips
- [ ] No secrets in images or logs
- [ ] Contrast callouts vs `bug-repro-*` where applicable
