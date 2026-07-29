# Bug reproduction notes — Issue #159

**Date:** 2026-07-29  
**Commit SHA (planning start):** `365769e` (agent side-branch; base `feature/mobile-ui` / issue branch `cursor/issue-159-ceremony-quality-405d`)  
**Environment:** Docker Compose stack Up (`postgres`, `api`, `frontend`, `backup`); health `status=ok` / `database=ok` on both `$APP_HEALTH_URL_API` and `$APP_HEALTH_URL_FRONTEND`  
**Session:** `c618464a-c80a-4bbf-8dee-db0ed68f3abb` (seeded Matrix history detail)  
**Viewport:** 390×844 (phone)

## Steps taken

1. Confirmed stack health via compose + health URLs.
2. Opened `/history/{session}` → stage **3** (history land).
3. Captured stage-3 full page + viewport + scrolled action cluster.
4. Tapped **Replay ceremony** → stage **1**; measured Next button geometry at `scrollY=0`.
5. Advanced to stage **2** (this session has **zero runners-up** — stage 2 is short; sticky still required for sessions with runners + short reasons).
6. Emulated `prefers-reduced-motion: reduce`, replayed to stage 1, scanned stylesheets for `.ceremony-reduced-motion` rules.
7. Saved `GET /api/v1/recommendations/{session}` payload.

## Expected vs actual

| Gap | Expected | Actual (observed) |
|-----|----------|-------------------|
| Sticky Next (stages 1–2) | Continue/Next reachable without scrolling past poster; sticky above tab bar + safe-area; progress visible with chrome | Stage 1 **Next** at `top=1149px` on 844px viewport (`belowFold: true`); parent `position: static`. Viewport screenshot shows poster + TOP PICK only — **Next not in first screen**. Doc height 1265px. |
| Short reasons | Stages 1–2 show key factors + upstream `why_it_matches_short` | `ShortReasons` renders full `why_it_matches` (191 chars). API explanation keys: `why_it_matches`, `most_influential_factors`, `why_it_beat_alternatives`, `caveats` — **no** `why_it_matches_short`. |
| Stage 3 Done primacy | Sole filled primary = Done; secondaries demoted/collapsed | Peer filled primaries: **Done** *and* **New recommendation** (`bg-primary`). Also outline peers: View answer summary, View history, Replay ceremony, Remove from history — CTA soup. |
| Reduced motion | `.ceremony-reduced-motion` has real CSS; fades/transitions disabled | Class applied (`classPresent: true`, `data-reduced-motion=true`) but **cssRuleCount=0** — no stylesheet rules for the class. |

## Artifacts

| File | Purpose |
|------|---------|
| `bug-repro-api-response.json` | Live session payload proving missing short field |
| `bug-repro-metrics.json` | Geometry + button inventory + reduced-motion stylesheet scan |
| `bug-repro-screenshot-1-stage3-cta-soup.png` | Full stage-3 page with competing CTAs |
| `bug-repro-screenshot-1b-stage3-viewport.png` | Stage-3 first viewport |
| `bug-repro-screenshot-1c-stage3-actions.png` | Stage-3 action cluster scrolled into view |
| `bug-repro-screenshot-2-stage1-below-fold.png` | Stage-1 first viewport — Next absent |
| `bug-repro-screenshot-2b-stage1-full.png` | Stage-1 full page including below-fold Next + full why prose |
| `bug-repro-screenshot-2c-stage1-next-scrolled.png` | After scroll — Next finally visible |
| `bug-repro-screenshot-3-stage2-below-fold.png` | Stage 2 (empty runners for this seed) |
| `bug-repro-screenshot-4-reduced-motion.png` | Reduced-motion path still renders; class present, CSS absent |

## Code confirmation (static)

- `frontend/src/components/ceremony/ceremony-shared.tsx` — `ShortReasons` → `WhyItMatchesSection(why_it_matches)` (full string).
- `frontend/src/components/recommendation-ceremony.tsx` — Next/Done/Replay row is in-flow flex, not sticky; applies `ceremony-reduced-motion` class with no CSS definition in `globals.css` / `tokens.css`.
- `api/app/prompts/ranking.py` — schema omits short field; `PROMPT_VERSION = "recommendation-v1"`.
- `api/app/providers/ranking/base.py` + OpenAI parser — `RankingExplanation` has no short field.
- `api/app/schemas/recommendations.py` — `Explanation` has no `why_it_matches_short`.

## Notes for plan / execute

- Prefer sticky chrome pattern already used on questionnaire: `sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]` above the fixed tab bar (`app-shell.tsx` main already pads `pb-[calc(4.5rem+env(...))]`).
- Stage-2 below-fold was **not** reproduced on this seed (0 runners). Demo/execute must use mocked multi-runner session (E2E `ceremony-mocks`) for stage-2 sticky assertion.
- No Alembic migration expected — extend JSON explanation payloads only.
