# Implementation plan — Issue #54: Smarter recommendations based on mood

## Overview

Ship a **Mood quick pick** section on the home page (watchlist present) with six named presets that merge over `DEFAULT_QUESTIONNAIRE` and POST to the existing recommendation endpoint—no new routes or DB columns. On the engine side, add **`visual_tonal_fit`** to Stage 3 structured scoring (profile `visual_tonal_vibes` vs film `tones` + `visual_descriptors`), rebalance weights to sum to 1.0, and use a **tighter stochastic band (0.04)** for quick-pick requests via an optional `quick_pick_preset_id` on `CreateRecommendationRequest`. Backend appends `Quick pick: {label}` to notes before profile canonicalization so history and narrative profiles reflect the preset.

Approach: backend-first (scoring + API contract), then frontend presets/UI, then docs and regression gates. No new LLM calls; all new work is in-process string overlap and a request flag.

---

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/app/services/scoring_service.py` | Modify | Add `visual_tonal_fit` breakdown signal and include in weighted raw score |
| `api/app/core/config.py` | Modify | Add `visual_tonal_fit` to `ScoringConfig` validator sum |
| `config.example.yaml` | Modify | Rebalance weights per spec (sum = 1.0) |
| `api/app/schemas/recommendations.py` | Modify | Optional `quick_pick_preset_id` on `CreateRecommendationRequest` |
| `api/app/services/quick_pick_presets.py` | **New** | Canonical preset id → label map for notes + validation |
| `api/app/services/recommendation_service.py` | Modify | Notes merge, stochastic band override, pass band to Stage 5 |
| `api/tests/test_scoring_service.py` | Modify | `visual_tonal_fit` overlap / no-overlap / missing semantic cases |
| `api/tests/test_recommendation_service.py` | **New** | Stochastic band 0.04 vs 0.08; notes append for quick pick |
| `api/tests/test_diversity_service.py` | Modify | Update `_weights()` helper with `visual_tonal_fit` |
| `api/tests/test_semantic_provider.py` | Modify | Update `ScoringConfig` fixture |
| `api/tests/test_embedding_provider.py` | Modify | Update `ScoringConfig` fixture |
| `api/tests/conftest.py` | Modify | Test config YAML scoring weights |
| `api/tests/test_health.py` | Modify | Test config YAML if scoring block duplicated |
| `frontend/src/lib/mood-presets.ts` | **New** | Six preset definitions + `buildQuestionnaireFromPreset()` |
| `frontend/src/lib/mood-presets.test.ts` | **New** | Preset merge, vocabulary validity, API shape completeness |
| `frontend/src/types/api.ts` | Modify | Add optional `quick_pick_preset_id` to request type |
| `frontend/src/app/page.tsx` | Modify | Mood quick pick section, loading state, submit flow |
| `frontend/src/components/recommendation-loading.tsx` | **New** (optional) | Extract shared “Finding your film…” UI from recommend page |
| `frontend/src/app/recommend/page.tsx` | Modify (optional) | Use shared loading component if extracted |
| `documents/api-contracts.md` | Modify | Document `quick_pick_preset_id`; update scoring weight appendix |
| `documents/how-cuebox-works.md` | Modify | Stage 3 signal list includes `visual_tonal_fit` |
| `documents/Architecture.md` | Modify | Scoring weights table |
| `config.yaml` (local only) | Modify | Copy new weights from `config.example.yaml` when testing locally |

---

## Implementation steps

### Step 1 — Stage 3 `visual_tonal_fit` (backend)

1. In `_compute_breakdown()`, read `profile.get("visual_tonal_vibes", [])` via `_normalize_list()`.
2. Build film label list from `semantic.tones` + `semantic.visual_descriptors` (same normalization as `emotional_fit`).
3. Compute `visual_tonal_fit = _overlap_score(vibes_pref, film_labels)`.
4. Add key to returned breakdown dict.
5. In `score_candidates()`, add `breakdown["visual_tonal_fit"] * weights.visual_tonal_fit` to raw score.

**Commit:** `feat(api): score visual_tonal_fit in Stage 3 structured scoring`

### Step 2 — Scoring config rebalance

1. Add `visual_tonal_fit: float` to `ScoringConfig` in `api/app/core/config.py`; include in `@model_validator` sum.
2. Update `config.example.yaml`:

   | Signal | Weight |
   |--------|--------|
   | theme_fit | 0.22 |
   | emotional_fit | 0.20 |
   | visual_tonal_fit | 0.13 |
   | pacing_fit | 0.15 |
   | complexity_fit | 0.10 |
   | era_fit | 0.07 |
   | obscurity_fit | 0.03 |
   | viewing_context_fit | 0.05 |
   | diversity_adjustment | 0.05 |

3. Update all test fixtures/helpers that construct `ScoringConfig` or embed scoring YAML (`conftest.py`, `test_health.py`, `test_scoring_service.py`, `test_diversity_service.py`, provider tests).

**Commit:** `feat(api): add visual_tonal_fit weight and rebalance scoring config`

### Step 3 — Quick pick API contract and Stage 5 band

1. Create `api/app/services/quick_pick_presets.py`:

   ```python
   QUICK_PICK_PRESETS: dict[str, str] = {
       "cozy_night_in": "Cozy night in",
       "adrenaline_rush": "Adrenaline rush",
       "deep_and_arty": "Deep & arty",
       "scare_me": "Scare me",
       "feel_good_escape": "Feel-good escape",
       "dark_and_unsettling": "Dark & unsettling",
   }
   ```

2. Extend `CreateRecommendationRequest` with `quick_pick_preset_id: str | None = None`. Validate: if set, must be a key in `QUICK_PICK_PRESETS` (400 with clear message if unknown).

3. In `RecommendationService.create_recommendation()`:
   - Resolve `stochastic_band = 0.04 if request.quick_pick_preset_id else 0.08`.
   - Build `notes`: if quick pick, prepend/append `Quick pick: {label}` when not already in user notes (case-insensitive check).
   - Pass `notes` (merged) to `_profile_service.resolve_profile()`.
   - Pass `stochastic_band` into `_stage5_stochastic(diversified, band=stochastic_band)`.

4. Replace module-level `STOCHASTIC_BAND` usage with parameter default `0.08` to preserve full-questionnaire behavior.

**Commit:** `feat(api): quick_pick_preset_id with tighter stochastic band and notes`

### Step 4 — Backend tests

1. `test_scoring_service.py`:
   - Film with matching tones/visual_descriptors → high `visual_tonal_fit`.
   - No overlap → low score (0.25 per `_overlap_score`).
   - Empty vibes / `"No Preference"` → neutral 0.75.
   - Missing semantic profile → degraded but non-crashing score.

2. `test_recommendation_service.py` (new, unit-level with mocks where needed):
   - `_stage5_stochastic` with band 0.04 promotes fewer candidates than 0.08 (construct diversified list with scores 0.80, 0.76, 0.72; 0.76 should be excluded at 0.04 when top is 0.80).
   - Notes merge: quick pick id produces `Quick pick: Cozy night in` in profile resolve input.

3. Optional integration assertion in existing recommendation test: POST with `quick_pick_preset_id` returns 200 and session stores profile narrative containing quick-pick note (if session detail exposes notes via narrative).

**Commit:** `test(api): visual_tonal_fit and quick-pick stochastic band`

### Step 5 — Frontend preset module

1. Create `frontend/src/lib/mood-presets.ts`:
   - Export `MoodPreset` type: `id`, `label`, `description`, `icon` (Material Symbol name), `overrides: Partial<Questionnaire>`.
   - Export `MOOD_PRESETS` array (six entries) using **exact vocabulary strings** from `questionnaire-vocabulary.ts` per SPEC table:

     | id | Key overrides |
     |----|---------------|
     | `cozy_night_in` | Drama; Comforted; Cozy, Muted; slow_burn; brain_off |
     | `adrenaline_rush` | Action, Thriller; Energized; Gritty, Neon; fast_paced; brain_off |
     | `deep_and_arty` | Drama; Reflective, Mind-blown; Arty, Atmospheric; slow_burn; complex_puzzle |
     | `scare_me` | Horror; Terrified; Atmospheric, Gritty; balanced; decent_plot |
     | `feel_good_escape` | Comedy; Amused, Hopeful; Bright, Sun-drenched; balanced; brain_off |
     | `dark_and_unsettling` | Thriller; Disturbed, Unsettled; Noir, Muted; slow_burn; decent_plot |

   - `buildQuestionnaireFromPreset(id: string): Questionnaire` — spread `DEFAULT_QUESTIONNAIRE`, apply overrides, assert `genres`, `emotional_outcomes`, `visual_tonal_vibes` each have ≥1 item.

2. `mood-presets.test.ts`: each preset produces valid questionnaire; ids match backend map; no `No Preference` conflicts.

**Commit:** `feat(frontend): mood preset definitions and questionnaire builder`

### Step 6 — Home page quick pick UX

1. Update `CreateRecommendationRequest` in `frontend/src/types/api.ts` with optional `quick_pick_preset_id?: string`.

2. In `frontend/src/app/page.tsx` (watchlist-present branch only):
   - Insert **Mood quick pick** section between page header and the New recommendation / History grid.
   - Render presets in a responsive grid (`sm:grid-cols-2` or chip row) using `Card` + `hover-glow`, `Icon`, preset label/description.
   - Track `activePresetId` + use `useCreateRecommendation()`.
   - On preset click: build questionnaire, POST `{ questionnaire, quick_pick_preset_id: preset.id }`, show loading UI (same copy as `/recommend`: “Finding your film…”, “up to 30 seconds…”).
   - On success: `router.push(/recommend/results/${session_id})`.
   - On error: inline error on section; allow retry.
   - Add text link **Customize instead** → `/recommend` below preset grid.
   - Disable preset buttons while `create.isPending`.

3. Optionally extract `RecommendationLoading` component shared with `recommend/page.tsx` to avoid duplicated JSX (small, single-purpose component).

**Commit:** `feat(frontend): home page mood quick pick flow`

### Step 7 — Documentation

1. `documents/api-contracts.md`: optional `quick_pick_preset_id` on POST body; allowed values; behavior (stochastic band, notes).
2. `documents/how-cuebox-works.md`: Stage 3 bullet for `visual_tonal_fit`.
3. `documents/Architecture.md`: updated weight table.

**Commit:** `docs: mood quick pick API and visual_tonal_fit scoring`

### Step 8 — Regression gates (execute, pre-push)

Run in order:

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && ruff check app tests
cd api && pytest tests/test_scoring_service.py tests/test_recommendation_service.py tests/test_questionnaire_validation.py -v
bash scripts/verify-phase5-gates.sh
bash scripts/verify-phase8-gates.sh
cd frontend && npx tsc --noEmit && npm run test:unit
```

If host build needed for Phase 8: stop frontend container and clear `.next` per AGENTS.md.

---

## Tests required

| Acceptance criterion | Test type | Test location |
|------------------------|-----------|---------------|
| Home shows Mood quick pick (4–6 presets) | Demo scenario 1 + manual | `demo/home-mood-presets.png` |
| Preset submits without wizard | Frontend unit + demo | `mood-presets.test.ts`, demo scenario 2 |
| Presets use existing vocabulary only | Frontend unit | `mood-presets.test.ts` validates labels ∈ vocabulary exports |
| Full questionnaire unchanged | Demo scenario 3 | Navigate `/recommend`, confirm 11 steps |
| `visual_tonal_fit` in Stage 3 | API unit | `test_scoring_service.py` |
| Weights sum to 1.0 | Config validator + fixtures | `ScoringConfig` model + gate scripts |
| Quick pick stochastic band 0.04 | API unit | `test_recommendation_service.py` |
| Recommendations < 30s, no extra LLM | Integration (existing) | `test_integration_recommendation.py` via Phase 8 |
| Quick picks identifiable in history | API unit / integration | Notes in narrative profile; demo scenario 2 checks history |
| Phase 5/8 gates pass | Gate scripts | `verify-phase5-gates.sh`, `verify-phase8-gates.sh` |

---

## Gate script

Primary: **`bash scripts/verify-phase5-gates.sh`** (recommendation pipeline regression).

Pre-merge: **`bash scripts/verify-phase8-gates.sh`** (integration + NFR timing + Phase 7 regression).

Also run frontend `tsc --noEmit` and `npm run test:unit` (Phase 6 gate subset).

---

## Documentation updates

- `documents/api-contracts.md` — request field + scoring weights appendix
- `documents/how-cuebox-works.md` — Stage 3 signals
- `documents/Architecture.md` — weight table
- No README change required unless execute adds user-facing setup steps (none expected)

---

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Weight rebalance shifts existing recommendation behavior | Expected; lock relative behavior in unit tests (overlap math), not absolute winner films. Phase 5/8 regression catches breakage. |
| `config.yaml` on dev machines missing new weight | Document in commit message; `config.example.yaml` is source of truth; config load fails loudly if sum ≠ 1.0 |
| Duplicate preset id maps (frontend/backend drift) | Same six ids in both; frontend test asserts ids; backend validates unknown ids with 400 |
| Home page clutter on small screens | Responsive 2-column grid; compact card copy |
| Quick pick feels “same as wizard” for power users | “Customize instead” link; full wizard untouched |

**Rollback:** Revert commits; restore prior `config.example.yaml` weights; remove home section. No migrations to undo.

---

## Definition of done

- [ ] `visual_tonal_fit` computed and weighted in Stage 3; appears in score breakdown (Developer Mode trace)
- [ ] `ScoringConfig` includes `visual_tonal_fit`; all weights sum to 1.0
- [ ] `POST /api/v1/recommendations` accepts optional `quick_pick_preset_id`; unknown id → 400
- [ ] Quick pick uses stochastic band 0.04; full questionnaire unchanged at 0.08
- [ ] Notes include `Quick pick: {label}` for quick-pick sessions
- [ ] Home page shows six mood presets when watchlist present; empty watchlist unchanged
- [ ] Preset click → loading → results redirect without visiting `/recommend`
- [ ] `frontend/src/lib/mood-presets.ts` + unit tests committed
- [ ] API unit tests for scoring and stochastic band committed
- [ ] Docs updated (`api-contracts`, `how-cuebox-works`, `Architecture`)
- [ ] Phase 5 and Phase 8 gate scripts pass
- [ ] `workflow.state.json` stage set to `execute-ready` by execute agent (not planning)
