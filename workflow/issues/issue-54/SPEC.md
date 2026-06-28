# Issue #54: Smarter recommendations based on mood

## Summary

Add **home-page mood presets** that map to existing questionnaire fields and trigger a **short “quick pick” path** (no full wizard). Improve recommendation relevance by scoring **`visual_tonal_vibes`** in Stage 3 against film semantic **`tones`** and **`visual_descriptors`**, and slightly tightening Stage 5 stochastic selection when the user chose a specific mood preset. No new database fields, API endpoints, or LLM calls on the recommendation critical path.

## Problem

Users report recommendations sometimes feel random. Cuebox already collects mood-like inputs in the questionnaire (`emotional_outcomes`, `visual_tonal_vibes`, pacing, thinking effort), but:

1. **UX friction** — the 11-step questionnaire is heavy when the user only knows their current mood.
2. **Scoring gap** — `visual_tonal_vibes` is stored in the structured profile but **not scored** in Stage 3 (`api/app/services/scoring_service.py`); film `tones` and `visual_descriptors` are enriched but unused in structured scoring.
3. **Stage 5 randomness** — candidates within 0.08 of the top score are randomly promoted (`STOCHASTIC_BAND` in `api/app/services/recommendation_service.py`), which can feel arbitrary when mood signals are strong.

The PRD already targets mood-aware picks and a **< 30s** synchronous recommendation (`documents/PRD.md` criterion #17). This feature should improve perceived relevance without breaking that NFR.

## Acceptance criteria

- [ ] Home page (watchlist present) shows a **Mood quick pick** section with **4–6 named presets** styled per the Modern Neo-Noir Cinema design system.
- [ ] Tapping a preset submits a recommendation **without** the `/recommend` wizard; unspecified fields use **`DEFAULT_QUESTIONNAIRE`** defaults from `frontend/src/lib/questionnaire-vocabulary.ts`.
- [ ] Each preset maps only to **existing** questionnaire vocabulary values (genres, `emotional_outcomes`, `visual_tonal_vibes`, pacing, `thinking_effort`, etc.) — no new mood taxonomy or DB columns.
- [ ] **Full questionnaire** remains available via the existing **Start questionnaire** card (`/recommend`).
- [ ] Stage 3 adds a **`visual_tonal_fit`** signal: overlap between profile `visual_tonal_vibes` and film `tones` + `visual_descriptors` (case-insensitive string match / normalized overlap, same pattern as `emotional_fit`).
- [ ] Scoring weights remain normalized to **1.0**; `visual_tonal_fit` weight is added via `config.example.yaml` / `ScoringConfig` (rebalance from lower-priority signals — see Data notes).
- [ ] Quick-pick sessions use a **tighter stochastic band** (0.04 vs default 0.08) so similarly scored films are less randomly shuffled when mood inputs are specific.
- [ ] Recommendations still complete in **< 30 seconds** with **no additional LLM calls** beyond the existing profile-embedding (cache miss) + Stage 6 ranking calls.
- [ ] Quick picks are identifiable in history (preset label in auto-generated `notes` and/or narrative profile text).
- [ ] Unit tests cover preset → questionnaire mapping, `visual_tonal_fit` scoring, and stochastic band behavior; existing Phase 5/8 gate scripts pass.

## Scope

### In scope

**Frontend**

- New `frontend/src/lib/mood-presets.ts` — preset definitions (`id`, display label, short description, icon token, partial `Questionnaire` merge over `DEFAULT_QUESTIONNAIRE`).
- Home page (`frontend/src/app/page.tsx`) — mood preset grid/chips between the header and the New recommendation / History cards.
- Quick-pick flow — on preset click: merge preset + defaults, validate API shape, call existing `POST /api/v1/recommendations`, show loading UI (reuse copy: “up to 30 seconds…”), redirect to `/recommend/results/{session_id}`.
- Optional link on home: **Customize instead** → `/recommend` (does not block quick pick; full wizard unchanged).

**Backend / engine**

- `visual_tonal_fit` in `score_candidates()` / `_compute_breakdown()` using profile `visual_tonal_vibes` vs film semantic `tones` + `visual_descriptors`.
- Extend `ScoringConfig` + `config.example.yaml` with `visual_tonal_fit` weight.
- Pass a **recommendation mode** or **stochastic band override** from API to Stage 5 for quick-pick requests (see API notes) — default band unchanged for full-questionnaire submissions.
- Auto-append quick-pick context to `notes` (e.g. `Quick pick: Cozy night in`) before profile canonicalization.

**Tests & gates**

- `api/tests/test_scoring_service.py` — `visual_tonal_fit` cases.
- Frontend unit test for preset merge / validation.
- Phase 5 + Phase 8 regression (NFR timing test with mocked providers).

### Out of scope

- New mood vocabulary, free-text mood interpretation, or separate mood DB field.
- New LLM / embedding calls (including mood-interpretation or enriching Stage 6 ranking payload).
- Replacing or removing the full questionnaire.
- Re-enrichment of existing films (uses data already on `film_semantic_profiles`).
- Home-page presets when watchlist is empty (import CTA unchanged).
- Developer Mode UI changes (trace may show new breakdown key automatically).

## User flows / API changes

### Flow A — Mood quick pick (new)

1. User opens home (`/`) with a populated watchlist.
2. User sees **Mood quick pick** presets (e.g. chips or compact cards).
3. User taps one preset (e.g. **Cozy night in**).
4. Frontend builds a complete `Questionnaire` + `notes`, POSTs to existing endpoint, shows loading state.
5. User lands on results page with a film pick; history shows the session with quick-pick note.

### Flow B — Full questionnaire (unchanged)

1. User taps **Start questionnaire** → `/recommend` → 11 steps → submit → results.

### Proposed mood presets (v1)

All values must exist in `questionnaire-vocabulary.ts`. Adjust copy in implementation; mappings are normative for the spec.

| Preset | Genres | Emotional outcomes | Visual / tonal vibes | Pacing | Thinking effort | Other defaults |
|--------|--------|-------------------|----------------------|--------|-----------------|----------------|
| **Cozy night in** | Drama | Comforted | Cozy, Muted | slow_burn | brain_off | `DEFAULT_QUESTIONNAIRE` for runtime, era, etc. |
| **Adrenaline rush** | Action, Thriller | Energized | Gritty, Neon | fast_paced | brain_off | — |
| **Deep & arty** | Drama | Reflective, Mind-blown | Arty, Atmospheric | slow_burn | complex_puzzle | — |
| **Scare me** | Horror | Terrified | Atmospheric, Gritty | balanced | decent_plot | — |
| **Feel-good escape** | Comedy | Amused, Hopeful | Bright, Sun-drenched | balanced | brain_off | — |
| **Dark & unsettling** | Thriller | Disturbed, Unsettled | Noir, Muted | slow_burn | decent_plot | — |

### API changes (minimal)

**Preferred:** extend `CreateRecommendationRequest` with an optional field:

```json
{
  "questionnaire": { "...": "..." },
  "notes": "optional user notes",
  "quick_pick_preset_id": "cozy_night_in"
}
```

- When `quick_pick_preset_id` is set, backend uses **`stochastic_band = 0.04`** in Stage 5 and appends `Quick pick: {label}` to notes (if not already present).
- When absent, behavior is unchanged (`stochastic_band = 0.08`).

**Alternative (if avoiding schema change):** frontend sends only questionnaire + notes with embedded preset label; backend detects quick pick via notes prefix. Prefer explicit `quick_pick_preset_id` for clearer tests and Developer Mode traces.

No new routes; `POST /api/v1/recommendations` remains the only create endpoint.

### Engine recommendation (question 4 — agent proposal)

| Change | Rationale | Priority |
|--------|-----------|----------|
| Add **`visual_tonal_fit`** Stage 3 signal | Directly fixes the largest mood scoring gap; uses enriched film data already in DB | **Must have** |
| Rebalance weights (add `visual_tonal_fit`, trim `era_fit` / `obscurity_fit` slightly) | Keeps total weight 1.0; mood signals matter more for this issue | **Must have** |
| Tighter stochastic band for quick picks only | Preserves PRD “trusted friend” variability for full questionnaire while reducing “random” swaps when mood is explicit | **Should have** |
| Use film **`energy`** in scoring | Overlaps with pacing; lower ROI for v1 | **Out of scope** |
| Enrich Stage 6 LLM payload with tones/visuals | Same call count but prompt change; defer | **Out of scope** |

**Suggested initial weights** (sum = 1.0):

| Signal | Current | Proposed |
|--------|---------|----------|
| theme_fit | 0.25 | 0.22 |
| emotional_fit | 0.20 | 0.20 |
| **visual_tonal_fit** | — | **0.13** |
| pacing_fit | 0.15 | 0.15 |
| complexity_fit | 0.10 | 0.10 |
| era_fit | 0.10 | 0.07 |
| obscurity_fit | 0.05 | 0.03 |
| viewing_context_fit | 0.05 | 0.05 |
| diversity_adjustment | 0.10 | 0.05 |

Exact numbers may be tuned in planning/execute; tests should lock behavior not exact decimals.

## Data and integration notes

- **No migrations** — uses existing `recommendation_profiles.structured_profile`, `film_semantic_profiles.tones`, `visual_descriptors`.
- **Profile cache** — quick picks with the same preset + defaults hash to the same profile; repeat picks skip embedding regeneration.
- **Performance** — new scoring is in-process O(n) over retrieval candidates (≤100); no new network I/O. NFR validated by existing `test_end_to_end_recommendation` and Phase 8 gates.
- **Sync / enrichment** — unchanged; films must remain `enrichment_status: ready`.
- **Design** — preset section uses existing `Card`, `Button`, chip patterns, and design tokens from `documents/DESIGN.md` (surface-container, primary accent, hover-glow on interactive cards).

## Open questions (must be empty before plan-ready)

_None — resolved via issue comments (2026-06-28):_

- **Capture location:** (1a) Home page quick-start presets  
- **Mood definition:** (2a) Presets → existing questionnaire fields  
- **Questionnaire:** (3b) Short mood-only path with defaults  
- **Engine scope:** (4d) Agent recommends visual_tonal_fit + quick-pick stochastic tuning (above)  
- **Performance:** No new LLM calls on critical path  

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/54
- PRD mood language: `documents/PRD.md` §1, §4
- Scoring today: `api/app/services/scoring_service.py`, `documents/how-cuebox-works.md`
- Questionnaire vocabulary: `frontend/src/lib/questionnaire-vocabulary.ts`
