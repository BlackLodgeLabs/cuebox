# Issue #159: Mobile UI follow-up — ceremony quality (sticky Next, short reasons, stage 3 hierarchy)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/159

**Integration base:** `feature/mobile-ui` (not `main`). Draft PR must target `feature/mobile-ui`.

## Summary

Close the soft gaps on the mobile recommendation ceremony against product brief success criteria **A** and **D**: keep **Next** reachable on stages 1–2 without scrolling past the poster, show **upstream short reasons** on 1–2 (full record on 3), make **Done** the clear stage-3 exit, and give `.ceremony-reduced-motion` real CSS. Preserve mandatory 1→2→3, history→3, replay, Neo-Noir, and no FAB.

## Problem

The ceremony structure from #145 is on `feature/mobile-ui`, but phone review ([`documents/ui-mobile-evaluation.md`](../../../documents/ui-mobile-evaluation.md) on the evaluation branch; ceremony findings mirrored in #159) found quality gaps:

| Gap | Evidence |
|-----|----------|
| **Next below the fold** | Stage 1 Continue sits ~1121px down an 844px viewport; stage 2 also requires scroll past poster + reasons |
| **“Short reasons” are full prose** | `ShortReasons` renders full `why_it_matches` ([`ceremony-shared.tsx`](../../../frontend/src/components/ceremony/ceremony-shared.tsx)); brief **D5** wants key factors + short why on 1–2 |
| **Stage 3 CTA soup** | Chrome exposes Done / Replay / Remove; record content also shows New recommendation / View history / View answer summary — no clear durable-record exit |
| **Reduced-motion no-op** | `.ceremony-reduced-motion` is applied in TSX/tests but has **no CSS rules** (brief **D8** / **F**) |

## Acceptance criteria

- [ ] **Sticky Next (stages 1–2):** Continue/Next is always reachable without hunting — sticky footer row above the bottom tab bar with `safe-area-inset-bottom` padding; hit target ≥44px (`min-h-11` / equivalent). Stage progress (`n / 3`) stays visible with that chrome (same sticky row or adjacent sticky strip).
- [ ] **Short vs full reasons:** Stages 1–2 show **short** reasons (key factors + short why). Stage 3 keeps **full** reasons, why-it-beat-alternatives, caveats, where-to-watch, and answer summary.
- [ ] **Upstream short field:** Short reasons come from the **ranking AI response**, not client-only truncation of the long string. Ranking prompt/schema, provider parsing, API `Explanation` / session payload, and frontend types consume a dedicated `why_it_matches_short` field (name may match this exactly).
- [ ] **Legacy fallback:** Sessions / payloads without `why_it_matches_short` still render safely on stages 1–2 per [Fallback](#fallback-missing-short-reasons) — never crash; never treat client truncation of `why_it_matches` as the primary contract.
- [ ] **Stage 3 Done primacy:** Primary exit is **Done** (sole filled primary control). Secondary actions (Replay ceremony, Remove from history, New recommendation, View history, View answer summary) are demoted/collapsed so they do not compete with Done — see [Stage 3 action hierarchy](#stage-3-action-hierarchy).
- [ ] **Reduced motion:** `.ceremony-reduced-motion` has real styles; `prefers-reduced-motion: reduce` disables ceremony fades/transitions (including any motion-safe animate-in used on stage changes).
- [ ] **Ceremony rules preserved:** No Skip between stages; history still lands on stage 3; replay still does 1→2→3; gate / deep-link coerce-to-3 unchanged unless a sticky-chrome layout change requires a non-behavioral tweak.
- [ ] **Design constraints:** Neo-Noir tokens preserved; no FAB; no rebrand.
- [ ] **Tests:** Cover sticky Next presence/layout affordance, short-vs-full reason rendering, stage 3 Done primacy / secondary demotion, reduced-motion class behavior, and ranking/API short-reason contract (prompt schema + parse + API response + persistence round-trip for history replay).

## Scope

### In scope

- Ceremony chrome: sticky Next (+ progress) above bottom tabs with safe-area padding on stages 1–2; stage 3 sticky/footer treatment for Done as needed so the primary exit stays thumb-reachable after scrolling the record.
- Ranking prompt (`api/app/prompts/ranking.py`) + `RankingExplanation` / OpenAI (and mock) parsing + API `Explanation` schema + recommendation persistence/serialization for `why_it_matches_short`.
- Frontend types + `ShortReasons` / stages 1–2 consume short field; stage 3 continues to use full `why_it_matches` (and related full fields).
- Stage 3 action hierarchy with Done primary and secondary actions demoted.
- Ceremony reduced-motion CSS (globals / design tokens as appropriate).
- Unit / component / API tests listed above; extend existing ceremony E2E mocks if needed for short field.

### Out of scope

- Ceremony gate / deep-link coerce-to-3 rule changes (unless strictly required for sticky layout — prefer no behavior change).
- Questionnaire density / sticky-footer chip overlap (#161 thumb ergonomics sibling).
- Home / Watchlist / More shell wayfinding (#158).
- Surface clarity (posters, status labels, Home copy, System status, History filters) (#160).
- Developer Mode redesign / mobile Dev Mode affordance.
- Replacing Neo-Noir tokens or introducing a new visual brand.
- Letterboxd / TMDB sync changes.
- Changing ranking model selection or non-explanation ranking fields.

## User flows / API changes

### Fresh recommendation (armed gate → stage 1)

1. User completes questionnaire; lands on `/recommend/results/{id}?stage=1`.
2. Stage 1: poster-led winner + **short** reasons (factors + `why_it_matches_short`); sticky **Next** visible in thumb zone above tab bar without scrolling past the poster.
3. Stage 2: focused runner-up, same short-reason + sticky Next pattern.
4. Stage 3: full session record (full why, beat-alternatives, caveats, where-to-watch, answer summary); **Done** is the obvious primary exit (default → Home `/`).

### History detail

1. Open `/history/{id}` → stage **3** (unchanged).
2. Full record + Done primary (default → `/history`); secondary actions available but demoted.
3. **Replay ceremony** arms gate and walks 1→2→3 with short reasons on 1–2 when short field is present (or fallback).

### Reduced motion

1. User has `prefers-reduced-motion: reduce` (or equivalent).
2. Root ceremony stage wrapper gets `.ceremony-reduced-motion`.
3. No fade/slide / animate-in ceremony motion; content still switches stages instantly and remains readable.

### API / ranking contract

Add optional string field on explanations:

```json
{
  "why_it_matches": "Full multi-sentence rationale…",
  "why_it_matches_short": "One or two sentence phone-friendly why.",
  "most_influential_factors": ["factor1", "factor2"],
  "why_it_beat_alternatives": "…",
  "caveats": "…"
}
```

| Layer | Change |
|-------|--------|
| Ranking system prompt | Require `why_it_matches_short` alongside existing fields; instruct **1–2 sentences**, phone-readable, no caveats/beat-alternatives duplication |
| `RankingExplanation` + OpenAI/mock parsers | Parse/persist short field; empty/missing → `None` / omit (not invent long truncation) |
| API `Explanation` schema | `why_it_matches_short: str \| None = None` (or equivalent optional) |
| Recommendation create/detail responses | Include short field on winner and runners-up explanations |
| Persistence | Store inside existing JSON explanation payloads (`winner_explanation_detail` / `runner_up_explanations`); keep `winner_explanation` TEXT as the full why (or existing behavior). **No Alembic migration** unless plan proves a typed column is required |
| Frontend `FilmExplanation` | Optional `why_it_matches_short`; stages 1–2 read it via `ShortReasons` |

Bump ranking `PROMPT_VERSION` when the prompt schema changes so traces/observability distinguish generations.

### Fallback (missing short reasons)

For stages **1–2** when `why_it_matches_short` is `null`, missing, or blank after trim:

1. Still show **key factors** (`most_influential_factors`) when present.
2. **Do not** render the full `why_it_matches` paragraph on stages 1–2.
3. **Do not** implement client-side truncation of `why_it_matches` as the intended product path (optional defensive ellipsis only if a future plan explicitly needs a last-resort — default is omit long why).
4. Stage **3** always shows full `why_it_matches` (and other full fields) regardless of short availability.
5. New ranking runs must populate short for winner and each runner-up explanation returned.

### Stage 3 action hierarchy

| Priority | Control | Treatment |
|----------|---------|-----------|
| Primary | **Done** | Sole filled primary button; sticky/footer above tab bar (with safe-area) so it remains reachable after scrolling the record |
| Secondary | Replay ceremony; Remove from history (history mode only); New recommendation; View history; View answer summary | Demoted: outline/ghost or collapsed under a single **More actions** disclosure / sheet — not a row of peer filled buttons competing with Done |

Preserve existing destinations:

- Fresh mode Done → `/`
- History mode Done → `/history`
- New recommendation → `/recommend`
- View history → `/history`
- Answer summary remains a sheet/disclosure of `profile_summary` (not a separate route)

Move New recommendation / View history / answer-summary triggers out of the “peer CTA cluster” pattern so stage 3 reads as a durable record with one clear exit.

### Sticky chrome layout notes

- Sticky row sits **above** the app bottom tab bar (account for tab height + `env(safe-area-inset-bottom)`).
- Ceremony scroll content must pad bottom so the last lines of reasons are not hidden under the sticky row.
- No FAB. Progress remains `n / 3` (existing copy/testid patterns preferred).
- Desktop / wide viewports: sticky behavior may remain (harmless) or apply under the same mobile shell breakpoints already used by the app — plan should pick one consistent with existing mobile shell CSS.

## Data and integration notes

- **DB:** Prefer JSONB explanation detail update only; no new tables. Migration only if execute discovers `winner_explanation` TEXT-only path cannot carry short without breaking history detail — default is extend JSON detail + runner-up JSON.
- **History replay:** Short field must round-trip through create → store → `GET` detail so replay stages 1–2 can show shorts for new sessions.
- **Mocks / seeds / E2E:** Update mock ranking providers and ceremony Playwright mocks to include `why_it_matches_short` so UI tests assert short vs full without live LLM.
- **Providers:** OpenAI ranking path is primary; any fallback explanation builders in `recommendation_service` should set a short string when synthesizing defaults (brief, not a copy of a long paragraph).
- **No** Letterboxd/TMDB/watch-provider sync changes.
- **PR base:** `feature/mobile-ui`. Workflow handoff’s default `--base main` must not be used for this issue’s draft PR; create/retarget to `feature/mobile-ui`.

## Open questions

_(none — product decisions locked above for planning)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/159
- Related follow-ups: #161 (thumb ergonomics), #158 (shell), #160 (surface clarity)
- Product brief: `documents/ui-mobile-product-brief.md` (D5, D8, success A/D/F) on `feature/mobile-ui`
- Evaluation source: `documents/ui-mobile-evaluation.md` (ceremony findings; currently on evaluation branch / cited by issue)
- Prior ceremony work: #145 / mobile UI base `feature/mobile-ui`
