## Related Issue

Closes #160

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/160)

## Description

**What does this PR do?**

Fixes mobile surface-clarity gaps on the shipped `feature/mobile-ui` phone UI (returning-user trust / clarity): shared poster fallback for null **and** load errors, user-facing film-detail lifecycle labels (no enrichment jargon), remove Home **System status**, and move History date/status filters behind a watchlist-like **Filter** sheet so results sit higher in the first viewport.

| Gap | Fix |
|-----|-----|
| Broken poster chrome when URL fails (null already OK) | Harden `FilmPoster` with `onError` → shared Cuebox **NO POSTER**; migrate ceremony winner / runners-up / record winner |
| Film detail shows Ready/Failed + raw `active` | Lifecycle map only (`active`→On watchlist, etc.); hide enrichment badge; soften update toasts |
| Home still exposes System status | Delete `HealthPanel` + health query from empty + returning Home |
| History date/status permanently above results | Compact search + **Filter** button; `HistoryFilterSheet` for dates + watch status |

**Why is this the best approach?**

Poster null and load-error share one component path so ceremony and watchlist cannot diverge again. Detail status is display-only mapping — no API/enrichment pipeline change. Home drops debug chrome entirely (no More relocation). History reuses the watchlist Filter + bottom-sheet progressive-disclosure pattern instead of inventing a second filter system. Frontend-only; Neo-Noir tokens and poster+title watchlist cells preserved. Draft PR **#165** remains based on **`feature/mobile-ui`** (do not retarget to `main`).

## Changes Proposed

* `frontend/src/components/film-poster.tsx` (+ `film-poster.test.tsx`): client `failed` state on `onError`; null **or** failed → shared **NO POSTER** placeholder
* Ceremony stages (`ceremony-stage-winner.tsx`, `ceremony-stage-runners-up.tsx`, `ceremony-stage-record.tsx`): replace raw `next/image` / local placeholders with `FilmPoster`
* `frontend/src/lib/film-status-label.ts` (+ unit): locked lifecycle labels
* `frontend/src/components/film-detail-view.tsx` (+ tests): lifecycle label only; no Ready/Failed enrichment badge; enriching hint + actions unchanged
* `frontend/src/app/watchlist/[filmId]/page.tsx`: toast titles “Film details updated” / “Couldn’t update film details”
* `frontend/src/app/page.tsx` (+ tests): remove Home System status / `HealthPanel` / health query
* `frontend/src/components/history-filter-sheet.tsx` (**new**) + `frontend/src/app/history/page.tsx` (+ tests): Filter disclosure for date_from / date_to / watch_status; search stays visible
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, bug-repro + scenario screenshots under `workflow/issues/issue-160/demo/`

**Explicitly unchanged:** `api/` / DB / sync / enrichment pipeline; watchlist cell metadata / filter dimensions; More hub / shell (#158); ceremony sticky / short reasons (#159); thumb ergonomics (#161) except incidental shared hits; Developer Mode; Neo-Noir tokens / FAB.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `devices['iPhone 13']`, `deviceScaleFactor: 2`). Seed: 2 films (The Matrix `ready`/`active` + Ambiguous Title `failed`/`active` null poster) + 1 history session (Matrix).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification | **PASS** | screenshots below |
| 1 | Shared poster fallback on ceremony | **PASS** | screenshot below |
| 2 | Film detail actions still clear | **PASS** | screenshot below |
| 3 | Empty-watchlist Home no System status | **SKIP** | Unit coverage in `page.test.tsx` (empty path); shared seed DB not emptied |
| 4 | Watchlist cells poster + title | **PASS** | screenshot below |

![Scenario 0 — Home no System status](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-0-home-no-system-status.png)

![Scenario 0 — History filters closed](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-0-history-filters-closed.png)

![Scenario 0 — History Filter sheet](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-0-history-filter-sheet.png)

![Scenario 0 — Watchlist null poster](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-0-watchlist-null-poster.png)

![Scenario 0 — Film detail user status](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-0-film-detail-user-status.png)

![Scenario 1 — Ceremony shared FilmPoster](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-1-ceremony-poster.png)

![Scenario 2 — Film detail actions](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-2-film-detail-actions.png)

![Scenario 4 — Watchlist poster + title only](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b7313728586f8e4e4edce36631a1164022753335/workflow/issues/issue-160/demo/scenario-4-watchlist-poster-title-only.png)

### Scenario 0 — contrasts vs bug-repro

| Gap | Before (bug-repro) | After (demo) |
|-----|--------------------|--------------|
| Home System status | Accordion under History | **Gone** — Create + History only |
| History filters | Permanent date/status stack | Compact search + **Filter**; Matrix card above fold when closed; sheet has From/To/Watch status/Apply/Clear |
| Film detail jargon | **Ready** + **active** / **Failed** + **active** | **On watchlist** only; no Ready/Failed enrichment badge |
| Null poster | Intentional **NO POSTER** (already OK) | Still Cuebox **NO POSTER** on watchlist + Ambiguous detail |

Filter apply: Watched status hid Matrix history card; Filter button used primary active affordance; Clear restored defaults.

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-160-mobile-surface-clarity-ccba
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Phone viewport ~390×844 — posters:
   - Watchlist / film detail with null `poster_url` → Cuebox **NO POSTER** (not browser broken-image chrome)
   - Ceremony winner / runners / record with null poster → same **NO POSTER** via `FilmPoster`
4. Film detail status:
   - Open an `active` film → **On watchlist** only; no Ready/Failed enrichment badge
   - **Mark watched** / **Archive** (and Edit film match) still present and labeled
5. Home:
   - Returning hub: Create + History; **no** System status accordion
   - Empty path (or unit): Import CTA; still no System status
6. History Filter disclosure:
   - Closed: search visible; date/status controls **not** permanent; results higher (card above fold when one session)
   - Open **Filter** → From / To / Watch status + Apply / Clear
   - Apply Watched → sessions update; Clear → defaults; Filter button primary when non-default
7. Watchlist cells stay poster/placeholder + title only (no Ready/Failed/On watchlist on cell face)
8. Unit + types:
   ```bash
   cd frontend && npm run test:unit && npx tsc --noEmit
   ```
9. Gate (PLAN / execute):
   ```bash
   # Host pytest: use reachable DB, not compose hostname `postgres`
   export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
   export TEST_DATABASE_URL=$DATABASE_URL
   # Host build gotcha: stop Compose frontend and sudo rm -rf frontend/.next first (AGENTS.md)
   bash scripts/verify-phase8-gates.sh
   ```

## Known Issues / Notes for Reviewer

* Capture helper was a local Playwright script against Compose frontend; not committed.
* Planning `bug-repro-*` artifacts retained under `demo/` for before/after contrast.
* Scenario 3 (empty-watchlist Home) **skipped** on the shared seeded volume — covered by `frontend/src/app/page.test.tsx` empty-path assertion (no System status + Import CTA).
* Ceremony load-error `onError` path covered by `film-poster` unit tests (not forced in UI demo); null-poster ceremony override used for Scenario 1.
* Enriching hint N/A in demo seed (no `enrichment_status === "enriching"` film).
* No Alembic / API / config changes — frontend-only. Restart frontend after pull if the Compose volume is stale.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #165.
* Demo seed: 2 films (Matrix + Ambiguous Title null poster) + 1 Matrix history session.

## Gate evidence

- [x] Phase 8 gate (`scripts/verify-phase8-gates.sh`) green at execute-ready (`1dc1b74`) — per execute commit message
- [x] Demo: Scenarios 0–2 and 4 **PASS**; Scenario 3 **SKIP** (unit coverage) — phone 390×844; `bash scripts/verify-workflow-paths.sh` exit 0 — `demo/demo-notes.md` (artifact commit `b731372`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated for the changes
- [ ] Docs updated if behavior or public API changed
- [ ] No secrets or PII in the diff or PR body
- [ ] Draft PR #165 stays based on `feature/mobile-ui`
