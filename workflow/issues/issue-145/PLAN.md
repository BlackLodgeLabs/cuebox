# Implementation plan — Issue #145

**Tier:** application  
**Issue type:** feature (mobile recommendation ceremony 1→2→3 + history replay; not a bug)  
**Integration base:** `feature/mobile-ui` (draft PR **#154** currently targets `main` — **retarget to `feature/mobile-ui`** before execute merges meaningfully; do not leave base as `main`)

## Overview

Replace the flat `ResultsView` dump (winner + runners-up grid + answer sheet + providers on one page) with a **mandatory 3-stage ceremony** shared by fresh results and history detail:

| Stage | Job |
|-------|-----|
| **1 — Winner** | Singular poster-led focus; short reasons only; **Next** |
| **2 — Runners-up** | Horizontal swipe/scroll-snap poster row; focused item winner-like + short reasons; **Next** |
| **3 — Session record** | Full five-film record: full reasons, where-to-watch, questionnaire summary, film deep links, exits (**Done** / History / New recommendation / **Replay** / delete on history) |

URL + mode drive chrome (`?stage=1|2|3`); no parallel stage store that can desync. Frontend-only; reuse `GET /recommendations/{sessionId}` (+ existing watch-provider hooks on stage 3 only).

## Reproduction findings

N/A — greenfield UX rewrite (feature). Baseline confirmed by static read + live stack peek:

- `results-view.tsx` — single page: `WinnerResultCard` (poster + ratings + **watch providers** + synopsis + full explanation) + runners-up **grid** + optional answer-summary **Sheet** + actions
- `/recommend/results/[sessionId]` — mounts `ResultsView` under “Your pick”; no stage param
- `/history/[sessionId]` — same `ResultsView` with `showActions` + delete; lands on flat record (not stage-3-first ceremony)
- `recommend/page.tsx` — `router.push(\`/recommend/results/${session_id}\`)` with no `?stage=1`
- `DESIGN.md` still documents the flat two-column winner card + runners-up grid
- Seeded Part 2 DB has ≥1 history session (e.g. Matrix) suitable for demo stage 3 / replay
- No carousel / swipe library in `frontend/package.json` — prefer CSS scroll-snap (no new deps)

## Root cause

N/A (feature). Product constraint: brief **D5** / success criteria **A** + **D** require a ritualized 1→2→3 path; today’s flat results collapse winner focus, skip swipe runners-up, and cannot distinguish ceremony from durable record.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/components/recommendation-ceremony.tsx` | **New** shared ceremony shell | Stages 1–3 + chrome (progress, Next, Replay, Done); `mode="fresh" \| "history"` |
| `frontend/src/components/ceremony/` (or colocated) | **New** stage views | `CeremonyStageWinner`, `CeremonyStageRunnersUp`, `CeremonyStageRecord` (+ small shared short-reason / poster helpers) |
| `frontend/src/lib/ceremony-gate.ts` (or hook) | **New** cold-load guard + stage URL helpers | Module-scoped allow flag + `parseStage` / `stageHref` / push vs replace rules |
| `frontend/src/hooks/use-ceremony-navigation.ts` | **New** (optional) | Read `useSearchParams` stage; Next/Back/Replay wiring |
| `frontend/src/components/results-view.tsx` | **Refactor / slim** | Extract reusable pieces into ceremony stage 3 (or delete after migration); keep exports only if still needed |
| `frontend/src/app/recommend/results/[sessionId]/page.tsx` | Wire ceremony | `mode="fresh"`; cold-load coerce; keep `DevModePanel` |
| `frontend/src/app/history/[sessionId]/page.tsx` | Wire ceremony | Default / land **stage 3**; Replay; preserve delete dialog + history chrome |
| `frontend/src/app/recommend/page.tsx` | Fresh entry | `armCeremonyGate(sessionId)` then `push(...?stage=1)`; update unit test expectation |
| `frontend/src/components/results-view.test.tsx` | Replace / split | Stage-machine + stage-1/2/3 rendering tests (new files OK) |
| `frontend/src/components/recommendation-ceremony.test.tsx` | **New** | Fresh 1→2→3, history→3, replay, cold-load coerce, reduced-motion class/flag |
| `frontend/src/lib/ceremony-gate.test.ts` | **New** | URL parse + cold-load guard unit tests |
| `frontend/e2e/recommendation-ceremony.spec.ts` | **New** (mocked API) | Fresh 1→2→3, history→3, replay 1→2→3, reduced-motion |
| `frontend/e2e/watch-providers.spec.ts` | Update | Providers assert on **stage 3** (not stage-1 winner card) |
| `frontend/e2e/first-time-journey.spec.ts` | Soft update | Expect ceremony entry / stage-3 durable landing as needed |
| `frontend/e2e/all-routes.spec.ts` | Touch if selectors break | Soft route smoke still passes |
| `documents/DESIGN.md` | Update results section | Document 3-stage ceremony composition (replace flat-card guidance) |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| API / Alembic / `config.yaml` / ranking | No engine or schema changes |
| App shell / Home / watchlist / film detail | Slices a–d |
| Questionnaire content density | Slice f / #146 |
| `DevModePanel` visuals | Out of scope; remain mountable with `?dev=1` |

## Cold-load / URL strategy (locked choice)

Use shared `?stage=1|2|3` on both routes. **Stage chrome is derived from URL + mode only.**

| Transition | History API |
|------------|-------------|
| Questionnaire → stage 1 | `push` `...?stage=1` after **arming** ceremony gate |
| 1 → 2 | `push` `...?stage=2` |
| 2 → 3 | **`replace`** `...?stage=3` (collapse stack so Back leaves the route) |
| History cold open / missing param | Treat as **stage 3** |
| Replay from stage 3 | Arm gate + `push` stage 1 → push 2 → **replace** 3; clear replay/gate when landing on 3 |
| Browser Back stage 2 | → stage 1 (natural history) |
| Browser Back stage 3 | → prior app route (not 2) because 2→3 used `replace` |

### Cold-load guard (chosen)

**Module-scoped allow flag** (same JS realm / SPA session), e.g. `armCeremonyGate(sessionId)` / `isCeremonyArmed(sessionId)` / `clearCeremonyGate(sessionId)` in `ceremony-gate.ts`:

1. Questionnaire submit and **Replay** call `armCeremonyGate` **synchronously before** `router.push(...?stage=1)`.
2. On ceremony mount: if URL stage ∈ `{1,2}` and gate is **not** armed for this `sessionId` → `router.replace` to `stage=3` (ignore stale deep links / bookmarks / hard refresh).
3. Hard refresh reloads the bundle → module flag is empty → coerce to stage 3 even if URL still says `stage=1|2`.
4. Soft client navigations keep the armed flag so Back 2→1 and in-progress ceremony still work.
5. Clear the gate when landing on stage 3 after a completed ceremony/replay (optional but preferred to avoid stale arms).

Do **not** rely on `sessionStorage` alone (survives refresh and would violate refresh→stage 3).

Preserve unrelated query params (`?dev=1`) when rewriting `stage`.

## Implementation steps

### Step 1 — Ceremony gate + stage URL helpers

- `parseStage(searchParams) → 1|2|3` (invalid/missing → `3`)
- `buildStageHref(pathname, stage, currentSearchParams)`
- Gate arm/check/clear as above
- Unit-test parse + coerce decisions without rendering

### Step 2 — Shared `RecommendationCeremony`

Props sketch:

```ts
mode: "fresh" | "history";
data: RecommendationDetailResponse;
sessionId: string;
// history-only extras via children or props:
onRequestDelete?: () => void;
```

Chrome:

- Progress cue e.g. “1 / 2 / 3” (not a skip control)
- Primary CTA: stage 1–2 **Next** / **Continue** (`min-h-11`, ≥44×44); stage 3 **Done** (link Home or History as product-appropriate) + **Replay ceremony**
- **No Skip** control anywhere
- Same three-stage flow on `md+` (wider stage-2 carousel OK; not a flat all-cards dashboard)

### Step 3 — Stage 1 (Winner)

- Dominant poster-led composition (singular focus; Neo-Noir tokens)
- Short reasons only: `most_influential_factors` + `why_it_matches`
- Minimal title/year/director line OK; **omit** synopsis, caveats, beat-alternatives, ratings clutter, where-to-watch, questionnaire summary
- Optional light watchlist deep link — do not turn stage 1 into film detail
- Constraint-relaxation: **default stage 3 only** (optional subtle stage-1 cue discouraged unless it stays non-competing)

### Step 4 — Stage 2 (Runners-up)

- Horizontal **CSS scroll-snap** row of posters (no new npm deps)
- Focused runner uses winner-like short layout (poster + short reasons)
- Keyboard/focus: snap focused item; ensure Next remains reachable
- No where-to-watch / full metadata dump

### Step 5 — Stage 3 (Session record)

- Rehome today’s full-record content: winner + all runners-up, full explanation fields, ratings, **where-to-watch** via `useFilmsWatchProviders` **only when stage === 3**
- Questionnaire/answer summary (`profile_summary` narrative + structured) — sheet or inline section; **hide section** if missing (graceful degrade; do not block)
- Deep links to `/watchlist/{filmId}` for each film
- Constraint-relaxation banner here
- Actions: New recommendation, View history, Replay; history mode keeps Remove from history
- **Done** must leave a clear exit (no dead end after Next from stage 2)

### Step 6 — Route wiring

- Results page: render ceremony `mode="fresh"`; apply cold-load coerce on mount
- History page: default stage 3; render ceremony `mode="history"`; keep delete dialog outside or as stage-3 action
- Recommend submit: arm gate + `push(/recommend/results/{id}?stage=1)`
- Prefer `replace` from questionnaire → results stage 1 **or** push — SPEC allows either so Back from stage 1 leaves the flow; pick one and cover with a unit/e2e assertion (recommend: **replace** questionnaire with results stage 1 so Back leaves recommend flow cleanly)

### Step 7 — Motion (D8)

- Intentional enter/advance transitions (e.g. short fade/slide between stages)
- `@media (prefers-reduced-motion: reduce)` → instant or opacity crossfade only; no large travel animations
- Expose a `data-reduced-motion` or class hook for tests / demo
- No essential hover-only controls; no FAB; no new brand tokens (D1)

### Step 8 — Tests + DESIGN.md

- Unit + mocked Playwright per table below
- Update `DESIGN.md` Results section to describe ceremony stages (short vs full reasons; providers on stage 3)
- Update watch-providers E2E to assert icons on stage 3

### Step 9 — PR base

- Ensure draft PR **#154** base is **`feature/mobile-ui`** (retarget if still `main`)

## Tests required

| Test | Type | Acceptance criteria covered |
|------|------|----------------------------|
| Fresh entry arms gate and lands stage 1; Next → 2 (push); Next → 3 (replace) | unit | Mandatory 1→2→3; no skip |
| Stage 1 shows short reasons only; no providers / synopsis / caveats / profile sheet | unit | Stage 1 short reasons; providers stage-3-only |
| Stage 2 swipe/focus renders runner short layout; no providers | unit | Stage 2 swipe focus |
| Stage 3 shows full reasons + providers hook called + profile summary when present | unit | Stage 3 full record |
| History mode default / cold open → stage 3 | unit | History lands stage 3 |
| Replay: 1 → 2 → 3; gate cleared; second replay requires Replay again | unit | Replay path |
| Cold load / unarmed `?stage=1\|2` coerces to stage 3 | unit | Refresh / deep-link rules |
| Primary CTAs have `min-h-11` / ≥44px class tokens | unit | Criterion **C** |
| Reduced-motion path applies fallback class / no long transition | unit | D8 / criterion **F** |
| Mocked Playwright: fresh 1→2→3 | e2e mocked | End-to-end ceremony |
| Mocked Playwright: history→3 | e2e mocked | History land |
| Mocked Playwright: replay 1→2→3 | e2e mocked | Replay |
| Mocked Playwright: reduced-motion | e2e mocked | Motion fallback |
| Watch-providers results test asserts stage 3 | e2e mocked | Providers not on 1–2 |
| `recommend/page.test.tsx` expects `?stage=1` | unit | Fresh entry URL |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + units green |

## Gate script

Frontend presentation change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With stack / mocked Playwright:

```bash
cd frontend && npx playwright test e2e/recommendation-ceremony.spec.ts
# optional stack:
cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/all-routes.spec.ts e2e/watch-providers.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Replace flat results-card guidance with 3-stage ceremony rules |
| `workflow/issues/issue-145/PLAN.md` / `demo/` | This plan + demo-spec |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| PR #154 still based on `main` | Retarget to `feature/mobile-ui` immediately; SPEC requires it |
| Cold-load guard blocks legitimate soft Back 2→1 | Keep module gate armed for the SPA session until stage 3 completes |
| Scroll-snap focus unclear on desktop | Wider carousel + visible focus styles; same metaphor, not flat grid |
| Watch-providers / first-time / all-routes E2E break | Update assertions for stage 3 / ceremony chrome |
| `profile_summary` missing on older sessions | Hide summary section; demo notes it |
| Motion fights reduced-motion users | CSS media query + test coverage |
| DevMode `?dev=1` clashes with `?stage=` | Preserve both params in href builders |
| Replacing `ResultsView` orphans imports | Grep and migrate both route hosts in one commit series |
| Part 2 seed history may have `runners_up: []` | Demo/E2E use mocked five-film fixture for stage 2; live seed OK for history→3 degrade |

**Rollback:** Revert ceremony components + route wiring; restore prior `ResultsView` flat layout.

## Definition of done

- [ ] Fresh results: armed entry at stage 1 → Next → 2 → Next → 3; no skip; Back from 2→1; Back from 3 leaves route
- [ ] Stage 1 singular short-reason winner; stage 2 swipeable runners-up; stage 3 full record with providers + questionnaire summary + deep links
- [ ] History detail lands on stage 3; Replay plays 1→2→3 once per tap
- [ ] Cold load / refresh / unarmed `stage=1|2` coerce to stage 3
- [ ] Motion honors `prefers-reduced-motion`; CTAs ≥44px; Neo-Noir; no FAB
- [ ] Unit + mocked Playwright mapped above green; Phase 6 gate exit 0
- [ ] `DESIGN.md` results section updated
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#154** base is **`feature/mobile-ui`**
- [ ] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)

## PR seed

**Tier:** application  
**What / why:** Replace flat recommendation results with a mandatory 1→2→3 ceremony so the winner gets singular focus, runners-up are swipeable, and stage 3 is the durable session record (mobile UI slice e / D5; criteria A + D).  
**Key changes:** Shared `RecommendationCeremony` + URL `?stage=` strategy with cold-load gate; stage-3-only watch providers / answer summary; history→3 + Replay; unit + mocked Playwright coverage; DESIGN.md results update.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests; optional Phase 8 full regression.  
**How to test:** Finish questionnaire → stage 1 → Next → swipe runners-up → Next → stage 3 providers/summary; open History item → stage 3 → Replay 1→2→3; hard-refresh results URL → stage 3; reduced-motion still advances.  
**Base branch:** `feature/mobile-ui` (PR #154 — retarget if needed).
