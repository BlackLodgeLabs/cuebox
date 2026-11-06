# Implementation plan — Issue #159

**Tier:** application  
**Issue type:** bug (quality gaps in shipped ceremony on `feature/mobile-ui` — sticky Next, short reasons, stage-3 hierarchy, reduced-motion CSS)  
**Integration base:** `feature/mobile-ui` (draft PR **#162** already targets it — do not retarget to `main`)

## Overview

Close the soft gaps found in phone review against product brief success criteria **A** and **D**: make **Next** thumb-reachable on stages 1–2 via sticky chrome above the bottom tab bar; show **upstream** `why_it_matches_short` on 1–2 (full record on 3); make **Done** the sole filled primary on stage 3 with secondaries demoted; give `.ceremony-reduced-motion` real CSS.

Reproduction on 2026-07-29 (390×844, seeded Matrix session) confirmed all four defects — see [Reproduction findings](#reproduction-findings) and `demo/bug-repro-notes.md`.

Preserve mandatory 1→2→3, history→3, replay, cold-load coerce, Neo-Noir, and no FAB. No ceremony gate rule changes unless sticky layout forces a non-behavioral tweak (prefer none).

## Reproduction findings

Evidence under `workflow/issues/issue-159/demo/` (`bug-repro-*`):

| Gap | Observed |
|-----|----------|
| **Next below fold** | Stage 1 Next at `top=1149px` on 844px viewport; parent `position: static`. First viewport shows poster only (`bug-repro-screenshot-2-stage1-below-fold.png`). |
| **Full prose as “short”** | `ShortReasons` renders full `why_it_matches` (191 chars). API has no `why_it_matches_short` (`bug-repro-api-response.json`). |
| **Stage 3 CTA soup** | Peer filled primaries: **Done** and **New recommendation**; plus View answer summary / View history / Replay / Remove (`bug-repro-screenshot-1c-stage3-actions.png`, `bug-repro-metrics.json`). |
| **Reduced-motion no-op** | `.ceremony-reduced-motion` present; **0** CSS rules matching the class (`bug-repro-metrics.json`). |

**Note:** Seeded Matrix session has `runners_up: []`, so stage-2 below-fold was not reproduced live. Sticky chrome still applies to stages 1–2; stage-2 sticky verification uses mocked multi-runner fixture (existing E2E ceremony mocks).

## Root cause

1. **Sticky Next:** `RecommendationCeremony` chrome puts Next in an in-flow flex row after tall stage content — never sticky; main already pads for the fixed tab bar but ceremony does not reuse the questionnaire sticky pattern.
2. **Short reasons:** Ranking prompt/schema/`RankingExplanation`/`Explanation`/`FilmExplanation` only carry `why_it_matches`. `ShortReasons` incorrectly uses the full string.
3. **CTA soup:** Stage-3 actions split across `ceremony-stage-record.tsx` (filled New recommendation + outline history/summary) and chrome (Done + Replay + Remove) with no hierarchy.
4. **Reduced motion:** TSX applies `.ceremony-reduced-motion` and `motion-safe:animate-in`, but `globals.css` only disables scanlines under `prefers-reduced-motion` — no ceremony-specific rules.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/app/prompts/ranking.py` | Add `why_it_matches_short` to JSON schema instructions; bump `PROMPT_VERSION` (e.g. `recommendation-v2`) | Upstream short field contract |
| `api/app/providers/ranking/base.py` | Add optional `why_it_matches_short: str \| None = None` on `RankingExplanation` | Provider dataclass |
| `api/app/providers/ranking/openai.py` | Parse short field; missing/blank → `None` (do not invent truncation) | OpenAI path |
| `api/tests/mock_providers.py` | Include short strings in mock ranking explanations | CI/mocked ranking |
| `api/app/schemas/recommendations.py` | `why_it_matches_short: str \| None = None` on `Explanation` | API contract |
| `api/app/services/recommendation_service.py` | Round-trip short in `_explanation_to_payload` / `_explanation_from_payload` / default synthesizers (brief short, not copy of long) | Persistence + defaults |
| `api/tests/test_integration_recommendation.py` (and/or new unit parse test) | Assert short present on create/detail when mock ranking returns it; missing → null-safe | Regression for API contract |
| `frontend/src/types/api.ts` | Optional `why_it_matches_short?: string \| null` on `FilmExplanation` | FE types |
| `frontend/src/components/ceremony/ceremony-shared.tsx` | `ShortReasons` uses short field + factors; omit full `why_it_matches` on 1–2 per SPEC fallback | Short vs full |
| `frontend/src/components/recommendation-ceremony.tsx` | Sticky chrome row (progress + Next / Done) above tab bar + safe-area; stage padding so content clears sticky; stage-3 Done primacy in chrome | Sticky Next + Done |
| `frontend/src/components/ceremony/ceremony-stage-record.tsx` | Remove peer filled New recommendation / View history cluster; demote answer-summary into secondary disclosure | Stage 3 hierarchy |
| `frontend/src/app/globals.css` (and/or tokens) | Real `.ceremony-reduced-motion` rules; disable fades/transitions / animate-in under reduced motion | D8 / F |
| `frontend/src/components/recommendation-ceremony.test.tsx` | Sticky affordance / Next visibility helpers; short vs full; Done primacy; reduced-motion CSS class behavior | Unit coverage |
| `frontend/src/components/ceremony/*.test.tsx` (new or extend) | ShortReasons fallback (no full why); stage-record secondary demotion | Component tests |
| `frontend/e2e/helpers/ceremony-mocks.ts` | Add `why_it_matches_short` on winner/runners | E2E mocks |
| `frontend/e2e/recommendation-ceremony.spec.ts` | Assert short on 1–2, full on 3; sticky Next in viewport; Done sole primary; reduced-motion CSS effect | E2E |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| Ceremony gate / coerce-to-3 | Out of scope unless sticky forces non-behavioral tweak |
| Questionnaire sticky (#161) | Sibling |
| Shell / surface clarity (#158 / #160) | Siblings |
| Alembic migrations | Prefer JSONB explanation detail only |
| Ranking model selection / non-explanation fields | Out of scope |
| Neo-Noir tokens / FAB | Preserve design constraints |

## Sticky chrome layout (locked choice)

Reuse the questionnaire sticky pattern from `recommend/page.tsx`:

```tsx
className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 …"
```

| Decision | Choice |
|----------|--------|
| Where | Shared sticky footer **inside** `RecommendationCeremony` chrome (stages 1–2: progress + Next; stage 3: Done primary + demoted More) |
| Tab clearance | `4.5rem` + `env(safe-area-inset-bottom)` — matches `AppShell` main padding / questionnaire |
| Hit target | `min-h-11` (≥44px) on Next / Done |
| Progress | Keep `n / 3` (`data-testid="ceremony-progress"`) in the same sticky row (or adjacent sticky strip) |
| Content padding | Add bottom padding on scrollable ceremony content so last lines are not hidden under sticky row |
| Desktop | Keep sticky at all breakpoints (harmless; consistent with questionnaire) |
| FAB | Never |

## Short-reason contract (locked)

```json
{
  "why_it_matches": "Full multi-sentence rationale…",
  "why_it_matches_short": "One or two sentence phone-friendly why.",
  "most_influential_factors": ["…"],
  "why_it_beat_alternatives": "…",
  "caveats": "…"
}
```

| Layer | Behavior |
|-------|----------|
| Prompt | Require short for every explanation; 1–2 sentences; no caveats/beat-alternatives duplication |
| Parse | Blank/missing → `None`; **never** client/server truncate long into short as primary contract |
| Persist | Inside existing JSON (`winner_explanation_detail` / `runner_up_explanations`); `winner_explanation` TEXT stays full why |
| Stages 1–2 | Factors + short when present; if short missing: factors only, **omit** full why |
| Stage 3 | Always full `why_it_matches` (+ beat-alternatives, caveats, providers, answer summary) |
| Defaults / synthesizers | Set a brief short string when synthesizing (not a copy of a long paragraph) |

## Stage 3 action hierarchy (locked)

| Priority | Control | Treatment |
|----------|---------|-----------|
| Primary | **Done** | Sole filled primary; sticky above tab bar |
| Secondary | Replay; Remove (history); New recommendation; View history; View answer summary | Outline/ghost **or** single **More actions** Sheet/disclosure — not a row of peer filled buttons |

Destinations unchanged: fresh Done → `/`; history Done → `/history`; New recommendation → `/recommend`; View history → `/history`; answer summary stays a sheet of `profile_summary`.

Move New recommendation / View history / answer-summary triggers out of the peer CTA cluster in `ceremony-stage-record.tsx` into the demoted set owned by ceremony chrome (or a single More sheet).

## Implementation steps

### Step 1 — Ranking / API short field

1. Bump `PROMPT_VERSION`; update system prompt schema + instructions.
2. Extend `RankingExplanation`, OpenAI parser, mock providers.
3. Extend API `Explanation` + recommendation_service payload helpers / defaults.
4. Add/adjust tests: parse missing→None; mock create/detail includes short; integration assert round-trip.

### Step 2 — Frontend types + ShortReasons

1. Optional `why_it_matches_short` on `FilmExplanation`.
2. Update `ShortReasons` per fallback rules; keep stage-3 `WhyItMatchesSection` on full why.
3. Unit tests for short present / missing / blank.

### Step 3 — Sticky chrome (stages 1–2 + Done)

1. Refactor `RecommendationCeremony` action/progress into sticky footer row.
2. Pad stage content bottom for sticky clearance.
3. Unit/E2E: Next in viewport at scrollY=0 on stage 1 (and stage 2 with multi-runner mock).

### Step 4 — Stage 3 Done primacy

1. Remove filled peer CTAs from `ceremony-stage-record.tsx`.
2. Wire demoted actions under More / outline secondaries beside sticky Done.
3. Unit: only one filled primary (`ceremony-done`); secondaries not `bg-primary`.

### Step 5 — Reduced-motion CSS

1. Add `.ceremony-reduced-motion` rules in `globals.css` (animation/transition none; neutralize animate-in).
2. Keep/extend `prefers-reduced-motion` media query as needed.
3. Unit/E2E: class present + computed style / CSS rule exists (or no animate-in class when reduced).

### Step 6 — Mocks, E2E, docs polish

1. Update `ceremony-mocks.ts` (+ other mocks if they assert explanation shape).
2. Extend `recommendation-ceremony.spec.ts`.
3. Touch DESIGN.md only if ceremony chrome section needs sticky/short/Done notes (minimal).

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| Ranking prompt / parse includes `why_it_matches_short`; blank→None | API unit | Upstream short field |
| Mock ranking + create/detail round-trip short on winner + runners | API integration | Persistence / history replay |
| Default synthesizer sets brief short (not long copy) | API unit | Provider fallbacks |
| `ShortReasons` shows short + factors; omits full why when short missing | FE unit | Short vs full + legacy fallback |
| Stage 3 still shows full `why_it_matches` | FE unit | Full record on 3 |
| Sticky Next present / in first viewport affordance (class or layout test) | FE unit | Sticky Next |
| Stage 3: sole filled primary is Done; New recommendation demoted | FE unit | Done primacy |
| `.ceremony-reduced-motion` CSS rules exist / motion disabled | FE unit | Reduced motion |
| Mocked Playwright: stage 1–2 short text; stage 3 full | E2E mocked | Short vs full |
| Mocked Playwright: Next visible without scroll on stage 1 (and 2) | E2E mocked | Sticky Next |
| Mocked Playwright: Done sole primary on stage 3 | E2E mocked | Done primacy |
| Mocked Playwright: reduced-motion class + no crash | E2E mocked | Reduced motion |
| `npx tsc --noEmit` + `npm run test:unit` + API ranking/integration subset | CI/local | Green |

## Gate script

Application tier (API + frontend). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
# Host pytest against reachable DB (not compose hostname `postgres`):
export DATABASE_URL="$APP_DATABASE_URL_HOST_TEST"
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && ruff check app tests
cd api && pytest tests/test_integration_recommendation.py tests/ -k "ranking or explanation or recommendation" -q
cd frontend && npm run test:unit && npx tsc --noEmit
# Host build gotcha: stop compose frontend + sudo rm -rf frontend/.next before host build
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

Narrower intermediate OK while iterating: Phase 6 + targeted API tests; **final execute handoff** expects `$APP_DEFAULT_GATE` exit 0 (or Phase 6 + documented API ranking/integration green if Phase 8 is blocked by unrelated infra — prefer Phase 8).

Mocked Playwright:

```bash
cd frontend && npx playwright test e2e/recommendation-ceremony.spec.ts
```

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Brief notes: sticky ceremony chrome, short vs full reasons, Done primacy, reduced-motion class (only if current ceremony section is silent) |
| `workflow/issues/issue-159/PLAN.md` / `demo/` | This plan + demo-spec + bug-repro |
| README / OpenAPI narrative | None required beyond schema field (OpenAPI auto from Pydantic) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Live LLM omits short field | Prompt requires it; parser → None; UI fallback omits long why on 1–2 |
| Sticky overlaps tab bar / content | Match questionnaire `4.5rem` + safe-area; pad content bottom; visual QA at 390×844 |
| Stage 3 More sheet hides useful exits | Keep Done always visible; secondaries one tap away |
| History sessions lack short | Fallback rules; new runs populate short |
| Prompt version bump affects traces | Intentional — distinguish generations |
| Phase 8 host `.next` EACCES | Stop frontend container; `sudo rm -rf frontend/.next` before build |
| Empty runners seed for stage-2 sticky demo | Use mocked multi-runner fixture (same as #145) |

**Rollback:** Revert sticky chrome / ShortReasons / stage-3 hierarchy / CSS / ranking short-field commits; JSON payloads with short remain backward-compatible (optional field).

## Definition of done

- [ ] Stages 1–2: sticky Next (+ progress) above tab bar with safe-area; ≥44px; reachable at scrollY=0 with tall poster
- [ ] Stages 1–2: factors + `why_it_matches_short`; never primary-path truncation of full why; missing short → factors only
- [ ] Stage 3: full reasons / beat-alternatives / caveats / where-to-watch / answer summary; Done sole filled primary; secondaries demoted
- [ ] Ranking prompt + parse + API + persistence round-trip short; `PROMPT_VERSION` bumped
- [ ] `.ceremony-reduced-motion` has real CSS; prefers-reduced-motion disables ceremony fades/transitions
- [ ] Gate/coerce/replay/history→3 unchanged in behavior; Neo-Noir; no FAB
- [ ] Tests mapped above green; `$APP_DEFAULT_GATE` (or agreed narrower + API) exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#162** remains based on **`feature/mobile-ui`**
- [ ] `workflow.state.json` → `plan-ready` after this planning run (execute later → `execute-ready`)

## PR seed

**Tier:** application  
**What / why:** Fix ceremony quality gaps — sticky Next on 1–2, upstream short reasons, Done primacy on stage 3, and real reduced-motion CSS — against brief A/D/D5/D8.  
**Key changes:** Ranking/`Explanation` `why_it_matches_short`; `ShortReasons` + sticky ceremony chrome; stage-3 Done hierarchy; `.ceremony-reduced-motion` CSS; unit + mocked Playwright regression.  
**Gate:** `$APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`) + ceremony Playwright mocked suite.  
**How to test:** Replay history → stage 1 Next visible without scroll; short why on 1–2 / full on 3; stage 3 Done only filled primary; emulate reduced-motion.  
**Base branch:** `feature/mobile-ui` (PR #162).
