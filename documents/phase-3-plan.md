---
name: Phase 3 — Semantic Enrichment & Embeddings
overview: "Complete the async enrichment pipeline so films transition enriching → ready (or failed), with config-driven semantic and embedding providers, persisted film_semantic_profiles and film_embeddings, and import job counters aligned to api-contracts terminal semantics."
depends_on: Phase 2.5 (complete)
todos:
  - id: provider-interfaces
    content: Define SemanticEnrichmentProvider and EmbeddingProvider ABCs; extend ProviderService with shared httpx client resolution
    status: completed
  - id: openai-semantic
    content: Implement OpenAI semantic enrichment provider + versioned prompt template (semantic_enrichment.py)
    status: completed
  - id: ollama-semantic
    content: Implement Ollama semantic enrichment provider (config-driven model/base URL)
    status: completed
  - id: openai-embedding
    content: Implement OpenAI embedding provider (text-embedding-3-small, 1536-dim)
    status: completed
  - id: voyage-embedding
    content: Implement Voyage embedding provider stub (config switch only; same interface)
    status: completed
  - id: semantic-service
    content: Add semantic_service.py — build prompt from film_metadata, parse LLM JSON, persist film_semantic_profiles
    status: completed
  - id: embedding-service
    content: Add embedding_service.py — compose embedding input, persist film_embeddings (type semantic, version embedding-v1)
    status: completed
  - id: repositories
    content: Add semantic_profile_repository and film_embedding_repository with upsert helpers
    status: completed
  - id: pipeline-shared-helpers
    content: Extract mark_film_failed + sync_import_job_progress shared helpers; refactor MetadataService._mark_failed to use them
    status: completed
  - id: pipeline-continuation
    content: Wire semantic + embedding steps after metadata in run_import_enrichment; enriching → ready | failed
    status: completed
  - id: job-counters
    content: Update count_by_import_job_status so processed_films counts only ready + failed (api-contracts terminal states)
    status: completed
  - id: review-accept-resume
    content: Add BackgroundTasks to accept_review router; schedule run_semantic_pipeline_for_film after commit
    status: completed
  - id: rate-limiting
    content: Sequential per-film processing with configurable inter-film delay; respect provider rate limits
    status: completed
  - id: mock-providers
    content: Extend mock_providers / test fixtures with deterministic semantic + embedding responses (no live API keys)
    status: completed
  - id: unit-tests
    content: Unit tests — prompt assembly, LLM JSON parsing/validation, embedding input composition, counter semantics
    status: completed
  - id: integration-tests
    content: Integration tests — full pipeline to ready, semantic failure in failure_summary, accept-review → ready
    status: completed
  - id: verify-gates
    content: Run all Phase 3 verification gates locally; confirm CI green on push
    status: completed
  - id: update-roadmap
    content: Check off Phase 3 task checklist and verification gate in documents/roadmap.md; update overview
    status: completed
  - id: agents-md-review
    content: Review AGENTS.md for structural changes (env vars, compose, lint/test commands, bootstrap)
    status: completed
isProject: false
---

# Phase 3 — Semantic Enrichment & Embeddings

## Context

**Phase 2.5 is complete** (GitHub Actions CI, Postgres-backed integration tests, adversarial regression coverage). **Phase 2** delivered metadata matching through `enrichment_status = enriching`. Films stop there today — `film_semantic_profiles`, `film_embeddings`, and `ready` are schema-ready but unpopulated.

**Phase 3 goal:** Finish the per-film pipeline per [sequence-diagrams.md §3](./sequence-diagrams.md): after metadata (and OMDb supplementation), generate a versioned semantic profile, generate a semantic embedding, and transition the film to `ready` or `failed`.

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 3 task checklist + verification gate |
| [`documents/phase-2-plan.md`](./phase-2-plan.md) | Pipeline boundary (`enriching` = metadata complete) |
| [`documents/phase-2.5-plan.md`](./phase-2.5-plan.md) | CI gates, roadmap update procedure, AGENTS.md review template |
| [`documents/api-contracts.md`](./api-contracts.md) | `processed_films` terminal semantics (`ready` \| `failed`); `semantic_profile` on detail when `ready` |
| [`documents/database-design.md`](./database-design.md) | `film_semantic_profiles`, `film_embeddings`, HNSW index, CHECK constraints |
| [`documents/Architecture.md`](./Architecture.md) | Provider independence, enrichment stages |
| [`scripts/verify-phase2.5-gates.sh`](../scripts/verify-phase2.5-gates.sh) | Baseline CI simulation (must still pass after Phase 3) |

### Current scaffold state

| Path | State |
|------|-------|
| `api/app/services/import_service.py` | `run_import_enrichment` runs metadata only; stops at `enriching` |
| `api/app/services/provider_service.py` | TMDB + OMDb only; no semantic/embedding client resolution |
| `api/app/providers/` | `tmdb.py`, `omdb.py`, `http_retry.py` — no `semantic/` or `embedding/` subpackages |
| `api/app/repositories/film_repository.py` | `_METADATA_PROCESSED_STATUSES` includes `enriching` (Phase 2 semantics) |
| `api/app/services/metadata_service.py` | `accept_review` sets `enriching` but does not schedule semantic work |
| `api/app/services/film_presenter.py` | Returns `semantic_profile` block only when `enrichment_status == ready` |
| `api/app/database/models.py` | `FilmSemanticProfile`, `FilmEmbedding` models exist; no repositories |
| `config.example.yaml` | `providers.semantic_enrichment` + `providers.embedding` configured (OpenAI defaults) |
| `.env.example` | `OPENAI_API_KEY` present; no Ollama/Voyage vars yet |
| `api/tests/mock_providers.py` | TMDB/OMDb adversarial mocks only |
| Integration tests | Assert films reach `enriching` / `review_required` / `failed`; none assert `ready` |

### Dependency graph

```mermaid
flowchart TD
    A[1. Provider interfaces + ProviderService extension] --> B[2. OpenAI semantic + embedding providers]
    B --> C[3. Ollama semantic + Voyage embedding providers]
    C --> D[4. Repositories + semantic/embedding services]
    D --> E[5. Shared pipeline helpers — mark_film_failed + sync_import_job_progress]
    E --> F[6. Pipeline continuation in import orchestrator]
    F --> G[7. Job counters + review-accept BackgroundTasks]
    G --> H[8. Rate limiting + mock fixtures]
    H --> I[9. Unit + integration tests]
    I --> J[10. Verification gates]
    J --> K[11. Update roadmap]
    K --> L[12. AGENTS.md review]
```

### Baseline inventory (branch start)

| Item | Count / state |
|------|----------------|
| Phase 2.5 gates | `scripts/verify-phase2.5-gates.sh` — must remain green |
| CI workflow | `.github/workflows/api-ci.yml` — no live API keys |
| Integration tests | ~10 modules; 0 assert `enrichment_status == ready` |
| `mock_providers.py` | TMDB/OMDb only |
| Semantic/embedding code | None implemented |
| `system_versions` seed | `semantic-v1`, `embedding-v1` already seeded (migration `0002`) |

---

## Execution Plan

Complete work in five PR slices (see [Recommended PR Slicing](#recommended-pr-slicing)). After **each** slice: run the slice gate, check off matching [roadmap](#roadmap-checkbox-mapping) items, commit with `phase-3:` prefix, push, and confirm GitHub Actions is green before starting the next slice.

| Step | Slice | Work | Gate checkpoint | Roadmap items to check |
|------|-------|------|-----------------|------------------------|
| 1 | 3a | Provider ABCs, OpenAI semantic + embedding, prompt template | Gate 1 partial (unit) | Semantic provider + Embedding provider (OpenAI paths) |
| 2 | 3b | Ollama semantic, Voyage embedding, ProviderService wiring | Gate 1 partial | Config-driven provider switch (both interfaces) |
| 3 | 3c | Repositories, semantic_service, embedding_service, shared pipeline helpers | Gate 2 partial (unit) | Persist tasks + refactor `_mark_failed` / `_sync_job_progress` |
| 4 | 3d | Pipeline continuation, job counters, review-accept resume (BackgroundTasks), rate limit | Gates 3–5 | Wire pipeline + job completion + review accept + rate limit |
| 5 | 3e | Mocks, unit + integration tests, gate script | All gates | Verification gate (5 checkboxes) |
| 6 | — | Final gate run + roadmap overview + plan todos | All gates + Phase 2.5 regression | Overview + Phase 3 complete |
| 7 | — | AGENTS.md structural review | Manual checklist | — |

### Per-step commands

**Baseline (before any Phase 3 code — confirm Phase 2.5 still green):**

```bash
bash scripts/verify-phase2.5-gates.sh
```

**After Steps 1–3 (providers, services, shared helpers — no full pipeline yet):**

```bash
cd api && ruff check app tests
cd api && pytest tests/test_health.py tests/test_tmdb_normalization.py tests/test_http_retry.py -v
# New unit tests (add as implemented):
cd api && pytest tests/test_semantic_*.py tests/test_embedding_*.py tests/test_enrichment_pipeline.py -v
```

**After Step 4 (pipeline wired in import orchestrator):**

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && alembic upgrade head && pytest tests/ -v
```

**After Steps 5–6 (review accept + integration tests):**

```bash
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase2.5-gates.sh   # regression — Phase 2.5 gates must still pass
```

**Final (roadmap + AGENTS.md):**

```bash
git push -u origin cursor/phase-3-plan-9929   # or implementation branch
# Confirm GitHub Actions api-ci job green
```

---

## Verification Gates

Phase 3 introduces **`scripts/verify-phase3-gates.sh`** (add in slice 3e). All gates must pass before marking Phase 3 complete. Phase 2.5 gates are a **regression requirement** — run both scripts at the end.

### Gate 1 — Provider resolution (unit, no DB)

| Check | Pass criteria |
|-------|---------------|
| Semantic provider factory | `openai` requires `OPENAI_API_KEY`; `ollama` requires `OLLAMA_BASE_URL` only — provider-specific init, not a global API-key gate |
| Embedding provider factory | `openai` requires `OPENAI_API_KEY`; `voyage` requires `VOYAGE_API_KEY`; 1536-dim vector shape enforced |
| Shared HTTP client | Semantic/embedding providers receive `ProviderService` httpx client (no per-film client creation) |
| Prompt template | `semantic_enrichment.py` exports versioned template; output schema matches `film_semantic_profiles` columns |

```bash
cd api && pytest tests/test_semantic_provider.py tests/test_embedding_provider.py tests/test_semantic_prompt.py -v
```

### Gate 2 — Service layer (unit)

| Check | Pass criteria |
|-------|---------------|
| Semantic parse | Valid LLM JSON → `FilmSemanticProfile` fields; invalid JSON → structured error |
| Score ranges | `complexity`, `pacing`, `energy`, `obscurity` within 0–10 or null |
| Embedding input | Composes synopsis + genres + keywords + semantic summary |
| Counter semantics | `count_by_import_job_status`: `enriching` **not** counted as processed; `ready` + `failed` are |

```bash
cd api && pytest tests/test_semantic_service.py tests/test_embedding_service.py tests/test_job_counter_semantics.py -v
```

### Gate 3 — Full import pipeline (integration, mocked AI)

| Check | Pass criteria |
|-------|---------------|
| End-to-end import | `POST /import` → poll until `status: complete`; films reach `ready` (not stuck at `enriching`) |
| Semantic profile persisted | `film_semantic_profiles` row per successful film; `semantic_version = semantic-v1` |
| Embedding persisted | `film_embeddings` row with `embedding_type = semantic`, `embedding_version = embedding-v1` |
| Job counters | `processed_films` equals count of `ready` + `failed`; `processed_films <= total_films` |
| Detail API | `GET /films/{id}` returns populated `semantic_profile` when `ready` |

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && pytest tests/test_integration_semantic_pipeline.py -v
```

### Gate 4 — Failure handling (integration)

| Check | Pass criteria |
|-------|---------------|
| Provider error | Mock semantic/embedding failure → `enrichment_status = failed` |
| failure_summary | Failed film URI + reason appears in `GET /import/{job_id}/status` |
| Job completion | Job reaches `complete` when all films are `ready` or `failed` (not waiting on `enriching`) |
| Per-film isolation | One film's semantic failure does not halt the job (same pattern as Phase 2 orchestrator) |

```bash
cd api && pytest tests/test_integration_semantic_failures.py tests/test_import_orchestrator_faults.py -v
```

### Gate 5 — Review accept resume (integration)

| Check | Pass criteria |
|-------|---------------|
| Accept path | Low-confidence film → `POST /reviews/{id}/accept` → background semantic + embedding → `ready` |
| Detail after accept | `semantic_profile` populated on `GET /films/{id}` |
| Reject unchanged | Reject still → `failed` (no semantic work) |

```bash
cd api && pytest tests/test_integration_review_accept_semantic.py -v
```

### Gate 6 — pgvector / HNSW (integration or SQL)

| Check | Pass criteria |
|-------|---------------|
| Embedding rows queryable | `SELECT count(*) FROM film_embeddings WHERE embedding_type = 'semantic' > 0` after import test |
| HNSW index exists | `idx_film_embeddings_semantic_hnsw` present (already from Phase 1 migration) |

```bash
# Optional SQL check inside verify-phase3-gates.sh after integration import
docker exec "${PHASE3_PG_CONTAINER:-phase25-pg}" psql -U cuebox -d cuebox -c \
  "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_film_embeddings_semantic_hnsw';"
```

### Gate 7 — CI regression (no live API keys)

| Check | Pass criteria |
|-------|---------------|
| Full suite | `pytest tests/ -v` passes with `OPENAI_API_KEY` unset (mocks only) |
| Ruff | `ruff check app tests` clean |
| Phase 2.5 script | `bash scripts/verify-phase2.5-gates.sh` still passes |
| Test count | Collected tests ≥ Phase 2.5 baseline + new Phase 3 tests (update Gate 4 threshold in `verify-phase3-gates.sh`) |

### Consolidated gate script (to implement in slice 3e)

Create `scripts/verify-phase3-gates.sh` mirroring the Phase 2.5 structure:

1. Start/wait for Postgres (`pgvector/pgvector:pg16`)
2. `alembic upgrade head && pytest tests/ -v && ruff check app tests`
3. Grep for required regression test names (semantic pipeline, failure, accept-review)
4. Assert tests pass without `OPENAI_API_KEY` / `TMDB_API_KEY` / `OMDB_API_KEY`
5. Optional SQL assertions for `film_embeddings` and HNSW index
6. Run `verify-phase2.5-gates.sh` or inline its regression matrix

---

## Roadmap Checkbox Mapping

Check off [`documents/roadmap.md`](./roadmap.md) Phase 3 items **incrementally** as each todo completes — do not batch until the final gate pass unless a slice fully covers a subsection.

| Plan todo ID | Roadmap checklist item |
|--------------|------------------------|
| `provider-interfaces` + `openai-semantic` | Implement Semantic Enrichment Provider interface (config-driven) — OpenAI default |
| `ollama-semantic` | Semantic provider — Ollama per `config.yaml` |
| `openai-embedding` + `voyage-embedding` | Implement Embedding Provider interface (config-driven) — OpenAI default |
| `semantic-service` | Prompt template; persist `film_semantic_profiles` with version/model/timestamp |
| `embedding-service` | Input composition; persist `film_embeddings` (`embedding_type: semantic`) |
| `pipeline-shared-helpers` | Shared `mark_film_failed` + `sync_import_job_progress`; refactor metadata `_mark_failed` |
| `pipeline-continuation` | Wire `enriching → ready` on success; `enriching → failed` on provider error |
| `job-counters` | Update import job completion when all films reach terminal states |
| `review-accept-resume` | Resume pipeline on review accept |
| `rate-limiting` | Rate-limit / batch enrichment |
| `integration-tests` | Verification gate — all five bullets |
| `update-roadmap` | Overview: Phase 3 complete → Phase 4 next |

Also update Phase 2 **Implementation Notes** table row for **Job progress** once `job-counters` lands — `enriching` no longer counts as processed.

---

## Work Breakdown

### Step 1 — Provider interfaces and OpenAI implementations

**Goal:** Config-driven provider resolution with a shared httpx client, following the TMDB/OMDb pattern in `ProviderService`.

**Create:**

| Path | Responsibility |
|------|----------------|
| `api/app/providers/semantic/base.py` | `SemanticEnrichmentProvider` ABC — `async def enrich(context) -> SemanticProfileResult` |
| `api/app/providers/semantic/openai.py` | OpenAI chat completions; structured JSON output |
| `api/app/providers/semantic/ollama.py` | Ollama HTTP API (slice 3b) |
| `api/app/providers/embedding/base.py` | `EmbeddingProvider` ABC — `async def embed(text) -> list[float]` |
| `api/app/providers/embedding/openai.py` | `text-embedding-3-small` |
| `api/app/providers/embedding/voyage.py` | Voyage API (slice 3b) |
| `api/app/prompts/semantic_enrichment.py` | Versioned prompt (`semantic-v1`); documents expected JSON schema |

**Extend `ProviderService`:**

Use **provider-specific** initialization conditions — do not gate all providers on `OPENAI_API_KEY`. Mirror the TMDB/OMDb pattern: each provider checks only its own credentials/endpoint.

| Config `provider` | Semantic enrichment | Embedding |
|-------------------|---------------------|-----------|
| `openai` | Requires `OPENAI_API_KEY` | Requires `OPENAI_API_KEY` |
| `ollama` | Requires reachable `OLLAMA_BASE_URL` (default `http://localhost:11434`); no API key | — |
| `voyage` | — | Requires `VOYAGE_API_KEY` |

```python
# Structural requirements (implement in provider_service.py)
async def startup(...):
    # existing TMDB/OMDb ...
    semantic_name = config.providers.semantic_enrichment.provider
    if semantic_name == "openai" and settings.openai_api_key:
        self._semantic = OpenAISemanticProvider(self._http_client, settings.openai_api_key, ...)
    elif semantic_name == "ollama":
        # No API key — base URL only (settings.ollama_base_url or default)
        self._semantic = OllamaSemanticProvider(self._http_client, settings.ollama_base_url, ...)

    embedding_name = config.providers.embedding.provider
    if embedding_name == "openai" and settings.openai_api_key:
        self._embedding = OpenAIEmbeddingProvider(self._http_client, settings.openai_api_key, ...)
    elif embedding_name == "voyage" and settings.voyage_api_key:
        self._embedding = VoyageEmbeddingProvider(self._http_client, settings.voyage_api_key, ...)

def get_semantic_provider(self) -> SemanticEnrichmentProvider: ...
def get_embedding_provider(self) -> EmbeddingProvider: ...
```

**Health endpoint:** `_provider_status` must use the same per-provider rules (Ollama reports `ok` when base URL is configured, not when `OPENAI_API_KEY` is set).

**Settings:** Reuse `OPENAI_API_KEY` from `.env.example`. Add `OLLAMA_BASE_URL` (optional, default `http://localhost:11434`) and `VOYAGE_API_KEY` to `.env.example` when Ollama/Voyage providers land.

### Step 2 — Semantic and embedding services

**Goal:** Business logic between orchestrator and providers; persistence via repositories.

**Create:**

| Path | Responsibility |
|------|----------------|
| `api/app/repositories/semantic_profile_repository.py` | `upsert(db, film_id, profile)` |
| `api/app/repositories/film_embedding_repository.py` | `upsert(db, film_id, embedding_type, version, vector, model)` |
| `api/app/services/semantic_service.py` | Load `film_metadata` + keywords; call provider; validate; persist |
| `api/app/services/embedding_service.py` | Build text blob; call provider; assert `len(vector) == 1536`; persist |

**Semantic profile fields** (from `database-design.md` §4.4): `subgenres`, `themes`, `tones`, `visual_descriptors`, `emotional_outcomes`, `viewing_contexts`, `complexity`, `pacing`, `energy`, `obscurity`, `semantic_summary`, `semantic_version`, `generated_by_model`, `generated_at`.

**Embedding record:** `embedding_type = semantic`, `embedding_version = embedding-v1` (from `system_versions` seed), `embedding_model` from config.

### Step 3 — Shared pipeline helpers (extract before continuation)

**Goal:** Avoid duplicating failure-marking and job-progress logic across metadata, semantic, and embedding stages.

Today `MetadataService._mark_failed` updates `enrichment_status`, increments `failed_films`, and appends to `failure_summary`. `import_service._sync_job_progress` recomputes `processed_films` / `failure_summary` from film rows. Semantic failures must use the **same** behaviour — do not add a parallel `_mark_semantic_failed` on `MetadataService` or `SemanticService`.

**Create:** `api/app/services/enrichment_pipeline.py` (or `api/app/services/import_job_progress.py` split into two focused modules)

| Function | Responsibility | Replaces |
|----------|----------------|----------|
| `mark_film_failed(db, film, reason)` | Set `FAILED`; append to job `failure_summary` if `film.import_job_id` | `MetadataService._mark_failed` body |
| `sync_import_job_progress(db, job_id)` | Recompute `processed_films`, `failed_films`, `failure_summary` from film counts | `import_service._sync_job_progress` |
| `run_semantic_pipeline(db, film_id, provider_service)` | Semantic → embedding → `READY`; on error call `mark_film_failed` + `sync_import_job_progress` | New |

**Refactor (slice 3c):**

1. Move logic from `MetadataService._mark_failed` into `mark_film_failed`; have metadata service call the shared helper.
2. Move `_sync_job_progress` from `import_service.py` into `sync_import_job_progress`; update `import_service` imports.
3. Add unit test asserting metadata and semantic stages both record failures through the same helper (no duplicate summary entries).

### Step 4 — Pipeline continuation

**Goal:** Extend `run_import_enrichment` without rewriting metadata code.

**Approach:**

1. After `metadata.enrich_film` succeeds (film is `enriching`), call `await run_semantic_pipeline(db, film.id, provider_service)`.
2. `run_semantic_pipeline`: `semantic_service.enrich` → `embedding_service.embed` → `film_repository.update_enrichment_status(..., READY)`.
3. On `AppError` / provider failure: `mark_film_failed(db, film, reason)` then `sync_import_job_progress(db, film.import_job_id)` when applicable.
4. Keep **sequential** per-film processing; add optional `asyncio.sleep(delay)` from config (e.g. `enrichment.inter_film_delay_seconds: 0.25` in `config.example.yaml`) for rate limiting.

**Job completion change** (`film_repository.py`):

```python
# Phase 3: api-contracts terminal states only
_TERMINAL_PROCESSED_STATUSES = {EnrichmentStatus.READY, EnrichmentStatus.FAILED}
# enriching and review_required no longer count toward processed_films
```

Import job `mark_complete` when `processed >= total_films` where processed = ready + failed only. Films in `review_required` block completion (user must accept/reject first).

### Step 5 — Review accept resume

**Goal:** `POST /reviews/{id}/accept` currently sets `enriching` and returns — semantic work never runs.

**Router change required:** `accept_review` in `api/app/routers/v1/reviews.py` does **not** accept `BackgroundTasks` today. Add it to the endpoint signature (same pattern as `POST /import`):

```python
from fastapi import APIRouter, BackgroundTasks, Depends

@router.post("/{review_id}/accept", response_model=ReviewActionResponse)
async def accept_review(
    review_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
    provider_service: ProviderService = Depends(get_provider_service),
) -> ReviewActionResponse:
    film = await metadata_service.accept_review(db, review_id)
    db.commit()
    background_tasks.add_task(run_semantic_pipeline_for_film, film.id, provider_service)
    # ... build ReviewActionResponse
```

**Background task wrapper:** `run_semantic_pipeline_for_film` opens its own `SessionLocal()` (same lifecycle as `run_import_enrichment`), calls `run_semantic_pipeline`, commits, and invokes `sync_import_job_progress` when `film.import_job_id` is set. Do **not** pass the request-scoped `db` session into the background task.

**Layering:** Keep `MetadataService.accept_review` synchronous re metadata only; schedule semantic work in the **router** (or a thin `ReviewService`) where `BackgroundTasks` is available — `MetadataService` should not take `BackgroundTasks` as a dependency.

### Step 6 — Test infrastructure

**Extend `api/tests/mock_providers.py`:**

- Add `mock_semantic_response` / `mock_embedding_response` handlers on the shared httpx mock transport.
- Deterministic 1536-dim vector (e.g. seeded pseudo-random or fixed slice) for pgvector inserts.
- Adversarial profile: `semantic_failure` (500 from LLM), `embedding_failure`, `malformed_semantic_json`.

**New test modules:**

| File | Covers |
|------|--------|
| `test_semantic_prompt.py` | Prompt includes title, synopsis, genres |
| `test_semantic_service.py` | JSON parse, CHECK constraint edge cases |
| `test_embedding_service.py` | Input composition, dimension guard |
| `test_job_counter_semantics.py` | `enriching` excluded from processed count |
| `test_enrichment_pipeline.py` | Shared `mark_film_failed` used by metadata and semantic paths |
| `test_integration_semantic_pipeline.py` | Import → `ready`, profiles + embeddings exist |
| `test_integration_semantic_failures.py` | failure_summary on semantic error |
| `test_integration_review_accept_semantic.py` | Accept → `ready` with semantic_profile |

**Update existing tests:**

- `test_integration_import.py` — change assertions from `enriching` to `ready` once mocks return semantic responses.
- `test_accept_review_transitions_to_enriching` — extend or add sibling test for final `ready` state after background task.

### Step 7 — Health endpoint

`GET /api/v1/health` already reports `semantic_enrichment` and `embedding` provider status. Wire to real key checks once providers exist (same `_provider_status` pattern as TMDB).

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** using the [Roadmap Checkbox Mapping](#roadmap-checkbox-mapping), then a final pass when all gates pass.

### During implementation (per slice)

1. Complete slice work and run slice gate(s).
2. Mark matching Phase 3 **Task Checklist** items `- [x]`.
3. Commit: `phase-3: <slice description> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.

### Final pass (Step 6 — all gates green)

1. Mark any remaining Task Checklist and **Verification Gate** checkboxes (all five).
2. Update **Overview** (line ~11):

```markdown
**Current state:** Phase 3 complete. Films progress through semantic enrichment and embedding generation to `enrichment_status = ready`; import job counters align with api-contracts terminal semantics. Next up: Phase 4 — Watchlist Synchronisation.
```

3. Update Phase 2 **Implementation Notes** — Job progress row: `processed_films` counts `ready` + `failed` only.
4. Confirm Phase 4 **Depends on:** reads `Phase 3` (no change if already present).
5. Mark all plan frontmatter todos `completed`.
6. Commit: `phase-3: complete — roadmap and plan todos updated`.

### Commit discipline

- Prefix commits with `phase-3:`.
- Include roadmap checkbox updates in the same commit as the feature they document (or in the gate-verification commit for gates-only items).
- Do not mark roadmap verification gates complete before `verify-phase3-gates.sh` passes.

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| Semantic provider ABC + OpenAI/Ollama | `api/app/providers/semantic/` |
| Embedding provider ABC + OpenAI/Voyage | `api/app/providers/embedding/` |
| Prompt template | `api/app/prompts/semantic_enrichment.py` |
| Semantic service | `api/app/services/semantic_service.py` |
| Embedding service | `api/app/services/embedding_service.py` |
| Repositories | `api/app/repositories/semantic_profile_repository.py`, `film_embedding_repository.py` |
| Shared pipeline helpers | `api/app/services/enrichment_pipeline.py` — `mark_film_failed`, `sync_import_job_progress`, `run_semantic_pipeline` |
| Pipeline continuation | `api/app/services/import_service.py` (calls shared helpers) |
| Review accept scheduling | `api/app/routers/v1/reviews.py` — `BackgroundTasks` + `run_semantic_pipeline_for_film` |
| Metadata refactor | `api/app/services/metadata_service.py` — delegate `_mark_failed` to shared helper |
| Job counter fix | `api/app/repositories/film_repository.py` |
| Config | `config.example.yaml` — optional `enrichment.inter_film_delay_seconds` |
| Env example | `.env.example` — `OLLAMA_BASE_URL`, `VOYAGE_API_KEY` if needed |
| Mock fixtures | `api/tests/mock_providers.py` (extended) |
| Unit tests | `test_semantic_*.py`, `test_embedding_*.py`, `test_job_counter_semantics.py` |
| Integration tests | `test_integration_semantic_*.py`, updated `test_integration_import.py` |
| Gate script | `scripts/verify-phase3-gates.sh` |
| Roadmap | `documents/roadmap.md` — Phase 3 checked off |
| Agent guidance | `AGENTS.md` — updated if structural changes apply |

---

## Recommended PR Slicing

| PR slice | Contents | Gates |
|----------|----------|-------|
| **3a — Providers (OpenAI)** | ABCs, OpenAI semantic + embedding, prompt template, ProviderService | Gate 1 |
| **3b — Alt providers** | Ollama semantic, Voyage embedding, `.env.example` | Gate 1 |
| **3c — Services** | Repositories, semantic/embedding services, shared pipeline helpers, metadata refactor | Gate 2 |
| **3d — Pipeline** | Orchestrator continuation, job counters, review accept (`BackgroundTasks`), rate limit | Gates 3–5 |
| **3e — Tests + gates** | Mocks, integration tests, `verify-phase3-gates.sh`, roadmap | All gates + Phase 2.5 regression |

---

## Exit Criteria

Phase 3 is **done** when:

1. All 19 todos in this plan frontmatter are `completed`
2. All 7 verification gates pass (document results in final PR description)
3. `bash scripts/verify-phase2.5-gates.sh` still passes (regression)
4. `documents/roadmap.md` Phase 3 checklist and Verification Gate section are fully checked off
5. Overview reflects Phase 3 complete / Phase 4 next
6. Phase 2 Implementation Notes job-progress row updated
7. `AGENTS.md` reviewed and updated if structural changes apply (see below)
8. Changes committed, pushed, and PR ready for review

---

## AGENTS.md Review (final step)

After all gates pass and the roadmap is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance. Phase 3 extends the enrichment pipeline and test suite; compose topology may stay the same unless Ollama runs as a new service.

### When to update AGENTS.md

| Change in Phase 3 | AGENTS.md section to update |
|-------------------|----------------------------|
| New compose service (e.g. `ollama` container) | **Running the stack** — service table, URL, port |
| New required env var (`OLLAMA_BASE_URL`, `VOYAGE_API_KEY`) | **First-time config** or **Gotchas** — document optional vs required |
| `scripts/verify-phase3-gates.sh` added | **Lint and test** — add gate script row; note run after Phase 2.5 script |
| Standard test command adds semantic test modules | **Lint and test** — update full suite description or unit-test row |
| `config.example.yaml` new `enrichment.*` keys | **Gotchas** — agents must copy `config.example.yaml` if new keys required |
| ESLint added (out of scope unless done incidentally) | Replace `tsc --noEmit` note with `npm run lint` |
| Docker/bootstrap change (e.g. Ollama in compose) | **Docker daemon** / **Running the stack** |

### Review checklist

Run through each item; update AGENTS.md only where repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged unless Ollama or another provider is added to `docker-compose.yml`
- [ ] **Required env vars** — `OPENAI_API_KEY` needed for live semantic runs; CI/tests must work without it (mocks). Document optional `OLLAMA_BASE_URL`, `VOYAGE_API_KEY`
- [ ] **Lint / test commands** — table includes `verify-phase3-gates.sh`; full `pytest tests/` still requires Postgres
- [ ] **Docker / bootstrap** — unchanged unless compose gains services or entrypoint runs new migrations
- [ ] **New standard commands** — gate script, any new pytest paths documented
- [ ] **Hello-world verification** — homepage still shows API/DB ok; provider keys show `error` without keys (expected)
- [ ] **Cursor Cloud instructions** — still accurate for nested Docker / `fuse-overlayfs`

If no structural changes apply, note in the final PR: "AGENTS.md reviewed — no updates required."

Mark plan todo `agents-md-review` complete after this review.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM returns invalid JSON | Strict prompt + Pydantic validation; retry once; then `failed` with reason |
| Embedding dimension mismatch | Assert `len == 1536` before insert; document in database-design §9 |
| Job stuck at `enriching` | Gate 3 asserts `complete` only when no films remain in `enriching` |
| `review_required` films block job completion | Document: job completes when all non-review films terminal; review films excluded from `total` processed until resolved |
| Rate limits (OpenAI 429) | Reuse `http_retry` patterns; inter-film delay; sequential processing |
| Phase 2 integration tests break | Update mocks first; run `verify-phase2.5-gates.sh` after each slice |
| Accept-review race | Background task uses dedicated DB session per film (same as import orchestrator) |
| Duplicate failure_summary entries | Single `mark_film_failed` helper; `sync_import_job_progress` dedupes from film rows |
| Ollama health false-negative | Health checks `OLLAMA_BASE_URL` config, not `OPENAI_API_KEY` |
| Token cost on 500-film import | Log token usage; use `gpt-4o-mini` default; batching deferred to future optimization |

---

## PRD Success Criteria Addressed

| # | Criterion | Verified by |
|---|-----------|-------------|
| 4 | Semantic enrichment generated and persisted | Gate 3 — `film_semantic_profiles` rows |
| 5 | Semantic profiles versioned | `semantic_version`, `generated_by_model`, `generated_at` |
| 6 | Film embeddings generated and stored | Gate 3 + Gate 6 — `film_embeddings` + HNSW |
| 12 | Recommendations only from `ready` films | Pipeline enforces `enriching → ready`; detail API hides profile until `ready` |
