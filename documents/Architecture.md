# Film Picker Technical Architecture

Version 3.1 (Implementation Baseline)

---

## 1. Overview

Film Picker is a locally hosted, single-user recommendation application that helps users choose films from their existing Letterboxd watchlist.

The application does not discover new films.

All recommendations must originate exclusively from films contained within the user's active Letterboxd watchlist.

The primary objective is to reduce decision paralysis through a combination of:

- Metadata enrichment
- Semantic enrichment
- Embedding-based retrieval
- Structured scoring
- Diversity-aware selection
- LLM-assisted ranking

The system should behave like a trusted film-loving friend rather than a deterministic search engine.

---

## 2. Goals

### Functional Goals

- Import Letterboxd watchlists
- Synchronize watchlist changes
- Enrich films with metadata
- Enrich films with semantic understanding
- Generate recommendations
- Store recommendation history
- Explain recommendations
- Provide developer observability

### Non-Functional Goals

- Local-first deployment
- Single-user operation
- Provider independence
- Full recommendation auditability
- Explainable recommendation pipeline
- Fast recommendation generation (<30s)

---

## 3. Architectural Principles

### Semantic-First Recommendation

Recommendations are driven primarily by semantic understanding rather than genre matching.

The system should understand themes, emotional outcomes, tone, visual style, complexity, pacing, and viewing context as first-class recommendation signals.

---

### Enrich Once, Reuse Many Times

Film enrichment is generated once and persisted indefinitely. Recommendation generation should never depend on repeated enrichment.

---

### Auditability Over Reproducibility

The system should retain sufficient information to understand how recommendations were generated, even if providers, prompts, or models evolve.

---

### Provider Independence

Embedding generation, semantic enrichment, and ranking are independent subsystems. Providers are configured via `config.yaml` and must be replaceable without application code changes.

---

### Letterboxd As Source Of Truth

Letterboxd remains authoritative for watchlist state and watched status. Local storage acts as an enrichment and recommendation layer.

---

## 4. High-Level Architecture

```
┌──────────────────────────────────────────────┐
│                 Browser UI                   │
│            Next.js + TypeScript              │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│                 FastAPI API                  │
│                                              │
│ Import Service                               │
│ Metadata Service                             │
│ Semantic Enrichment Service                  │
│ Recommendation Profile Service               │
│ Recommendation Service                       │
│ Sync Service                                 │
│ Provider Service                             │
│ Developer Mode Service                       │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│                 PostgreSQL                   │
│                 + pgvector                   │
└──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│                 Scheduler                    │
│                                              │
│ APScheduler                                  │
│ FastAPI Background Tasks                     │
└──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│ External Providers                           │
│                                              │
│ TMDB                                         │
│ OMDb                                         │
│ Letterboxd RSS                               │
│ Embedding Provider                           │
│ Semantic Enrichment Provider                 │
│ Ranking Provider                             │
└──────────────────────────────────────────────┘
```

---

## 5. Technology Stack

**Frontend:** Next.js, TypeScript, React Query, TailwindCSS, shadcn/ui

**Backend:** FastAPI, Pydantic, SQLAlchemy

**Database:** PostgreSQL 16+, pgvector

**Scheduling:** APScheduler, FastAPI Background Tasks

**Deployment:** Docker Compose

Services: `frontend`, `api`, `postgres`

---

## 6. Provider Architecture

All provider configuration is managed via a `config.yaml` file mounted into the API container. This file specifies the active provider per role, model selection, API keys, and any provider-specific parameters.

API keys must not be committed to version control. The expected `config.yaml` path should be documented and excluded from the repository.

The Provider Service reads this file at startup and exposes the resolved provider instances to all dependent services.

---

### Embedding Provider

Responsibilities: film embeddings, recommendation profile embeddings.

Examples: OpenAI, Voyage AI, local embedding models.

---

### Semantic Enrichment Provider

Responsibilities: theme extraction, tone analysis, emotional analysis, semantic profiling.

Examples: OpenAI, Ollama, LM Studio.

---

### Ranking Provider

Responsibilities: candidate ranking, recommendation explanations.

Examples: OpenAI, Claude, OpenRouter, Ollama.

---

## 7. Import & Enrichment Pipeline

```
Letterboxd CSV
       ↓
Validation
       ↓
Import Job Created (job ID returned immediately)
       ↓
Film Records Created (status: pending)
       ↓         [async background task begins]
Metadata Matching
       ↓
TMDB Retrieval
       ↓
OMDb Supplementation
       ↓
Semantic Enrichment
       ↓
Embedding Generation
       ↓
Film status → ready
```

Import returns immediately with a job ID. All enrichment stages run asynchronously via FastAPI Background Tasks. Progress is exposed via `/import/{job_id}/status`.

There is no fixed time SLA on enrichment. Progress is poll-visible per film and per job.

---

### Film Enrichment Status

Every `films` record carries an `enrichment_status` field:

| Status | Description |
|---|---|
| `pending` | Awaiting metadata matching |
| `matching` | Metadata lookup in progress |
| `review_required` | Low-confidence match; user action needed |
| `enriching` | Semantic enrichment and embedding in progress |
| `ready` | Fully enriched; eligible for recommendations |
| `failed` | Enrichment failed; retryable |

Films are excluded from all recommendation stages unless `enrichment_status = ready`.

---

## 8. Metadata Enrichment Strategy

### Stored Metadata

**Identification:** TMDB ID, IMDB ID, Letterboxd URI

**Core:** Title, Original Title, Runtime, Release Year, Synopsis

**Classification:** Genres (JSONB), Keywords (JSONB), Original Language, Country

**Crew:** Director

**Ratings:** TMDB Rating, Rotten Tomatoes Score, Letterboxd Rating

**Assets:** Poster URL, Backdrop URL

---

## 9. Subtitle Handling

Subtitle preference is captured in the questionnaire with options: **Yes / No / No preference**.

Because per-film subtitle availability is not reliably exposed by TMDB, `original_language` is used as a proxy. Films with a non-English `original_language` are treated as requiring subtitles.

When the user selects **No**: films with a non-English `original_language` are excluded during Stage 1 hard constraint filtering.

When the user selects **Yes** or **No preference**: no language-based filtering is applied.

This is a documented approximation. English-language films with optional subtitles and dubbed foreign-language films are out of scope.

---

## 10. Semantic Enrichment Strategy

Semantic enrichment is a first-class architectural subsystem. Generated once per film. Persisted indefinitely.

### Generated Signals

**Subgenres (0..n):** e.g. Folk Horror, Psychological Horror, Neo-Noir

**Themes (0..n):** e.g. Identity, Obsession, Isolation

**Tones (0..n):** e.g. Bleak, Surreal, Hopeful

**Visual Descriptors (0..n):** e.g. Atmospheric, Gritty, Dreamlike

**Emotional Outcomes (0..n):** e.g. Inspired, Disturbed, Comforted

**Viewing Contexts (0..n):** e.g. Solo Viewing, Group Viewing

**Structured Ratings:** Complexity, Pacing, Energy, Obscurity

**Semantic Summary:** short natural-language description used for embedding generation.

---

## 11. Semantic Profile Versioning

Every enrichment record stores:

- `semantic_version`
- `generated_by_model`
- `generated_at`

This enables future re-enrichment without losing provenance.

---

## 12. Embedding Strategy

### Film Embeddings

Generated once per film.

Input: Synopsis, Genres, Keywords, Semantic profile, Semantic summary.

Stored indefinitely.

---

### Multi-Embedding Support

The architecture supports multiple embedding types: `semantic`, `synopsis`, `themes`.

Initial implementation uses `semantic` only.

---

## 13. Recommendation Profile Service

The Recommendation Profile Service is the canonical representation of user intent.

The recommendation engine never directly consumes questionnaire answers. It consumes recommendation profiles.

**Recommendation profiles are created independently of sessions.** A session references a profile via `profile_id`. This supports profile reuse — if a user submits identical questionnaire answers, the existing profile and its cached embedding are reused without generating a new embedding call.

### Responsibilities

- Transform questionnaire responses
- Interpret free-text notes
- Build recommendation profiles
- Generate recommendation embeddings

---

### Structured Profile

```json
{
  "genres": ["horror"],
  "subgenres": ["folk horror"],
  "pacing": "slow",
  "desired_emotions": ["unsettled"]
}
```

### Narrative Profile

> "Slow-burn atmospheric folk horror with immersive visuals, emotional unease and strong tension."

---

## 14. Recommendation Profile Caching

Recommendation profiles are canonicalized before hashing.

Normalization rules:
- Sort arrays
- Remove empty values and nulls
- Normalize case and whitespace
- Sort object keys recursively

```
Questionnaire Responses
        ↓
Canonicalization
        ↓
SHA-256 Hash
        ↓
Cache Lookup
        ↓
Embedding Generation (if miss)
        ↓
Profile Persisted
        ↓
Session created with profile_id FK
```

---

## 15. Recommendation Pipeline

### Stage 1: Hard Constraint Filtering

Remove:

- Watched films
- Archived films
- Films where `enrichment_status != ready`
- Runtime violations
- Language/subtitle violations (non-English `original_language` when subtitle preference is "No")

If too few candidates survive filtering, constraints may be relaxed. Any relaxation is recorded in `constraint_relaxation` on the session as a JSONB object.

Example:

```json
{
  "runtime_minutes": { "original": 90, "relaxed_to": 120 },
  "original_language": { "relaxed": true }
}
```

---

### Stage 2: Semantic Retrieval

Generate recommendation embedding. Perform vector similarity search. Candidate count is configurable.

```yaml
recommendation:
  retrieval_candidate_limit: 100
```

---

### Stage 3: Structured Scoring

Signals: theme fit, emotional fit, pacing fit, complexity fit, era fit, obscurity fit, viewing context fit, recommendation history.

---

### Stage 4: Diversity Adjustment

Inputs: recommendation count, winner count, last recommendation date.

Apply exposure penalties and freshness bonuses.

---

### Stage 5: Controlled Stochastic Selection

Among similarly scored candidates, weighted selection is permitted and diversity-adjusted candidates may be promoted. This prevents recommendation stagnation.

---

### Stage 6: LLM Ranking

Input: recommendation profile, candidate metadata, semantic enrichment, candidate scores.

Output: winner, four runners-up, explanations, trade-offs.

---

## 16. Scoring Configuration

Scoring weights are configuration-driven.

```yaml
scoring:
  theme_fit: 0.25
  emotional_fit: 0.20
  pacing_fit: 0.15
  complexity_fit: 0.10
  era_fit: 0.10
  obscurity_fit: 0.05
  viewing_context_fit: 0.05
  diversity_adjustment: 0.10
```

Stored with every session as `scoring_version` and `weight_set`. Developer Mode displays active configuration.

---

## 17. Database Model

### `films`

| Column | Notes |
|---|---|
| `id` | PK |
| `title` | |
| `year` | |
| `status` | active / watched / archived |
| `enrichment_status` | pending / matching / review_required / enriching / ready / failed |
| `created_at` | |
| `updated_at` | |

---

### `film_metadata`

| Column | Notes |
|---|---|
| `film_id` | FK → films |
| `tmdb_id` | |
| `imdb_id` | |
| `original_title` | |
| `runtime` | |
| `synopsis` | |
| `genres` | JSONB |
| `keywords` | JSONB |
| `original_language` | Used for subtitle proxy filtering |
| `country` | |
| `director` | |
| `tmdb_rating` | |
| `rotten_tomatoes_score` | |
| `letterboxd_rating` | |
| `poster_url` | |
| `backdrop_url` | |

---

### `film_semantic_profiles`

| Column | Notes |
|---|---|
| `film_id` | FK → films |
| `subgenres` | JSONB |
| `themes` | JSONB |
| `tones` | JSONB |
| `visual_descriptors` | JSONB |
| `emotional_outcomes` | JSONB |
| `viewing_contexts` | JSONB |
| `complexity` | numeric |
| `pacing` | numeric |
| `energy` | numeric |
| `obscurity` | numeric |
| `semantic_summary` | text |
| `semantic_version` | |
| `generated_by_model` | |
| `generated_at` | |

---

### `film_embeddings`

| Column | Notes |
|---|---|
| `film_id` | FK → films |
| `embedding_type` | e.g. semantic |
| `embedding_model` | |
| `embedding_version` | |
| `embedding` | VECTOR |
| `generated_at` | |

PK: `(film_id, embedding_type, embedding_version)`

---

### `watchlist_entries`

| Column | Notes |
|---|---|
| `id` | PK |
| `film_id` | FK → films |
| `letterboxd_uri` | |
| `active` | boolean |
| `added_at` | |
| `removed_at` | |

---

### `recommendation_profiles`

| Column | Notes |
|---|---|
| `id` | PK |
| `profile_hash` | SHA-256 of canonicalized profile; unique index |
| `structured_profile` | JSONB |
| `narrative_profile` | text |
| `embedding_model` | |
| `embedding_version` | |
| `embedding` | VECTOR |
| `created_at` | |

Profiles are created independently of sessions. A cached profile (matched by `profile_hash`) is reused across sessions without generating a new embedding.

Note: raw questionnaire answers are not stored. The structured profile is the authoritative auditability record.

---

### `recommendation_sessions`

| Column | Notes |
|---|---|
| `id` | PK |
| `profile_id` | FK → recommendation_profiles |
| `created_at` | |
| `winner_film_id` | FK → films |
| `ranking_provider` | |
| `ranking_model` | |
| `semantic_version` | |
| `embedding_version` | |
| `scoring_version` | |
| `weight_set` | |
| `prompt_version` | |
| `constraint_relaxation` | JSONB — records which constraints were relaxed and by how much |

---

### `recommendation_candidates`

| Column | Notes |
|---|---|
| `session_id` | FK → recommendation_sessions |
| `film_id` | FK → films |
| `retrieval_rank` | |
| `similarity_score` | |
| `raw_score` | |
| `final_score` | |
| `llm_rank` | |
| `score_breakdown` | JSONB |

PK: `(session_id, film_id)`

---

### `recommendation_results`

| Column | Notes |
|---|---|
| `session_id` | FK → recommendation_sessions |
| `winner_explanation` | text — winner `why_it_matches` (legacy excerpt) |
| `winner_explanation_detail` | JSONB — full structured winner explanation |
| `runner_up_explanations` | JSONB — map of film_id → explanation object |

---

### `recommendation_exposure`

| Column | Notes |
|---|---|
| `film_id` | FK → films |
| `recommendation_count` | |
| `winner_count` | |
| `last_recommended_at` | |

---

### `rss_sync_events`

| Column | Notes |
|---|---|
| `id` | PK |
| `event_type` | |
| `event_timestamp` | |
| `payload` | JSONB |
| `processed` | boolean |

---

### `metadata_match_reviews`

| Column | Notes |
|---|---|
| `id` | PK |
| `film_id` | FK → films |
| `candidate_tmdb_id` | |
| `confidence_score` | |
| `review_status` | |

---

### `system_versions`

| Column | Notes |
|---|---|
| `id` | PK |
| `artifact_type` | |
| `artifact_name` | |
| `version` | |
| `configuration` | JSONB |
| `created_at` | |
| `active` | boolean |

---

## 18. Synchronization Strategy

### Manual Sync

```
CSV Upload → Diff Existing Watchlist → Apply Changes
```

### RSS Sync

Poll every 15 minutes. Supported events: watchlist additions, watchlist removals, watched activity.

### Event Ledger

`rss_sync_events` acts as an idempotent event ledger. Duplicate events are ignored.

---

## 19. Metadata Matching

### Confidence Scoring

Inputs: title similarity, release year match, director match.

| Confidence | Action |
|---|---|
| 95%+ | Auto Accept; `enrichment_status → enriching` |
| 80–95% | Accept + Flag for review |
| <80% | Manual Review required; `enrichment_status → review_required` |

---

## 20. Version Registry

All AI artifacts are versioned.

```
semantic_version:  semantic-v1
embedding_version: embedding-v1
scoring_version:   scoring-v1
weight_set:        default
prompt_version:    recommendation-v1
```

Recommendation sessions reference active versions at generation time via the `system_versions` table.

---

## 21. Developer Mode

Developer Mode exposes:

**Retrieval:** recommendation profile, narrative profile, retrieval candidates, similarity scores.

**Scoring:** weight set, individual scores, diversity adjustments.

**Ranking:** provider, model, prompt version, token usage.

**Metadata:** match confidence, source attribution.

**Version Registry:** semantic version, embedding version, scoring version, prompt version.

---

## 22. Future Expansion

The architecture supports the following without redesigning the core data model:

- Conversational recommendations
- Similar-film discovery
- Watchlist clustering
- Offline recommendation generation
- Local embedding models
- Alternate ranking providers
- Semantic search

---

## 23. Success Criteria

The system is complete when:

1. Watchlists import successfully and return a job ID immediately.
2. Enrichment status is poll-visible per film and per job via `/import/{job_id}/status`.
3. Metadata enrichment succeeds and populates `film_metadata` including `genres`, `keywords`, `original_language`, and `original_title`.
4. Semantic enrichment is generated and versioned, including `viewing_contexts`.
5. Film embeddings are generated and stored.
6. Recommendation profiles are created independently of sessions.
7. Sessions reference profiles via `profile_id` FK.
8. Recommendation profile embeddings are cached by `profile_hash`.
9. Candidate retrieval uses vector similarity.
10. Retrieval traces are persisted.
11. Recommendations come exclusively from films where `enrichment_status = ready`.
12. Subtitle filtering applies `original_language` proxy logic per questionnaire selection.
13. Constraint relaxation is recorded as a JSONB object on the session.
14. Recommendation history is auditable via stored profile and version metadata.
15. RSS synchronization updates watchlist state.
16. Developer Mode exposes recommendation internals.
17. Recommendation generation completes within 30 seconds.
18. Users receive one winner and four runners-up with structured reasoning.
19. Provider changes require only `config.yaml` edits, not application code changes.
20. The recommendation system promotes variety while remaining explainable.
