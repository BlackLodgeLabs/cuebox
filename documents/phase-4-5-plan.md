---
name: Phase 4 & 5 — Watchlist Sync + Recommendation Engine
overview: "Implement Phase 4 (CSV/RSS watchlist synchronisation, film lifecycle) and Phase 5 (six-stage recommendation pipeline with profile caching, persistence, and REST endpoints) in parallel after Phase 3 — each with verification gates, roadmap checkbox updates, and AGENTS.md structural review."
depends_on: Phase 3 (complete)
parallel_tracks:
  - phase-4-sync
  - phase-5-recommendations
todos:
  # ── Phase 4 — Watchlist Synchronisation ──────────────────────────────────
  - id: p4-migration-sync-config
    content: "Alembic 0003 — sync_config single-row table (username, poll metadata, configured_at)"
    status: pending
  - id: p4-sync-repositories
    content: "sync_config_repository, watchlist_repository extensions (deactivate, list active, count), film_repository lifecycle helpers (archive, watch, restore)"
    status: pending
  - id: p4-csv-diff
    content: "sync_service.csv_diff — diff parsed CSV vs active watchlist; classify added/removed/watched/unchanged"
    status: pending
  - id: p4-csv-endpoint
    content: "POST /sync/csv — multipart upload, post-sync ≤500 check, apply diff, schedule enrichment for new films"
    status: pending
  - id: p4-rss-parser
    content: "rss_parser.py — fetch and parse Letterboxd RSS; map entries to watchlist_add | watchlist_remove | watched"
    status: pending
  - id: p4-rss-ledger
    content: "Idempotent rss_sync_events ledger — dedupe by event fingerprint; apply events via sync_service"
    status: pending
  - id: p4-rss-endpoints
    content: "PUT /sync/rss and GET /sync/rss/status per api-contracts §6.2–6.3"
    status: pending
  - id: p4-scheduler
    content: "APScheduler job — poll RSS every 900s; wire in FastAPI lifespan; update last_polled_at / last_poll_status"
    status: pending
  - id: p4-film-lifecycle
    content: "Enforce active | watched | archived transitions; re-add archived → active without re-enrichment when ready"
    status: pending
  - id: p4-unit-tests
    content: "Unit tests — CSV diff scenarios, RSS parser fixtures, username validation, lifecycle guards"
    status: pending
  - id: p4-integration-tests
    content: "Integration tests — CSV sync add/remove/watch/re-add-archived; RSS idempotency; watched excluded from candidates query"
    status: pending
  - id: p4-verify-gates
    content: "Run scripts/verify-phase4-gates.sh; confirm Phase 2.5 + Phase 3 regression scripts still pass"
    status: pending
  - id: p4-update-roadmap
    content: "Check off Phase 4 task checklist and verification gate in documents/roadmap.md"
    status: pending
  # ── Phase 5 — Recommendation Engine ──────────────────────────────────────
  - id: p5-questionnaire-schemas
    content: "Pydantic schemas — questionnaire enums, NO_PREFERENCE_CONFLICT validation, request/response per api-contracts §7–8"
    status: pending
  - id: p5-profile-canonicalization
    content: "Profile canonicalization + SHA-256 hash; structured_profile and narrative_profile builders"
    status: pending
  - id: p5-profile-service
    content: "recommendation_profile_service — cache lookup/insert, profile embedding via EmbeddingProvider"
    status: pending
  - id: p5-ranking-provider
    content: "RankingProvider ABC + OpenAI implementation; extend ProviderService; ranking prompt template"
    status: pending
  - id: p5-constraint-filter
    content: "Stage 1 — hard constraint filtering (watched/archived/not-ready, runtime, subtitle proxy) + relaxation JSONB"
    status: pending
  - id: p5-vector-retrieval
    content: "Stage 2 — pgvector cosine similarity retrieval with retrieval_candidate_limit"
    status: pending
  - id: p5-scoring-service
    content: "Stage 3 — scoring_service with configurable weights from config.yaml"
    status: pending
  - id: p5-diversity-service
    content: "Stage 4 — diversity_service using recommendation_exposure counters"
    status: pending
  - id: p5-stochastic-selection
    content: "Stage 5 — weighted stochastic selection among similarly scored candidates"
    status: pending
  - id: p5-ranking-service
    content: "Stage 6 — ranking_service LLM call; winner + 4 runners-up with structured explanations"
    status: pending
  - id: p5-persistence
    content: "Persist recommendation_sessions, candidates, results, exposure counters with full version metadata"
    status: pending
  - id: p5-endpoints
    content: "POST /recommendations, GET /recommendations/{session_id}, GET /recommendations (history list)"
    status: pending
  - id: p5-repositories
    content: "recommendation_profile/session/candidate/result/exposure repositories"
    status: pending
  - id: p5-unit-tests
    content: "Unit tests — canonicalization/hash, scoring signals, constraint relaxation, questionnaire validation"
    status: pending
  - id: p5-integration-tests
    content: "Integration tests — E2E recommend, profile cache hit, INSUFFICIENT_CANDIDATES, history list/detail"
    status: pending
  - id: p5-verify-gates
    content: "Run scripts/verify-phase5-gates.sh; confirm Phase 2.5 + Phase 3 regression scripts still pass"
    status: pending
  - id: p5-update-roadmap
    content: "Check off Phase 5 task checklist and verification gate in documents/roadmap.md"
    status: pending
  # ── Cross-cutting (after both tracks) ──────────────────────────────────────
  - id: combined-regression
    content: "Run verify-phase2.5-gates.sh + verify-phase3-gates.sh + verify-phase4-gates.sh + verify-phase5-gates.sh"
    status: pending
  - id: final-roadmap-overview
    content: "Update roadmap overview — Phase 4 & 5 complete; next up Phase 6 Frontend"
    status: pending
  - id: agents-md-review
    content: "Review AGENTS.md for structural changes (compose, env vars, lint/test, bootstrap, scheduler)"
    status: pending
isProject: false
---

# Phase 4 & 5 — Watchlist Sync + Recommendation Engine

## Context

**Phase 3 is complete.** Films progress through metadata, semantic enrichment, and embedding generation to `enrichment_status = ready`. Import job counters count only terminal states (`ready` + `failed`). CI (`api-ci.yml`), Phase 2.5 regression gates, and `scripts/verify-phase3-gates.sh` are green.

**This plan covers two parallel backend tracks** that both depend on Phase 3 but not on each other:

| Track | Goal | Unblocks |
|-------|------|----------|
| **Phase 4** | Keep local watchlist aligned with Letterboxd (CSV diff + RSS polling); enforce `active` / `watched` / `archived` lifecycle | Phase 6 sync settings UI; PRD criteria 15, 20, 21 |
| **Phase 5** | Six-stage synchronous recommendation pipeline with profile caching, full audit trail, and history endpoints | Phase 6 questionnaire/results/history UI; PRD criteria 7–14, 17–19, 23–24 |

Phase 6 (Frontend MVP) requires **both** tracks complete.

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 4 & 5 task checklists + verification gates |
| [`documents/phase-3-plan.md`](./phase-3-plan.md) | Gate script pattern, roadmap update procedure, AGENTS.md review template |
| [`documents/api-contracts.md`](./api-contracts.md) | §6 Sync, §7–8 Recommendations |
| [`documents/Architecture.md`](./Architecture.md) | §15 Recommendation pipeline, §18 Sync strategy, §16 Scoring |
| [`documents/database-design.md`](./database-design.md) | `rss_sync_events`, recommendation tables, `v_recommendation_candidates_detail` |
| [`documents/sequence-diagrams.md`](./sequence-diagrams.md) | §5–§9 flows |
| [`scripts/verify-phase3-gates.sh`](../scripts/verify-phase3-gates.sh) | Baseline regression (must stay green) |

### Current scaffold state

| Path | State |
|------|-------|
| `api/app/routers/v1/` | `health`, `imports`, `films`, `reviews` only — no `sync` or `recommendations` |
| `api/app/services/` | Import, metadata, semantic, embedding, enrichment pipeline — no sync or recommendation services |
| `api/app/repositories/watchlist_repository.py` | `ensure_active_entry` only — no deactivate/list-active |
| `api/app/services/csv_parser.py` | Shared CSV validation (reuse for sync) |
| `api/app/database/models.py` | `rss_sync_events`, all recommendation ORM models exist; **no `sync_config` table** |
| `api/app/services/provider_service.py` | TMDB, OMDb, semantic, embedding — **no ranking provider** |
| `api/pyproject.toml` | No `apscheduler` dependency |
| `api/app/main.py` | Lifespan starts ProviderService only — **no scheduler** |
| `config.example.yaml` | `scoring` weights + `recommendation.retrieval_candidate_limit` present |
| Recommendation integration tests | None |

### Parallel execution model

```mermaid
flowchart TB
    P3[Phase 3 complete] --> P4[Track A — Phase 4 Sync]
    P3 --> P5[Track B — Phase 5 Recommendations]
    P4 --> P4G[verify-phase4-gates.sh]
    P5 --> P5G[verify-phase5-gates.sh]
    P4G --> COMB[Combined regression + roadmap final pass]
    P5G --> COMB
    COMB --> AGENTS[AGENTS.md review]
    AGENTS --> P6[Phase 6 Frontend]
```

**Coordination rules:**

1. **Separate modules** — Phase 4 owns `sync_service`, `rss_parser`, `scheduler`, `routers/v1/sync.py`. Phase 5 owns `recommendation_*` services, `routers/v1/recommendations.py`. Minimise shared-file conflicts.
2. **Shared touchpoints** — coordinate if both tracks edit `main.py` (lifespan), `pyproject.toml`, or `routers/v1/__init__.py`. Prefer: Phase 4 adds scheduler to lifespan; Phase 5 adds ranking to ProviderService — merge in either order.
3. **Migrations** — use separate Alembic revisions (`0003_sync_config`, `0004_*` only if Phase 5 needs schema changes; recommendation tables already exist from Phase 1).
4. **Regression** — after **each** slice on either track, run `bash scripts/verify-phase2.5-gates.sh` and `bash scripts/verify-phase3-gates.sh`.
5. **Roadmap** — check off items incrementally per track; final overview update only when **both** tracks pass all gates.

---

## Track A — Phase 4: Watchlist Synchronisation

See [roadmap Phase 4](./roadmap.md#phase-4--watchlist-synchronisation) and [sequence-diagrams §5–§6](./sequence-diagrams.md).

### Step 1 — Database migration (`sync_config`)

Add Alembic revision `0003_sync_config`:

```sql
CREATE TABLE sync_config (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rss_username            TEXT,
    configured_at           TIMESTAMPTZ,
    last_polled_at          TIMESTAMPTZ,
    last_poll_status        TEXT,  -- 'success' | 'error'
    events_processed_last_poll INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Single-row pattern: application always reads/writes the row with fixed id or `LIMIT 1`. Add `set_updated_at` trigger. Add SQLAlchemy model + `sync_config_repository`.

rss_sync_events already exists (Phase 1) — no schema change needed if using deterministic UUIDs (e.g., UUIDv5) for the id primary key as the event fingerprint.

### Step 2 — Repository extensions

| Repository | New helpers |
|------------|-------------|
| `watchlist_repository` | `list_active_entries`, `deactivate_entry` (set `active=false`, `removed_at`), `count_active` |
| `film_repository` | `archive_film`, `mark_watched`, `restore_active` (status → active; skip enrichment if `enrichment_status=ready`) |
| `rss_sync_repository` | `event_exists(fingerprint)`, `create_event`, `mark_processed` |
| `sync_config_repository` | `get_config`, `upsert_rss_username`, `update_poll_status` |

### Step 3 — CSV diff logic (`sync_service.py`)

Reuse `parse_watchlist_csv` from `csv_parser.py`.

**Diff algorithm:**

1. Load all active `watchlist_entries` joined with `films` → `current_by_uri`.
2. Build `csv_by_uri` from parsed rows.
3. **Added:** URI in CSV, not in `current_by_uri` (or film exists as `archived` → restore).
4. **Unchanged:** URI in both; film `status=active`, entry `active=true`.
5. **Removed from CSV:** URI in `current_by_uri`, not in CSV → classify:
   - If a `watched` RSS event exists for URI (since film was added) → **watched**
   - Else → **removed** (archive)
6. **Post-sync size check:** `count_active + len(added) - len(removed) - len(watched) ≤ 500` (or equivalent) before applying; else `WATCHLIST_SIZE_EXCEEDED`.

**Apply changes:**

| Change | DB actions | Enrichment |
|--------|------------|------------|
| Added (new film) | INSERT `films` + `watchlist_entries`; schedule metadata+semantic pipeline | Yes |
| Added (restore archived) | `restore_active`; `ensure_active_entry`; skip pipeline if `ready` | Only if not `ready` |
| Removed | `deactivate_entry`; `archive_film` | No |
| Watched | `deactivate_entry`; `mark_watched` | No |

Extract shared enrichment scheduling from `ImportService` (call `run_import_enrichment` for a single film or a thin `schedule_enrichment_for_film` wrapper).

### Step 4 — Sync router (`routers/v1/sync.py`)

| Endpoint | Notes |
|----------|-------|
| `POST /sync/csv` | `UploadFile`; return `SyncCsvResponse` per api-contracts §6.1 |
| `PUT /sync/rss` | Validate username regex `^[a-zA-Z0-9_-]{1,50}$`; upsert `sync_config` |
| `GET /sync/rss/status` | Return configured flag, username, polling interval (900), poll metadata |

Register router in `routers/v1/__init__.py`.

### Step 5 — RSS parser (`rss_parser.py`)

- Fetch watchlist feed https://letterboxd.com/{username}/watchlist/rss/ and diary feed https://letterboxd.com/{username}/rss/.
- Parse XML; diff watchlist feed for additions/removals, and map diary entries to watched events.
- Build stable event fingerprint: SHA-256 hash (e.g., using hashlib) of (event_type + letterboxd_uri + event_timestamp) for idempotency.
- Defensive parsing — log malformed entries; do not crash poll job.

Use mocked HTTP fixtures in tests (no live Letterboxd calls in CI).

### Step 6 — Scheduler (`scheduler.py` + lifespan)

- Add `apscheduler` to `api/pyproject.toml`.
- `AsyncIOScheduler` with interval job every **900 seconds**.
- Job: `sync_service.poll_rss()` — fetch feed, insert new ledger events, apply unprocessed events, update `sync_config` poll metadata.
- Start scheduler in `main.py` lifespan **only when** `sync_config.rss_username` is set (or always run but no-op when unconfigured).
- Shutdown scheduler on app teardown.

### Step 7 — Tests

| File | Covers |
|------|--------|
| `test_csv_sync_diff.py` | Unit — added, removed, watched, unchanged, re-add archived |
| `test_rss_parser.py` | Unit — fixture XML → typed events |
| `test_sync_username_validation.py` | Unit — regex edge cases |
| `test_integration_csv_sync.py` | DB — full CSV sync scenarios |
| `test_integration_rss_sync.py` | DB — idempotent event processing |
| `test_watched_excluded_from_candidates.py` | DB — query helper used by Phase 5 Stage 1 (can live in Phase 5 if needed) |

### Phase 4 — Roadmap checkbox mapping

| Todo ID | Roadmap items |
|---------|---------------|
| `p4-csv-endpoint` | Manual CSV Sync — `POST /sync/csv` (all bullets) |
| `p4-migration-sync-config` + `p4-rss-endpoints` | RSS Sync — `sync_config`, `PUT /sync/rss`, `GET /sync/rss/status` |
| `p4-rss-parser` + `p4-rss-ledger` + `p4-scheduler` | RSS parser, APScheduler, idempotent ledger |
| `p4-film-lifecycle` | Film Lifecycle — all four bullets |
| `p4-verify-gates` | Verification Gate — all five checkboxes |

---

## Track B — Phase 5: Recommendation Engine

See [roadmap Phase 5](./roadmap.md#phase-5--recommendation-engine), [Architecture §15](./Architecture.md), [api-contracts §7–8](./api-contracts.md).

### Step 1 — Schemas and validation

`api/app/schemas/recommendations.py`:

- `QuestionnaireRequest` with all enum fields from api-contracts Appendix C.
- `NO_PREFERENCE_CONFLICT` validator for `genres`, `emotional_outcomes`, `visual_tonal_vibes`.
- `CreateRecommendationResponse`, `RecommendationSessionDetail`, `RecommendationHistoryListResponse`.
- `Explanation`, `ConstraintRelaxation` nested models.

### Step 2 — Profile service (`recommendation_profile_service.py`)

Per [sequence-diagrams §7](./sequence-diagrams.md):

1. Transform questionnaire → `structured_profile` (normalised field names per DB).
2. Build `narrative_profile` — LLM interpretation of `notes` + structured fields (or template fallback when no ranking key).
3. **Canonicalize:** sort arrays, lowercase/trim strings, remove nulls, sort object keys recursively.
4. `profile_hash = sha256(json.dumps(canonical, sort_keys=True))`.
5. Lookup `recommendation_profiles` by hash → return cached embedding + `profile_cache_hit: true`.
6. On miss: generate profile embedding via `EmbeddingProvider.embed_text(narrative + structured summary)`; INSERT profile row.

Profile embeddings use same model/dimension as film embeddings (1536-dim).

### Step 3 — Ranking provider

`api/app/providers/ranking/`:

- `base.py` — `RankingProvider` ABC: `rank(profile, candidates, scores) → RankingResult`.
- `openai.py` — structured JSON output (winner + 4 runners-up + explanations).
- `api/app/prompts/ranking.py` — versioned prompt (`recommendation-v1` from `system_versions`).
- Extend `ProviderService.get_ranking()` mirroring semantic/embedding pattern.

### Step 4 — Six-stage pipeline (`recommendation_service.py`)

Orchestrate synchronously inside `POST /recommendations` request (target < 30s):

| Stage | Service | Key behaviour |
|-------|---------|---------------|
| 1 | `recommendation_service` | Filter: `status=active`, `enrichment_status=ready`; runtime ceiling; subtitle proxy (`original_language != 'en'` when `subtitle_preference=no`); relaxation if `< min_candidates` |
| 2 | `recommendation_service` + raw SQL / pgvector | Cosine distance on `film_embeddings` vs profile embedding; top `retrieval_candidate_limit`; record `retrieval_rank`, `similarity_score` |
| 3 | `scoring_service` | Weighted signals from `config.scoring`; persist `score_breakdown` JSONB |
| 4 | `diversity_service` | Load `recommendation_exposure`; penalties + freshness bonuses → `final_score` |
| 5 | `recommendation_service` | Weighted random among candidates within score band; promote diversity-adjusted |
| 6 | `ranking_service` | LLM rank + explanations; may reorder; cap candidates sent to LLM (e.g. top 20) |

**Version metadata** on session insert — read active rows from `system_versions` for `semantic_version`, `embedding_version`, `scoring_version`, `prompt_version`, `weight_set`.

### Step 5 — Persistence

Insert in one transaction:

1. `recommendation_sessions` — `profile_id`, `winner_film_id`, versions, `constraint_relaxation`.
2. `recommendation_candidates` — all observability fields per candidate.
3. `recommendation_results` — winner + runner-up explanation JSONB.
4. `recommendation_exposure` — upsert counters for all candidates; increment winner.

### Step 6 — Endpoints (`routers/v1/recommendations.py`)

| Endpoint | Behaviour |
|----------|-----------|
| `POST /recommendations` | Validate questionnaire → run pipeline → return creation response (no `profile_summary`) |
| `GET /recommendations/{session_id}` | Full detail + `profile_summary` |
| `GET /recommendations` | Paginated history with `search`, `date_from`, `date_to`, `watch_status` filters |

Return `INSUFFICIENT_CANDIDATES` (422) when Stage 1 yields zero candidates after relaxation.

### Step 7 — Tests

| File | Covers |
|------|--------|
| `test_profile_canonicalization.py` | Hash stability, array sort, No Preference alone |
| `test_questionnaire_validation.py` | `NO_PREFERENCE_CONFLICT`, enum validation |
| `test_scoring_service.py` | Individual signal calculations with fixture profiles |
| `test_constraint_relaxation.py` | Runtime + language relaxation JSONB shape |
| `test_diversity_service.py` | Exposure penalty math |
| `test_integration_recommendation.py` | E2E with seeded ready films + mocked ranking |
| `test_integration_profile_cache.py` | Identical questionnaire → `profile_cache_hit: true` |
| `test_integration_recommendation_history.py` | List + detail endpoints |

Mock ranking/embedding HTTP in CI (same pattern as Phase 3 semantic mocks).

### Phase 5 — Roadmap checkbox mapping

| Todo ID | Roadmap items |
|---------|---------------|
| `p5-profile-canonicalization` + `p5-profile-service` | Recommendation Profile Service (all bullets) |
| `p5-constraint-filter` | Stage 1 |
| `p5-vector-retrieval` | Stage 2 |
| `p5-scoring-service` | Stage 3 |
| `p5-diversity-service` | Stage 4 |
| `p5-stochastic-selection` | Stage 5 |
| `p5-ranking-service` + `p5-ranking-provider` | Stage 6 |
| `p5-persistence` + `p5-endpoints` | Persistence & Endpoints (all bullets) |
| `p5-questionnaire-schemas` | Validation — `NO_PREFERENCE_CONFLICT`, `INSUFFICIENT_CANDIDATES` |
| `p5-verify-gates` | Verification Gate — all six checkboxes |

---

## Verification Gates

All gates must pass before marking the corresponding phase complete. Run locally during development; re-run the full combined set before the final roadmap overview update.

### Prerequisites (both gate scripts)

```bash
cp config.example.yaml config.yaml   # if missing
cp .env.example .env                 # if missing
# Postgres on localhost:5432 (gate scripts start pgvector container if needed)
```

### Phase 4 gate script — `scripts/verify-phase4-gates.sh`

Create this script in the **4e** slice (final Phase 4 PR). Structure mirrors `verify-phase3-gates.sh`:

| Gate | Check |
|------|-------|
| **Gate 1** | Unit — `test_csv_sync_diff.py`, `test_rss_parser.py`, `test_sync_username_validation.py` (no DB) |
| **Gate 2** | Integration — `test_integration_csv_sync.py` (add, remove, watch, re-add archived, 500 limit) |
| **Gate 3** | Integration — `test_integration_rss_sync.py` (idempotent events, no duplicate processing) |
| **Gate 4** | Integration — archived film retains `film_metadata` + `film_semantic_profiles` after sync remove |
| **Gate 5** | Integration — watched film excluded from active watchlist count / candidate eligibility query |
| **Gate 6** | `GET /sync/rss/status` returns poll metadata after mocked poll |
| **Gate 7** | `ruff check app tests` |
| **Gate 8** | Regression test names present in `pytest --collect-only` |

### Phase 5 gate script — `scripts/verify-phase5-gates.sh`

Create in the **5e** slice (final Phase 5 PR):

| Gate | Check |
|------|-------|
| **Gate 1** | Unit — `test_profile_canonicalization.py`, `test_questionnaire_validation.py`, `test_scoring_service.py`, `test_constraint_relaxation.py` (no DB) |
| **Gate 2** | Integration — `test_integration_recommendation.py` (winner + runners-up, explanations populated) |
| **Gate 3** | Integration — `test_integration_profile_cache.py` (`profile_cache_hit: true` on second identical request) |
| **Gate 4** | Integration — all `recommendation_candidates` observability fields non-null for seeded session |
| **Gate 5** | Integration — `constraint_relaxation` recorded when runtime filter relaxed |
| **Gate 6** | Integration — `test_integration_recommendation_history.py` (list filters + detail `profile_summary`) |
| **Gate 7** | Integration — `INSUFFICIENT_CANDIDATES` when no ready films |
| **Gate 8** | Timing smoke — single recommendation completes in < 30s with mocks (no live LLM) |
| **Gate 9** | `ruff check app tests` |
| **Gate 10** | Regression test names present in `pytest --collect-only` |

### Combined regression (both phases complete)

```bash
bash scripts/verify-phase2.5-gates.sh
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase5-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/ -v
```

Confirm GitHub Actions `.github/workflows/api-ci.yml` passes on push.

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** per track. Do not mark verification gates complete before the corresponding gate script passes.

### During implementation (per slice)

1. Complete slice work and run slice gate(s).
2. Mark matching Phase 4 or Phase 5 **Task Checklist** items `- [x]` using the [checkbox mappings](#phase-4--roadmap-checkbox-mapping) above.
3. Commit: `phase-4: <slice>` or `phase-5: <slice> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.

### Per-track final pass

**Phase 4 complete** (`p4-update-roadmap`):

1. Mark all Phase 4 Task Checklist and Verification Gate checkboxes.
2. Mark all Phase 4 plan frontmatter todos `completed`.
3. Commit: `phase-4: complete — roadmap and plan todos updated`.

**Phase 5 complete** (`p5-update-roadmap`):

1. Mark all Phase 5 Task Checklist and Verification Gate checkboxes.
2. Mark all Phase 5 plan frontmatter todos `completed`.
3. Commit: `phase-5: complete — roadmap and plan todos updated`.

### Combined final pass (`final-roadmap-overview`)

Only after **both** gate scripts and combined regression pass:

1. Update **Overview** (line ~11):

```markdown
**Current state:** Phases 4 and 5 complete. Watchlist sync (CSV + RSS) keeps film lifecycle aligned with Letterboxd; the six-stage recommendation engine serves POST/GET recommendations with full audit trail. Next up: Phase 6 — Frontend (MVP UX).
```

2. Add this plan to **Document Index** Phase plans row:

```markdown
| Phase plans | ... , [phase-4-5-plan.md](./phase-4-5-plan.md) |
```

3. Commit: `phase-4-5: complete — roadmap overview updated`.

### Commit discipline

- Prefix commits with `phase-4:` or `phase-5:` (or `phase-4-5:` for cross-cutting doc-only updates).
- Include roadmap checkbox updates in the same commit as the feature they document.
- Never mark verification gates complete before the gate script passes.

---

## AGENTS.md Review (final step)

After **both** phases pass all gates and the roadmap overview is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance.

### When to update AGENTS.md

| Change in Phase 4 or 5 | AGENTS.md section to update |
|------------------------|----------------------------|
| New compose service or port | **Running the stack** — service table, URL, port |
| New required env var | **First-time config** or **Gotchas** — document optional vs required |
| `apscheduler` / RSS polling in API process | **Running the stack** or **Gotchas** — note background scheduler starts with API |
| `scripts/verify-phase4-gates.sh` or `verify-phase5-gates.sh` added | **Lint and test** — add gate script rows |
| New standard test modules / pytest paths | **Lint and test** — update full suite or unit-test row |
| `config.example.yaml` new keys (e.g. `sync.*`, scoring tweaks) | **Gotchas** — agents must copy `config.example.yaml` |
| Ranking provider env (`OPENAI_API_KEY` for live recommendations) | **Gotchas** — clarify required for live rank vs mocked CI |
| ESLint added (incidental) | Replace `tsc --noEmit` note with `npm run lint` |
| Docker/bootstrap change (new migration, entrypoint change) | **Docker daemon** / **Running the stack** |
| Project overview phase statement | **Project overview** — "Through Phase 5: …" |

### Review checklist

Run through each item; update AGENTS.md only where repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged unless new services added to `docker-compose.yml`
- [ ] **Required env vars** — `OPENAI_API_KEY` needed for live ranking; CI/tests work without it (mocks)
- [ ] **Lint / test commands** — table includes `verify-phase4-gates.sh` and `verify-phase5-gates.sh`; note run order after Phase 3 script
- [ ] **Docker / bootstrap** — `alembic upgrade head` applies `0003_sync_config`; no compose topology change expected
- [ ] **New standard commands** — gate scripts, new pytest paths documented
- [ ] **Hello-world verification** — homepage still shows API/DB ok; new endpoints visible in OpenAPI docs at `/docs`
- [ ] **Cursor Cloud instructions** — still accurate for nested Docker / `fuse-overlayfs`
- [ ] **Project overview** — reflects Phase 4 & 5 capabilities (sync + recommendations)

If no structural changes apply, note in the final PR: "AGENTS.md reviewed — no updates required."

Mark plan todo `agents-md-review` complete after this review.

---

## Recommended PR Slicing

Tracks can land as **separate PRs** on the same branch or as parallel branches merged sequentially. Suggested slices:

### Phase 4 slices

| Slice | Contents | Gates |
|-------|----------|-------|
| **4a — Schema + repos** | Migration `0003_sync_config`, repositories, film lifecycle helpers | Unit tests for repos |
| **4b — CSV sync** | `sync_service` CSV diff, `POST /sync/csv`, enrichment scheduling | Gate 2 subset |
| **4c — RSS** | `rss_parser`, ledger, `PUT/GET /sync/rss` | Gates 1, 6 |
| **4d — Scheduler** | APScheduler, lifespan wiring, poll job | Gate 3 |
| **4e — Tests + gates** | Integration tests, `verify-phase4-gates.sh`, roadmap Phase 4 | All Phase 4 gates |

### Phase 5 slices

| Slice | Contents | Gates |
|-------|----------|-------|
| **5a — Schemas + profile** | Questionnaire schemas, canonicalization, profile service, repositories | Gate 1 subset |
| **5b — Ranking provider** | Ranking ABC, OpenAI provider, prompt, ProviderService extension | Gate 1 |
| **5c — Pipeline stages 1–3** | Constraint filter, pgvector retrieval, scoring service | Gate 2 subset |
| **5d — Pipeline stages 4–6** | Diversity, stochastic selection, ranking, persistence | Gates 2, 4, 5 |
| **5e — Endpoints + gates** | REST routers, history, integration tests, `verify-phase5-gates.sh`, roadmap Phase 5 | All Phase 5 gates |

### Merge order

Either track can merge first. Before marking the combined effort complete:

1. Rebase the second track on `main` after the first merges.
2. Run all four gate scripts + full `pytest`.
3. Final roadmap overview + AGENTS.md review.

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| Sync config migration | `api/alembic/versions/0003_sync_config.py` |
| Sync service | `api/app/services/sync_service.py` |
| RSS parser | `api/app/services/rss_parser.py` |
| Scheduler | `api/app/scheduler.py` |
| Sync router | `api/app/routers/v1/sync.py` |
| Profile service | `api/app/services/recommendation_profile_service.py` |
| Recommendation orchestrator | `api/app/services/recommendation_service.py` |
| Scoring / diversity / ranking | `api/app/services/scoring_service.py`, `diversity_service.py`, `ranking_service.py` |
| Ranking provider | `api/app/providers/ranking/` |
| Ranking prompt | `api/app/prompts/ranking.py` |
| Recommendation router | `api/app/routers/v1/recommendations.py` |
| Schemas | `api/app/schemas/sync.py`, `api/app/schemas/recommendations.py` |
| Repositories | `sync_config_repository`, `rss_sync_repository`, `recommendation_*_repository` |
| Gate scripts | `scripts/verify-phase4-gates.sh`, `scripts/verify-phase5-gates.sh` |
| Roadmap | `documents/roadmap.md` — Phases 4 & 5 checked off |
| Agent guidance | `AGENTS.md` — updated if structural changes apply |
| This plan | `documents/phase-4-5-plan.md` |

---

## Exit Criteria

Phases 4 & 5 are **done** when:

1. All track-specific todos in this plan frontmatter are `completed`
2. `bash scripts/verify-phase4-gates.sh` passes (all 8 gates)
3. `bash scripts/verify-phase5-gates.sh` passes (all 10 gates)
4. `bash scripts/verify-phase2.5-gates.sh` and `bash scripts/verify-phase3-gates.sh` still pass (regression)
5. `documents/roadmap.md` Phase 4 and Phase 5 checklists and Verification Gate sections are fully checked off
6. Roadmap overview reflects Phases 4 & 5 complete / Phase 6 next
7. `AGENTS.md` reviewed and updated if structural changes apply
8. GitHub Actions CI green on push
9. Changes committed, pushed, and PR ready for review (implementation PRs follow this plan)

---

## Risks & Mitigations

| Risk | Track | Mitigation |
|------|-------|------------|
| Letterboxd RSS format changes | 4 | Defensive parser; store raw `payload` JSONB; surface `last_poll_status: error` |
| CSV sync watched vs removed ambiguity | 4 | Cross-reference RSS `watched` events; document behaviour in sync_service docstring |
| pgvector query performance | 5 | HNSW index exists; limit retrieval; set `ef_search` if needed per database-design §9 |
| LLM ranking exceeds 30s | 5 | Cap candidates sent to ranker; use fast model (`gpt-4o-mini` option); mock in tests |
| Parallel PR merge conflicts | both | Separate modules; coordinate `main.py` / `pyproject.toml` edits |
| Phase 3 regression | both | Run `verify-phase3-gates.sh` after every slice |
| `INSUFFICIENT_CANDIDATES` on small fixtures | 5 | Seed ≥5 ready films in integration fixtures |
| APScheduler double-start on reload | 4 | Guard scheduler init in lifespan; use `max_instances=1` |

---

## PRD Success Criteria Addressed

| # | Criterion | Track | Verified by |
|---|-----------|-------|-------------|
| 7 | Recommendation profiles independent of sessions | 5 | Gate 3 — profile row created before session |
| 8 | Sessions reference `profile_id` | 5 | Gate 2 — session FK |
| 9 | Profile embeddings cached by hash | 5 | Gate 3 — `profile_cache_hit` |
| 10 | Vector similarity retrieval | 5 | Gate 4 — `similarity_score`, `retrieval_rank` |
| 11 | Retrieval traces stored | 5 | Gate 4 — `recommendation_candidates` rows |
| 12 | Recommendations from `ready` films only | 5 | Gate 2 + Stage 1 filter |
| 13 | Subtitle proxy via `original_language` | 5 | Gate 5 — relaxation tests |
| 14 | Auditable history | 5 | Gate 6 — history endpoints |
| 15 | RSS sync updates watchlist | 4 | Gate 3 |
| 17 | Recommendation < 30s | 5 | Gate 8 |
| 18 | Winner + 4 runners-up | 5 | Gate 2 |
| 19 | Explainable decisions | 5 | Gate 2 — explanation objects |
| 20 | Archived films retain metadata | 4 | Gate 4 |
| 21 | Watched films excluded | 4, 5 | Gates 5 (4), Stage 1 (5) |
| 23 | Constraint relaxation JSONB | 5 | Gate 5 |
| 24 | Variety via diversity + stochastic | 5 | Gates 2, 4 — diversity fields populated |
