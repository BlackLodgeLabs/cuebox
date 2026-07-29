## Related Issue

Closes #159

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/159)

## Description

**What does this PR do?**

Closes ceremony quality gaps on the phone-first recommendation flow (brief **A** / **D** / **D5** / **D8**): sticky **Next** on stages 1–2 above the bottom tab bar; upstream `why_it_matches_short` on 1–2 (full record on 3); **Done** as the sole filled primary on stage 3 with secondaries demoted; and real `.ceremony-reduced-motion` CSS.

| Gap | Fix |
|-----|-----|
| Next below fold after tall poster | Sticky ceremony chrome (`bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`) with progress + Next / Done ≥44px |
| Full prose used as “short” why | Ranking prompt/schema/`Explanation` gain optional `why_it_matches_short`; `ShortReasons` uses short + factors; missing short → factors only (never truncate long into short) |
| Stage 3 CTA soup | **Done** sole filled primary; Replay / Remove / New recommendation / history / answer summary demoted under **More** |
| Reduced-motion no-op | Real `.ceremony-reduced-motion` rules; `prefers-reduced-motion` disables ceremony fades/transitions |

**Why is this the best approach?**

Sticky chrome reuses the questionnaire pattern already proven on `/recommend`, so tab-bar clearance stays consistent. Short reasons are an upstream ranking contract (`PROMPT_VERSION` → `recommendation-v2`) rather than client truncation, so history replay and new runs share one field. Stage-3 destinations are unchanged — only visual hierarchy. Ceremony gate / coerce-to-3 / replay / history→3 / Neo-Noir / no-FAB stay as-is. Draft PR **#162** remains based on **`feature/mobile-ui`** (do not retarget to `main`).

## Changes Proposed

* API: add optional `why_it_matches_short` to ranking prompt (`recommendation-v2`), `RankingExplanation`, OpenAI parse (blank→`None`), `Explanation` schema, and recommendation persistence/synthesizers
* Frontend types: optional `why_it_matches_short` on `FilmExplanation`
* `ShortReasons`: show short + factors on stages 1–2; omit full `why_it_matches` when short is missing
* `RecommendationCeremony`: sticky chrome (progress + Next on 1–2; Done primary + demoted More on 3) with content bottom padding
* `ceremony-stage-record`: remove peer filled New recommendation / history CTA cluster; demote secondaries
* `globals.css`: real `.ceremony-reduced-motion` rules under reduced motion
* Tests: API short-field unit + integration; ceremony unit coverage; mocked Playwright sticky / short / Done / reduced-motion assertions; `DESIGN.md` ceremony notes
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, bug-repro + eight scenario screenshots under `workflow/issues/issue-159/demo/`

**Explicitly unchanged:** Ceremony gate / deep-link coerce-to-3 behavior; questionnaire sticky (#161); AppShell / Home / watchlist / film-detail siblings; Alembic migrations; ranking model selection; Neo-Noir tokens; no FAB.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `devices['iPhone 13']`). Scenario 0 uses live Matrix history Replay; Scenarios 1–5 use ceremony route mocks (including legacy `why_it_matches_short: null` and multi-runner stage 2).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Sticky Next (stage 1 live) + Done sole primary (stage 3) | **PASS** | screenshots below |
| 1 | Short reasons on stages 1–2 (mocked) | **PASS** | screenshots below |
| 2 | Full record on stage 3 | **PASS** | screenshot below |
| 3 | Legacy fallback (missing short) | **PASS** | screenshot below |
| 4 | Reduced motion CSS effect | **PASS** | screenshot below |
| 5 | Sticky Next on stage 2 (mocked multi-runner) | **PASS** | screenshot below |

![Scenario 0 — Stage 1 sticky Next](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-0-stage1-sticky-next.png)

![Scenario 0 — Stage 3 Done primary](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-0-stage3-done-primary.png)

![Scenario 1 — Stage 1 short reasons](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-1-stage1-short-reasons.png)

![Scenario 1 — Stage 2 short reasons](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-1-stage2-short-reasons.png)

![Scenario 2 — Stage 3 full record](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-2-stage3-full-record.png)

![Scenario 3 — Legacy fallback](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-3-legacy-fallback.png)

![Scenario 4 — Reduced motion](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-4-reduced-motion.png)

![Scenario 5 — Stage 2 sticky Next](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/90b9ed111e17c0fd5b1379e28f4acd92fa05c135/workflow/issues/issue-159/demo/scenario-5-stage2-sticky-next.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-159-ceremony-quality-405d
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Sticky Next (phone ~390×844): open History → a recommendation with a tall poster → **Replay ceremony** → stage 1 at `scrollY=0`
   - Sticky **Next** + progress (`n / 3`) visible above the tab bar (≥44px); no need to scroll past the poster to continue
4. Short vs full: with a session that has `why_it_matches_short` (new ranking runs after this PR)
   - Stages 1–2: factors + short why; full multi-sentence `why_it_matches` absent
   - Stage 3: full why, beat-alternatives, caveats, where-to-watch, answer summary
5. Legacy fallback: history detail without `why_it_matches_short` → stages 1–2 show factors only (no full-why dump)
6. Stage 3 hierarchy: **Done** is the only filled primary; **More** / outline secondaries for Replay, Remove (history), New recommendation, View history, answer summary — **New recommendation** not a peer filled button
7. Reduced motion: emulate `prefers-reduced-motion: reduce` → `data-reduced-motion="true"` / `.ceremony-reduced-motion` with real CSS rules (fades/transitions disabled)
8. Unit + mocked ceremony Playwright (optional local):
   ```bash
   cd api && ruff check app tests
   cd api && pytest tests/test_ranking_explanation_short.py tests/test_integration_recommendation.py -q
   cd frontend && npm run test:unit && npx tsc --noEmit
   cd frontend && npx playwright test e2e/recommendation-ceremony.spec.ts
   ```
9. Gate (PLAN / execute):
   ```bash
   # Host pytest: use reachable DB, not compose hostname `postgres`
   export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
   export TEST_DATABASE_URL=$DATABASE_URL
   bash scripts/verify-phase8-gates.sh
   ```
   Host build gotcha: stop Compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Known Issues / Notes for Reviewer

* Capture helper was a local Playwright script against the running Compose frontend; not committed.
* Planning `bug-repro-*` artifacts retained under `demo/` for before/after contrast (Next was `top=1149`; reduced-motion `cssRuleCount` was `0`).
* Demo volume had a Tier-3-like watchlist (2 ready films); Matrix history session sufficed for live Scenario 0; Scenarios 1–5 used route mocks (including multi-runner for stage-2 sticky).
* Seeded Matrix session had `runners_up: []` and no `why_it_matches_short` (legacy shape) — live Scenario 0 still verified sticky Next + Done primacy + legacy-safe omission of full why on stage 1.
* No Alembic migrations; short field lives in existing JSONB explanation detail. Restart API after pull so prompt/`PROMPT_VERSION` changes load.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #162.

## Gate evidence

- [x] Phase 8 gate + ceremony unit/E2E + ranking short-field tests green at execute-ready (`a2ab6f3`) — per execute commit message
- [x] Demo: six scenarios PASS (phone 390×844) — `demo/demo-notes.md` at `e48dd7c` / tip `90b9ed1`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at `d222e95` (create-pr-in-progress)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated for the changes
- [ ] Docs updated if behavior or public API changed
- [ ] No secrets or PII in the diff or PR body
- [ ] Draft PR #162 stays based on `feature/mobile-ui`
