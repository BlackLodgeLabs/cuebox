---
name: Phase 8 — Integration, NFR Validation & Polish
overview: "Close the MVP by validating integration coverage, NFR targets (PRD §21), all 24 PRD success criteria, root README, and a Phase 8 gate script — with incremental roadmap checkbox updates and AGENTS.md structural review."
depends_on: Phase 7 (complete)
todos:
  # ── Baseline ──────────────────────────────────────────────────────────────
  - id: p8-baseline-gates
    content: "Confirm verify-phase7-gates.sh and full regression chain (Phases 2.5–7) pass before Phase 8 work begins"
    status: pending
  - id: p8-gap-analysis
    content: "Audit existing tests vs roadmap Phase 8 checklist; document gaps (consolidated journey, NO_PREFERENCE_CONFLICT API test, history <2s, import <1s assertion, 500-film perf)"
    status: pending
  # ── Integration tests ─────────────────────────────────────────────────────
  - id: p8-e2e-journey
    content: "Add api/tests/test_integration_full_journey.py — import → enrich (mocked providers) → recommend → history list/detail in one test module"
    status: pending
  - id: p8-profile-cache
    content: "Confirm profile cache hit integration test covers roadmap item; extend if session persistence (profile_cache_hit column) should be asserted on GET /recommendations/{id}"
    status: pending
  - id: p8-csv-sync-scenarios
    content: "Confirm CSV sync diff integration tests (add, remove, watch, re-add archived) are collected in Phase 8 gate; add missing scenario if any"
    status: pending
  - id: p8-review-flows
    content: "Confirm review accept/reject integration tests cover roadmap; ensure accept path reaches ready + recommendable state"
    status: pending
  - id: p8-error-cases
    content: "Add integration test for NO_PREFERENCE_CONFLICT on POST /recommendations; confirm INSUFFICIENT_CANDIDATES and WATCHLIST_SIZE_EXCEEDED already gated"
    status: pending
  # ── Unit tests (regression confirmation) ──────────────────────────────────
  - id: p8-unit-regression
    content: "Wire unit test files into verify-phase8-gates.sh — profile canonicalization, scoring, confidence, CSV validation, constraint relaxation"
    status: pending
  # ── Performance validation ────────────────────────────────────────────────
  - id: p8-perf-recommendation
    content: "Recommendation <30s — retain mocked 5-film smoke in gate; add optional @pytest.mark.slow 500-film benchmark or document representative-hardware manual step"
    status: pending
  - id: p8-perf-history
    content: "Add timing assertion to history list test — GET /recommendations completes <2s with seeded sessions"
    status: pending
  - id: p8-perf-import
    content: "Add <1s assertion to test_import_returns_job_immediately (monotonic timer; allow CI slack if needed)"
    status: pending
  # ── PRD success criteria ──────────────────────────────────────────────────
  - id: p8-prd-audit
    content: "Create scripts/verify-prd-success-criteria.sh or gate section mapping criteria 1–24 to existing tests + manual checks; document any manual-only criteria"
    status: pending
  # ── Documentation & tooling ─────────────────────────────────────────────
  - id: p8-readme
    content: "Add root README.md — prerequisites, config.yaml/.env setup, docker compose up, links to documents/, optional letterboxd fixture note"
    status: pending
  - id: p8-smoke-script
    content: "Optional scripts/smoke-test.sh — thin wrapper over verify-phase2-gates.sh or curl-based journey using letterboxd/watchlist.csv against live stack"
    status: pending
  # ── Verification & docs ─────────────────────────────────────────────────
  - id: p8-gate-script
    content: "Add scripts/verify-phase8-gates.sh — integration suite subset, unit regression, perf assertions, Phase 7 regression, optional full-stack smoke"
    status: pending
  - id: p8-verify-gates
    content: "Run verify-phase8-gates.sh plus full regression chain; confirm API CI and frontend CI green"
    status: pending
  - id: p8-update-roadmap
    content: "Check off Phase 8 task checklist and verification gate in documents/roadmap.md; update overview to Phase 8 complete / MVP shipped"
    status: pending
  - id: p8-document-index
    content: "Add phase-8-plan.md to roadmap Document Index Phase plans row"
    status: pending
  - id: p8-agents-md
    content: "Review AGENTS.md for structural changes (README replaces 'no root README', verify-phase8-gates.sh, smoke script, project overview Phase 8)"
    status: pending
isProject: false
---

# Phase 8 — Integration, NFR Validation & Polish

## Context

**Phase 7 is complete.** Cuebox exposes recommendation internals via gated `/dev/*` endpoints and a hidden frontend dev panel. The MVP feature set (import, enrichment, sync, recommendations, history, developer mode) is implemented across Phases 0–7.

**Phase 8 goal:** Meet [PRD.md §21](./PRD.md) non-functional requirements and verify all [PRD.md §23](./PRD.md) success criteria — per [`documents/roadmap.md`](./roadmap.md) Phase 8. This phase is primarily **validation, documentation, and gap-filling**, not new product features.

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 8 task checklist + verification gate |
| [`documents/PRD.md`](./PRD.md) | §21 NFRs; §23 success criteria (24 items) |
| [`documents/Architecture.md`](./Architecture.md) | Testing strategy; deployment model |
| [`scripts/verify-phase7-gates.sh`](../scripts/verify-phase7-gates.sh) | Regression baseline (must stay green) |

### Current vs target gap summary

| Area | Today | Phase 8 target |
|------|-------|----------------|
| **Integration coverage** | Spread across `test_integration_*.py` modules | Explicit full-journey test + roadmap items confirmed in gate script |
| **Error API tests** | `INSUFFICIENT_CANDIDATES`, `WATCHLIST_SIZE_EXCEEDED` covered | Add `NO_PREFERENCE_CONFLICT` integration test on `POST /recommendations` |
| **Unit coverage** | Files exist for all roadmap unit items | Named in `verify-phase8-gates.sh` (regression guard) |
| **Perf: recommend <30s** | Asserted in `test_end_to_end_recommendation` (5 seeded films, mocked providers) | Retain in gate; optional slow 500-film benchmark documented |
| **Perf: history <2s** | Functional test only | Timing assertion added |
| **Perf: import <1s** | 202 returned; no timing assert | Timing assertion on job creation |
| **PRD criteria** | Implicitly covered by phase gates | Explicit audit script or gate section |
| **Root README** | AGENTS.md notes "no root README yet" | `README.md` at repo root |
| **Smoke script** | `verify-phase2-gates.sh` (live stack + fixture) | Optional `scripts/smoke-test.sh` documented in README |
| **Gate script** | Through Phase 7 only | `scripts/verify-phase8-gates.sh` |

### Existing test inventory (starting point)

Most Phase 8 checklist items already have test files. Phase 8 work is to **close gaps**, **consolidate visibility**, and **encode NFR assertions in a gate script**.

| Roadmap item | Existing coverage | Gap |
|--------------|-------------------|-----|
| Import → enrich → recommend → history | Partial (`test_integration_import`, `test_integration_semantic_pipeline`, `test_integration_recommendation`, `test_integration_recommendation_history`) | Single chained journey test |
| Profile cache hit | `test_integration_profile_cache.py` | Optional: assert persisted `profile_cache_hit` on session detail |
| CSV sync diff | `test_integration_csv_sync.py` | Confirm all four scenarios in gate collect |
| Review accept/reject | `test_integration_review.py`, `test_integration_review_accept_semantic.py` | Gate inclusion |
| `INSUFFICIENT_CANDIDATES` | `test_integration_recommendation_history.py` | Gate inclusion |
| `WATCHLIST_SIZE_EXCEEDED` | `test_integration_csv_sync.py`, `test_csv_parser.py` | Gate inclusion |
| `NO_PREFERENCE_CONFLICT` | `test_questionnaire_validation.py` (unit) | **API integration test missing** |
| Profile canonicalization | `test_profile_canonicalization.py` | Gate inclusion |
| Scoring signals | `test_scoring_service.py` | Gate inclusion |
| Confidence scoring | `test_confidence_scoring.py` | Gate inclusion |
| CSV validation | `test_csv_parser.py` | Gate inclusion |
| Constraint relaxation | `test_constraint_relaxation.py`, `test_integration_constraint_relaxation.py` | Gate inclusion |
| Recommend <30s | `test_end_to_end_recommendation` | 500-film optional benchmark |
| History <2s | — | **New timing assert** |
| Import <1s | `test_import_returns_job_immediately` (no timer) | **New timing assert** |

---

## Implementation Slices

Execute in order. After each slice: run slice gates → update roadmap checkboxes → commit → push.

### Slice 8a — Baseline & gap analysis

**Todos:** `p8-baseline-gates`, `p8-gap-analysis`

1. Ensure Postgres available (`docker` + pgvector container or `docker compose up postgres`).
2. Run full regression:

```bash
bash scripts/verify-phase7-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/ -v
```

3. Record gap analysis results in this plan's [inventory table](#existing-test-inventory-starting-point) if findings differ.
4. Mark `p8-baseline-gates` and `p8-gap-analysis` complete in frontmatter.

**Slice gate:** All Phase 7 gates green.

---

### Slice 8b — Integration test gaps

**Todos:** `p8-e2e-journey`, `p8-profile-cache`, `p8-csv-sync-scenarios`, `p8-review-flows`, `p8-error-cases`

#### Full journey (`p8-e2e-journey`)

Add `api/tests/test_integration_full_journey.py`:

1. `POST /import` with small CSV fixture (reuse helpers from `test_integration_import.py`).
2. Poll until job `complete` (mocked TMDB/OMDb/OpenAI via existing `integration_client` fixtures).
3. Accept any `review-required` films if present.
4. `POST /recommendations` with `DEFAULT_QUESTIONNAIRE`.
5. `GET /recommendations` — session appears in list.
6. `GET /recommendations/{session_id}` — winner + profile summary present.

Reuse `_import_csv`, `_wait_for_complete`, `_wait_for_review_required`, and `seed_ready_films` patterns; do not duplicate HTTP mock setup.

#### Error case (`p8-error-cases`)

Add to `test_integration_recommendation_history.py` or new `test_integration_recommendation_errors.py`:

```python
# POST /recommendations with "No Preference" + another genre → 400 NO_PREFERENCE_CONFLICT
```

Confirm existing tests remain collected for `INSUFFICIENT_CANDIDATES` and `WATCHLIST_SIZE_EXCEEDED`.

#### Confirm existing modules (`p8-profile-cache`, `p8-csv-sync-scenarios`, `p8-review-flows`)

No new files required if scenarios pass; document test names in gate script (see Slice 8f).

**Slice gate:**

```bash
cd api && pytest tests/test_integration_full_journey.py \
  tests/test_integration_profile_cache.py \
  tests/test_integration_csv_sync.py \
  tests/test_integration_review.py \
  tests/test_integration_recommendation_history.py -v
```

**Roadmap checkboxes:** Integration Tests section (all five bullets).

---

### Slice 8c — Performance validation

**Todos:** `p8-perf-recommendation`, `p8-perf-history`, `p8-perf-import`

| NFR | Implementation |
|-----|----------------|
| Recommend <30s | Keep `test_end_to_end_recommendation` assert (`elapsed < 30`). Optional: `@pytest.mark.slow` test seeding N ready films (e.g. 100–500) — run only when `RUN_SLOW_PERF=1`. |
| History <2s | In `test_history_list_and_detail`, wrap `GET /recommendations?limit=10` with `time.monotonic()`; assert `< 2.0`. Seed ≥1 session first. |
| Import <1s | In `test_import_returns_job_immediately`, measure POST duration; assert `< 1.0` (use generous bound e.g. `1.5` in CI if flaky). |

**Slice gate:**

```bash
cd api && pytest tests/test_integration_recommendation.py::test_end_to_end_recommendation \
  tests/test_integration_recommendation_history.py::test_history_list_and_detail \
  tests/test_integration_import.py::test_import_returns_job_immediately -v
```

**Roadmap checkboxes:** Performance Validation section (all three bullets).

---

### Slice 8d — Unit regression & PRD audit

**Todos:** `p8-unit-regression`, `p8-prd-audit`

#### Unit regression

Gate script must run (no DB required):

```bash
cd api && pytest \
  tests/test_profile_canonicalization.py \
  tests/test_scoring_service.py \
  tests/test_confidence_scoring.py \
  tests/test_csv_parser.py \
  tests/test_constraint_relaxation.py \
  tests/test_questionnaire_validation.py -v
```

**Roadmap checkboxes:** Unit Tests section (all five bullets).

#### PRD success criteria audit (`p8-prd-audit`)

Add `scripts/verify-prd-success-criteria.sh` (or a documented section inside `verify-phase8-gates.sh`) that:

1. Maps each of the 24 criteria in [roadmap PRD table](./roadmap.md#prd-success-criteria-mapping) to:
   - A pytest test name (`pytest --collect-only` grep), **or**
   - A manual verification step (UI / live stack).
2. Fails if a criterion has no mapped test or manual instruction.
3. Prints a summary table for release sign-off.

Criteria likely needing **manual** verification (document, do not block CI on):

| # | Criterion | Manual check |
|---|-----------|--------------|
| 18 | Winner + 4 runners-up with structured reasoning | UI results screen or integration response shape |
| 22 | Provider swap via `config.yaml` only | Change provider in test config; no code edit |

**Roadmap checkbox:** Verification gate — "All 24 PRD success criteria verified".

---

### Slice 8e — Documentation & smoke script

**Todos:** `p8-readme`, `p8-smoke-script`

#### Root `README.md` (`p8-readme`)

Minimum sections:

1. **Cuebox** — one-paragraph description (film picker from Letterboxd watchlist).
2. **Prerequisites** — Docker, Docker Compose; API keys (`TMDB_API_KEY`, `OPENAI_API_KEY` when using OpenAI providers).
3. **Quick start**
   - `cp config.example.yaml config.yaml`
   - `cp .env.example .env` and fill keys
   - `docker compose up`
   - Open http://localhost:3000
4. **Documentation** — link `documents/roadmap.md`, `documents/PRD.md`, `documents/DESIGN.md`, `AGENTS.md` (for agents/CI).
5. **Testing** — `bash scripts/verify-phase8-gates.sh` (once added).
6. **Fixtures** — optional `letterboxd/watchlist.csv` (gitignored) for manual smoke.

Do not duplicate full API reference; point to `documents/api-contracts.md`.

#### Optional smoke script (`p8-smoke-script`)

Either:

- Add `scripts/smoke-test.sh` that wraps `scripts/verify-phase2-gates.sh` with clear prereqs (`docker compose up`, `letterboxd/watchlist.csv`), **or**
- Document `verify-phase2-gates.sh` as the smoke test in README with env vars (`CSV_PATH`, `API_BASE`).

Mark roadmap "Optional smoke test script" complete when one path is documented and runnable.

**Roadmap checkboxes:** Documentation & Tooling section.

---

### Slice 8f — Gate script, roadmap, AGENTS.md

**Todos:** `p8-gate-script`, `p8-verify-gates`, `p8-update-roadmap`, `p8-document-index`, `p8-agents-md`

#### `scripts/verify-phase8-gates.sh`

Proposed gates:

| Gate | Check |
|------|-------|
| 1 | `cd api && ruff check app tests` |
| 2 | Unit regression (Slice 8d file list) |
| 3 | Integration suite — full journey + profile cache + csv sync + review + recommendation history/errors |
| 4 | Performance asserts — recommend, history, import timing tests |
| 5 | `scripts/verify-prd-success-criteria.sh` (or inline criteria map) |
| 6 | `cd frontend && npx tsc --noEmit && npm run build` |
| 7 | `bash scripts/verify-phase7-gates.sh` (full regression) |
| 8 | Optional: `PLAYWRIGHT_E2E_STACK=1` — `npm run test:e2e` |
| 9 | Optional: live stack smoke — `letterboxd/watchlist.csv` + `scripts/smoke-test.sh` or `verify-phase2-gates.sh` |

Pattern after `verify-phase7-gates.sh`: `start_postgres` helper, `set -euo pipefail`, `pass`/`fail` helpers.

#### Combined regression (required before marking Phase 8 complete)

```bash
bash scripts/verify-phase8-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/ -v
```

Confirm `.github/workflows/api-ci.yml` and `.github/workflows/frontend-ci.yml` pass on push.

---

## Roadmap Checkbox Mapping

### Integration tests

| Roadmap item | Plan todo(s) | Test file(s) |
|--------------|--------------|--------------|
| Import → enrich → recommend → history | `p8-e2e-journey` | `test_integration_full_journey.py` |
| Profile cache hit on duplicate questionnaire | `p8-profile-cache` | `test_integration_profile_cache.py` |
| CSV sync diff scenarios | `p8-csv-sync-scenarios` | `test_integration_csv_sync.py` |
| Review accept/reject flows | `p8-review-flows` | `test_integration_review.py` |
| Error cases (3 codes) | `p8-error-cases` | `test_integration_recommendation_history.py`, `test_integration_csv_sync.py`, new NO_PREFERENCE test |

### Unit tests

| Roadmap item | Plan todo(s) | Test file(s) |
|--------------|--------------|--------------|
| Profile canonicalization and hashing | `p8-unit-regression` | `test_profile_canonicalization.py` |
| Scoring signal calculations | `p8-unit-regression` | `test_scoring_service.py` |
| Confidence score computation | `p8-unit-regression` | `test_confidence_scoring.py` |
| CSV validation logic | `p8-unit-regression` | `test_csv_parser.py` |
| Constraint relaxation logic | `p8-unit-regression` | `test_constraint_relaxation.py` |

### Performance validation

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Recommendation <30s | `p8-perf-recommendation` |
| History list <2s | `p8-perf-history` |
| Import <1s job creation | `p8-perf-import` |

### Documentation & tooling

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Root README.md | `p8-readme` |
| Optional smoke test script | `p8-smoke-script` |

### Verification gate

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| All 24 PRD success criteria verified | `p8-prd-audit`, `p8-verify-gates` |
| Integration test suite passes | `p8-gate-script`, `p8-verify-gates` |
| Performance targets met | `p8-perf-*`, `p8-verify-gates` |

---

## Verification Gates

See [Slice 8f](#slice-8f--gate-script-roadmap-agentsmd) for the full `verify-phase8-gates.sh` design.

### Manual hello-world verification (MVP sign-off)

With `docker compose up` and keys configured:

1. Import `letterboxd/watchlist.csv` (or sample CSV) — job returns immediately; progress pollable.
2. Complete match review if prompted.
3. Run questionnaire → results show winner + runners-up with explanations.
4. Open History — session listed; detail shows profile summary.
5. Settings → sync page shows RSS status.
6. Optional: `developer_mode: true` → dev panel on results/history with `?dev=1`.

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** per slice. Do not mark verification gates complete before `verify-phase8-gates.sh` passes.

### During implementation (per slice)

1. Complete slice work and run slice gate(s).
2. Mark matching Phase 8 **Task Checklist** items `- [x]` using the [checkbox mappings](#roadmap-checkbox-mapping) above.
3. Commit: `phase-8: <slice> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.
5. Mark corresponding plan frontmatter todo(s) `completed`.

### Final pass (`p8-update-roadmap`, `p8-document-index`)

Only after `verify-phase8-gates.sh` and combined regression pass:

1. Mark all remaining Phase 8 Task Checklist and Verification Gate checkboxes `- [x]`.
2. Update **Overview** (line ~11):

```markdown
**Current state:** Phase 8 complete. MVP shipped — integration suite, NFR validation, PRD success criteria verified, and root README published. See [Future Expansion Backlog](#future-expansion-backlog) for post-MVP work.
```

3. Add this plan to **Document Index** Phase plans row:

```markdown
| Phase plans | ... , [phase-8-plan.md](./phase-8-plan.md) |
```

4. Mark all plan frontmatter todos `completed`.
5. Commit: `phase-8: complete — roadmap overview and plan todos updated`.

### Commit discipline

- Prefix commits with `phase-8:`.
- Include roadmap checkbox updates in the same commit as the feature they document.
- Never mark verification gates complete before the gate script passes.

---

## AGENTS.md Review (final step)

After all gates pass and the roadmap overview is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance.

### When to update AGENTS.md

| Change in Phase 8 | AGENTS.md section to update |
|-------------------|----------------------------|
| Root `README.md` added | **Project overview** — replace "no root README yet"; point humans to `README.md`, keep `documents/` for specs |
| `scripts/verify-phase8-gates.sh` added | **Lint and test** — add gate script row |
| `scripts/smoke-test.sh` or smoke documented | **Lint and test** or **Hello-world verification** |
| Optional slow perf env var (`RUN_SLOW_PERF=1`) | **Gotchas** — document when to run 500-film benchmark |
| New compose service or port | **Running the stack** — service table (expected: unchanged) |
| New required env var | **First-time config** or **Gotchas** (expected: unchanged) |
| ESLint initialized during Phase 8 | **Lint and test** — replace `tsc --noEmit`-only note with `npm run lint` |
| Docker/bootstrap change | **Docker daemon** / **Running the stack** / **Local development** |
| MVP complete statement | **Project overview** — "Through Phase 8: …" |

### Review checklist

Run through each item; update AGENTS.md only where repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged unless `docker-compose.yml` changes
- [ ] **Required env vars** — unchanged unless new secrets added to `.env.example`
- [ ] **Lint / test commands** — table includes `verify-phase8-gates.sh`; PRD audit script if added
- [ ] **Docker / bootstrap** — README quick start matches AGENTS.md compose instructions
- [ ] **New standard commands** — gate script + optional smoke documented
- [ ] **Hello-world verification** — aligns with README quick start
- [ ] **Cursor Cloud instructions** — still accurate
- [ ] **Project overview** — reflects Phase 8 / MVP complete

If no structural changes apply beyond README, gate script, and overview text, note in the final PR: "AGENTS.md reviewed — minimal updates (README pointer, verify-phase8-gates.sh, Phase 8 overview)."

Mark plan todo `p8-agents-md` complete after this review.

---

## Recommended PR Slicing

| Slice | Contents | Gates |
|-------|----------|-------|
| **8a** | Baseline regression | Phase 7 gates |
| **8b** | Full journey + `NO_PREFERENCE_CONFLICT` integration test | Integration pytest subset |
| **8c** | Timing assertions (history, import; confirm recommend) | Perf pytest subset |
| **8d** | PRD criteria audit script + unit regression wiring | Audit script + unit pytest |
| **8e** | `README.md` + optional smoke script | Manual review |
| **8f** | `verify-phase8-gates.sh`, roadmap, AGENTS.md | All gates |

Merge order: 8a → 8b → 8c → 8d → 8e → 8f (8b+8c can combine; 8e can parallelize with 8d).

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| Full journey integration test | `api/tests/test_integration_full_journey.py` |
| Recommendation error integration test | `api/tests/test_integration_recommendation_errors.py` or extend history module |
| Perf timing asserts | `test_integration_import.py`, `test_integration_recommendation_history.py` |
| PRD criteria audit | `scripts/verify-prd-success-criteria.sh` |
| Root README | `README.md` |
| Optional smoke script | `scripts/smoke-test.sh` |
| Gate script | `scripts/verify-phase8-gates.sh` |
| Roadmap | `documents/roadmap.md` — Phase 8 checked off |
| Agent guidance | `AGENTS.md` — updated if structural changes apply |
| This plan | `documents/phase-8-plan.md` |

---

## Exit Criteria

Phase 8 is **done** when:

1. All todos in this plan frontmatter are `completed`
2. `bash scripts/verify-phase8-gates.sh` passes (all gates)
3. Combined regression chain (Phases 2.5–8) passes
4. `documents/roadmap.md` overview states Phase 8 complete
5. All 24 PRD success criteria have a documented test or manual verification path
6. Root `README.md` exists with setup instructions
7. AGENTS.md reviewed and updated for any structural changes

**MVP status:** After Phase 8, the Film Picker roadmap phases 0–8 are complete. Post-MVP work lives in [Future Expansion Backlog](./roadmap.md#future-expansion-backlog).
