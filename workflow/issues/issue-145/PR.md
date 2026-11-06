## Related Issue

Closes #145

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/145)

## Description

**What does this PR do?**

Replaces the flat recommendation results dump (winner card + runners-up grid + answer sheet + providers on one page) with a **mandatory 1→2→3 ceremony** shared by fresh results and history detail (mobile UI slice e / brief **D5**; success criteria **A** + **D**):

| Stage | Job |
|-------|-----|
| **1 — Winner** | Singular poster-led focus; short reasons only; **Next** |
| **2 — Runners-up** | Horizontal CSS scroll-snap poster row; focused runner + short reasons; **Next** |
| **3 — Session record** | Durable five-film record: full reasons, where-to-watch, questionnaire summary, deep links, exits |

URL `?stage=1|2|3` + mode drive chrome (no parallel stage store). Fresh/replay entry arms a module-scoped SPA gate; cold load / hard refresh / unarmed `stage=1|2` coerce to stage 3. Stage 2→3 uses `replace` so Back from stage 3 leaves the route. History opens at stage 3; **Replay ceremony** plays 1→2→3 once per tap.

**Why is this the best approach?**

Winner focus and swipeable runners-up cannot coexist with a single flat dump. Deriving chrome from the URL keeps Back/refresh/deep-link behavior honest; the module gate (not `sessionStorage`) survives soft SPA navigation while still coercing hard refresh to the durable record. Frontend-only: reuse `GET /recommendations/{sessionId}` and fetch watch providers only on stage 3. Draft PR **#154** stays based on `feature/mobile-ui` (do not retarget to `main`).

## Changes Proposed

* Added `frontend/src/lib/ceremony-gate.ts` — `parseStage` / `buildStageHref` + module-scoped `armCeremonyGate` / `isCeremonyArmed` / `clearCeremonyGate`
* Added `frontend/src/hooks/use-ceremony-navigation.ts` — Next/Back/Replay wiring from URL stage
* Added `frontend/src/components/recommendation-ceremony.tsx` + `ceremony/` stage views (`CeremonyStageWinner`, `CeremonyStageRunnersUp`, `CeremonyStageRecord`, shared short-reason / poster helpers)
* Wired `/recommend/results/[sessionId]` (`mode="fresh"`), `/history/[sessionId]` (land stage 3 + Replay + delete), and questionnaire submit (`armCeremonyGate` then `push(...?stage=1)`)
* Slimmed `results-view.tsx` after ceremony migration; kept `DevModePanel` mountable with `?dev=1`
* Updated `documents/DESIGN.md` results section for the 3-stage ceremony composition
* Tests: `ceremony-gate.test.ts`, `recommendation-ceremony.test.tsx`, mocked Playwright `e2e/recommendation-ceremony.spec.ts` + `e2e/helpers/ceremony-mocks.ts`; watch-providers / first-time-journey soft updates for stage 3
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and seven scenario screenshots under `workflow/issues/issue-145/demo/`

**Explicitly unchanged:** API / Alembic / `config.yaml` / ranking; AppShell (#141), Home (#142), watchlist grid (#143), film detail (#144); questionnaire density (#146); `DevModePanel` visuals.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright iPhone 13 metrics; scenario 7 desktop 1280×800 with `prefers-reduced-motion: reduce`). Stage-2 swipe evidence uses a Playwright route mock (winner + four runners-up) because the live Part 2 Matrix session has 0 runners-up.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Stage 1 — singular winner (phone) | **PASS** | screenshot below |
| 2 | Stage 2 — swipeable runners-up (phone) | **PASS** | screenshot below |
| 3 | Stage 3 — durable session record (phone) | **PASS** | screenshot below |
| 4 | History lands on stage 3 | **PASS** | screenshot below |
| 5 | Replay 1 → 2 → 3 | **PASS** | screenshot below |
| 6 | Cold load / refresh prefers stage 3 | **PASS** | screenshot below |
| 7 | Reduced motion + desktop metaphor | **PASS** | screenshot below |

![Scenario 1 — Stage 1 winner](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-1-stage1-winner.png)

![Scenario 2 — Stage 2 runners-up](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-2-stage2-runners.png)

![Scenario 3 — Stage 3 record](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-3-stage3-record.png)

![Scenario 4 — History → stage 3](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-4-history-stage3.png)

![Scenario 5 — Replay stage 1](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-5-replay-stage1.png)

![Scenario 6 — Cold load → stage 3](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-6-cold-load-stage3.png)

![Scenario 7 — Reduced motion / desktop](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/49cef1299371863076b13fb98092f247c0c70758/workflow/issues/issue-145/demo/scenario-7-reduced-motion-or-desktop.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-145-recommendation-ceremony
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Fresh ceremony: complete questionnaire (or navigate after submit) → `/recommend/results/{sessionId}?stage=1`:
   - Progress **1 / 3**; singular TOP PICK; short **Key factors** + **Why it matches** only
   - No watch-provider icons, no answer-summary sheet, no Skip
   - **Next** ≥44px → stage 2 (swipe runners-up) → **Next** → stage 3 (full record + providers + **View answer summary** when present)
4. History: open `/history/{sessionId}` → lands at stage **3 / 3** (durable record, not stage-1 ritual). Tap **Replay ceremony** → stage 1 → Next → 2 → Next → 3.
5. Cold load: hard-refresh or open unarmed `/recommend/results/{id}?stage=1` → coerces to `?stage=3`.
6. Reduced motion: OS/browser `prefers-reduced-motion: reduce` → ceremony root has `data-reduced-motion="true"`; stages still advance; desktop keeps carousel metaphor (not a flat all-cards dashboard).
7. Unit + mocked E2E (optional local):
   ```bash
   cd frontend && npm run test:unit -- --run src/lib/ceremony-gate.test.ts src/components/recommendation-ceremony.test.tsx
   cd frontend && npx playwright test e2e/recommendation-ceremony.spec.ts
   ```
8. Gate (PLAN / execute):
   ```bash
   bash scripts/verify-phase6-gates.sh
   ```

## Known Issues / Notes for Reviewer

* Live Part 2 Matrix history session has **0** runners-up; demo stage-2 evidence uses a five-film Playwright mock (winner + four runners) per demo-spec.
* Mock posters are intentionally null (**NO POSTER**); layout pass criteria do not require live TMDB art.
* Capture helper was a local Playwright script against Compose (`PLAYWRIGHT_E2E_STACK=1`); not committed.
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute marked Phase 6 + frontend unit/tsc green at execute-ready.
* No migrations or config changes; restart frontend only if the Compose bind mount has not picked up ceremony files.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #154.

## Gate evidence

- [x] Phase 6 gate + frontend unit/tsc green at execute-ready (`1f431f5`) — per execute commit message
- [x] Demo: seven scenarios PASS (phone 390×844 / desktop 1280×800 reduced-motion) — `demo/demo-notes.md`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at `93e4c16` (create-pr-in-progress)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone + desktop ceremony stages verified against demo screenshots
