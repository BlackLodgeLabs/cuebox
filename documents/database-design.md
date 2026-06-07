# Film Picker — Database Design Specification

Version 1.0

-----

## 1. Overview

Film Picker uses **PostgreSQL 16+** with the **pgvector** extension. The database serves as an enrichment and recommendation layer; Letterboxd remains the source of truth for watchlist membership and watch status.

All tables use `UUID` primary keys unless otherwise noted.

-----

## 2. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector embeddings
```

-----

## 3. Enumerations

```sql
CREATE TYPE film_status AS ENUM (
    'active',
    'watched',
    'archived'
);

CREATE TYPE enrichment_status AS ENUM (
    'pending',
    'matching',
    'review_required',
    'enriching',
    'ready',
    'failed'
);

CREATE TYPE import_job_status AS ENUM (
    'running',
    'complete',
    'failed'
);

CREATE TYPE review_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);

CREATE TYPE embedding_type AS ENUM (
    'semantic',
    'synopsis',
    'theme'
);

CREATE TYPE rss_event_type AS ENUM (
    'watchlist_add',
    'watchlist_remove',
    'watched'
);

CREATE TYPE artifact_type AS ENUM (
    'semantic',
    'embedding',
    'scoring',
    'prompt'
);
```

-----

## 4. Tables

### 4.1 `import_jobs`

Tracks asynchronous CSV import jobs. Returned immediately on upload.

```sql
CREATE TABLE import_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status              import_job_status NOT NULL DEFAULT 'running',
    total_films         INTEGER,
    processed_films     INTEGER NOT NULL DEFAULT 0,
    failed_films        INTEGER NOT NULL DEFAULT 0,
    duplicate_films     INTEGER NOT NULL DEFAULT 0,
    failure_summary     JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ
);
```

**Constraints**

```sql
ALTER TABLE import_jobs
    ADD CONSTRAINT chk_import_jobs_processed_lte_total
        CHECK (total_films IS NULL OR processed_films <= total_films);
```

**Indexes**

```sql
CREATE INDEX idx_import_jobs_status ON import_jobs (status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs (created_at DESC);
```

-----

### 4.2 `films`

Core film record. Status and enrichment state are maintained here.

```sql
CREATE TABLE films (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    year                SMALLINT,
    letterboxd_uri      TEXT UNIQUE NOT NULL,
    status              film_status NOT NULL DEFAULT 'active',
    enrichment_status   enrichment_status NOT NULL DEFAULT 'pending',
    import_job_id       UUID REFERENCES import_jobs (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Constraints**

```sql
ALTER TABLE films
    ADD CONSTRAINT chk_films_year_range
        CHECK (year IS NULL OR (year >= 1880 AND year <= EXTRACT(YEAR FROM now()) + 2));
```

**Indexes**

```sql
CREATE INDEX idx_films_status ON films (status);
CREATE INDEX idx_films_enrichment_status ON films (enrichment_status);
CREATE INDEX idx_films_status_enrichment ON films (status, enrichment_status);
CREATE INDEX idx_films_updated_at ON films (updated_at DESC);
```

**Trigger — auto-update `updated_at`**

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_films_updated_at
    BEFORE UPDATE ON films
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

> Apply the same trigger pattern to all tables that carry an `updated_at` column.

-----

### 4.3 `film_metadata`

Enriched metadata from TMDB (primary) and OMDb (secondary).

```sql
CREATE TABLE film_metadata (
    film_id                 UUID PRIMARY KEY REFERENCES films (id) ON DELETE CASCADE,
    tmdb_id                 INTEGER UNIQUE,
    imdb_id                 TEXT UNIQUE,
    original_title          TEXT,
    runtime                 SMALLINT,
    synopsis                TEXT,
    genres                  JSONB NOT NULL DEFAULT '[]',
    keywords                JSONB NOT NULL DEFAULT '[]',
    original_language       CHAR(2),
    country                 TEXT,
    director                TEXT,
    tmdb_rating             NUMERIC(3, 1),
    rotten_tomatoes_score   SMALLINT,
    letterboxd_rating       NUMERIC(3, 2),
    poster_url              TEXT,
    backdrop_url            TEXT,
    match_confidence        NUMERIC(5, 4),
    metadata_source         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Constraints**

```sql
ALTER TABLE film_metadata
    ADD CONSTRAINT chk_film_metadata_runtime_positive
        CHECK (runtime IS NULL OR runtime > 0),
    ADD CONSTRAINT chk_film_metadata_tmdb_rating_range
        CHECK (tmdb_rating IS NULL OR (tmdb_rating >= 0 AND tmdb_rating <= 10)),
    ADD CONSTRAINT chk_film_metadata_rt_score_range
        CHECK (rotten_tomatoes_score IS NULL OR (rotten_tomatoes_score >= 0 AND rotten_tomatoes_score <= 100)),
    ADD CONSTRAINT chk_film_metadata_lb_rating_range
        CHECK (letterboxd_rating IS NULL OR (letterboxd_rating >= 0 AND letterboxd_rating <= 5)),
    ADD CONSTRAINT chk_film_metadata_match_confidence_range
        CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1));
```

**Indexes**

```sql
CREATE INDEX idx_film_metadata_tmdb_id ON film_metadata (tmdb_id);
CREATE INDEX idx_film_metadata_imdb_id ON film_metadata (imdb_id);
CREATE INDEX idx_film_metadata_original_language ON film_metadata (original_language);
CREATE INDEX idx_film_metadata_genres ON film_metadata USING GIN (genres);
CREATE INDEX idx_film_metadata_keywords ON film_metadata USING GIN (keywords);
```

-----

### 4.4 `film_semantic_profiles`

LLM-generated semantic enrichment. Versioned per generation run.

```sql
CREATE TABLE film_semantic_profiles (
    film_id             UUID PRIMARY KEY REFERENCES films (id) ON DELETE CASCADE,
    subgenres           JSONB NOT NULL DEFAULT '[]',
    themes              JSONB NOT NULL DEFAULT '[]',
    tones               JSONB NOT NULL DEFAULT '[]',
    visual_descriptors  JSONB NOT NULL DEFAULT '[]',
    emotional_outcomes  JSONB NOT NULL DEFAULT '[]',
    viewing_contexts    JSONB NOT NULL DEFAULT '[]',
    complexity          NUMERIC(4, 2),
    pacing              NUMERIC(4, 2),
    energy              NUMERIC(4, 2),
    obscurity           NUMERIC(4, 2),
    semantic_summary    TEXT,
    semantic_version    TEXT NOT NULL,
    generated_by_model  TEXT NOT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Constraints**

```sql
ALTER TABLE film_semantic_profiles
    ADD CONSTRAINT chk_fsp_complexity_range
        CHECK (complexity IS NULL OR (complexity >= 0 AND complexity <= 10)),
    ADD CONSTRAINT chk_fsp_pacing_range
        CHECK (pacing IS NULL OR (pacing >= 0 AND pacing <= 10)),
    ADD CONSTRAINT chk_fsp_energy_range
        CHECK (energy IS NULL OR (energy >= 0 AND energy <= 10)),
    ADD CONSTRAINT chk_fsp_obscurity_range
        CHECK (obscurity IS NULL OR (obscurity >= 0 AND obscurity <= 10));
```

**Indexes**

```sql
CREATE INDEX idx_fsp_semantic_version ON film_semantic_profiles (semantic_version);
CREATE INDEX idx_fsp_subgenres ON film_semantic_profiles USING GIN (subgenres);
CREATE INDEX idx_fsp_themes ON film_semantic_profiles USING GIN (themes);
CREATE INDEX idx_fsp_emotional_outcomes ON film_semantic_profiles USING GIN (emotional_outcomes);
CREATE INDEX idx_fsp_viewing_contexts ON film_semantic_profiles USING GIN (viewing_contexts);
```

-----

### 4.5 `film_embeddings`

Embedding vectors for films. Supports multiple embedding types.

```sql
CREATE TABLE film_embeddings (
    film_id             UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
    embedding_type      embedding_type NOT NULL,
    embedding_model     TEXT NOT NULL,
    embedding_version   TEXT NOT NULL,
    embedding           VECTOR(1536) NOT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (film_id, embedding_type, embedding_version)
);
```

> The dimension `1536` matches OpenAI `text-embedding-3-small`. If an alternate provider is configured with a different dimension, create the column with the appropriate size or use a migration to alter it. See §9 for pgvector strategy.

**Indexes**

```sql
-- HNSW index for approximate nearest-neighbour search on semantic embeddings
CREATE INDEX idx_film_embeddings_semantic_hnsw
    ON film_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding_type = 'semantic';

CREATE INDEX idx_film_embeddings_film_id ON film_embeddings (film_id);
CREATE INDEX idx_film_embeddings_type_version ON film_embeddings (embedding_type, embedding_version);
```

-----

### 4.6 `watchlist_entries`

Tracks Letterboxd watchlist membership with add/remove history.

```sql
CREATE TABLE watchlist_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    film_id         UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
    letterboxd_uri  TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at      TIMESTAMPTZ
);
```

**Constraints**

```sql
ALTER TABLE watchlist_entries
    ADD CONSTRAINT chk_watchlist_removed_after_added
        CHECK (removed_at IS NULL OR removed_at >= added_at),
    ADD CONSTRAINT uq_watchlist_film_active
        UNIQUE NULLS NOT DISTINCT (film_id, active);
```

> The partial unique constraint ensures only one active entry per film at any time.

**Indexes**

```sql
CREATE INDEX idx_watchlist_film_id ON watchlist_entries (film_id);
CREATE INDEX idx_watchlist_active ON watchlist_entries (active) WHERE active = TRUE;
CREATE INDEX idx_watchlist_letterboxd_uri ON watchlist_entries (letterboxd_uri);
```

-----

### 4.7 `metadata_match_reviews`

Holds low-confidence TMDB matches requiring user resolution before enrichment proceeds.

```sql
CREATE TABLE metadata_match_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    film_id             UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
    candidate_tmdb_id   INTEGER NOT NULL,
    confidence_score    NUMERIC(5, 4) NOT NULL,
    candidate_payload   JSONB,
    review_status       review_status NOT NULL DEFAULT 'pending',
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Constraints**

```sql
ALTER TABLE metadata_match_reviews
    ADD CONSTRAINT chk_mmr_confidence_range
        CHECK (confidence_score >= 0 AND confidence_score <= 1),
    ADD CONSTRAINT chk_mmr_reviewed_at_requires_status
        CHECK (reviewed_at IS NULL OR review_status IN ('accepted', 'rejected'));
```

**Indexes**

```sql
CREATE INDEX idx_mmr_film_id ON metadata_match_reviews (film_id);
CREATE INDEX idx_mmr_review_status ON metadata_match_reviews (review_status);
CREATE INDEX idx_mmr_pending ON metadata_match_reviews (film_id) WHERE review_status = 'pending';
```

-----

### 4.8 `recommendation_profiles`

Canonical representation of user intent. Created independently of sessions. Cached by content hash.

```sql
CREATE TABLE recommendation_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_hash        CHAR(64) UNIQUE NOT NULL,   -- SHA-256 hex of canonicalized profile
    structured_profile  JSONB NOT NULL,
    narrative_profile   TEXT,
    embedding_model     TEXT,
    embedding_version   TEXT,
    embedding           VECTOR(1536),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes**

```sql
CREATE UNIQUE INDEX idx_rec_profiles_hash ON recommendation_profiles (profile_hash);

-- HNSW index for profile embedding retrieval
CREATE INDEX idx_rec_profiles_embedding_hnsw
    ON recommendation_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding IS NOT NULL;
```

-----

### 4.9 `recommendation_sessions`

One record per recommendation run. References a profile; never stores raw questionnaire answers.

```sql
CREATE TABLE recommendation_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id              UUID NOT NULL REFERENCES recommendation_profiles (id),
    winner_film_id          UUID REFERENCES films (id) ON DELETE SET NULL,
    ranking_provider        TEXT,
    ranking_model           TEXT,
    semantic_version        TEXT,
    embedding_version       TEXT,
    scoring_version         TEXT,
    weight_set              TEXT,
    prompt_version          TEXT,
    constraint_relaxation   JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes**

```sql
CREATE INDEX idx_rec_sessions_profile_id ON recommendation_sessions (profile_id);
CREATE INDEX idx_rec_sessions_winner_film_id ON recommendation_sessions (winner_film_id);
CREATE INDEX idx_rec_sessions_created_at ON recommendation_sessions (created_at DESC);
```

-----

### 4.10 `recommendation_candidates`

Full observability record for every film considered during a recommendation run.

```sql
CREATE TABLE recommendation_candidates (
    session_id          UUID NOT NULL REFERENCES recommendation_sessions (id) ON DELETE CASCADE,
    film_id             UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
    retrieval_rank      INTEGER,
    similarity_score    NUMERIC(8, 6),
    raw_score           NUMERIC(8, 6),
    final_score         NUMERIC(8, 6),
    llm_rank            SMALLINT,
    score_breakdown     JSONB,

    PRIMARY KEY (session_id, film_id)
);
```

**Constraints**

```sql
ALTER TABLE recommendation_candidates
    ADD CONSTRAINT chk_rc_similarity_range
        CHECK (similarity_score IS NULL OR (similarity_score >= -1 AND similarity_score <= 1)),
    ADD CONSTRAINT chk_rc_llm_rank_positive
        CHECK (llm_rank IS NULL OR llm_rank > 0);
```

**Indexes**

```sql
CREATE INDEX idx_rc_session_id ON recommendation_candidates (session_id);
CREATE INDEX idx_rc_film_id ON recommendation_candidates (film_id);
CREATE INDEX idx_rc_final_score ON recommendation_candidates (session_id, final_score DESC);
CREATE INDEX idx_rc_llm_rank ON recommendation_candidates (session_id, llm_rank ASC NULLS LAST);
```

-----

### 4.11 `recommendation_results`

Stores winner and runner-up explanations produced by the LLM ranker.

```sql
CREATE TABLE recommendation_results (
    session_id              UUID PRIMARY KEY REFERENCES recommendation_sessions (id) ON DELETE CASCADE,
    winner_explanation      TEXT,
    runner_up_explanations  JSONB
);
```

-----

### 4.12 `recommendation_exposure`

Running exposure counters used for diversity adjustment in Stage 4 of the pipeline.

```sql
CREATE TABLE recommendation_exposure (
    film_id                 UUID PRIMARY KEY REFERENCES films (id) ON DELETE CASCADE,
    recommendation_count    INTEGER NOT NULL DEFAULT 0,
    winner_count            INTEGER NOT NULL DEFAULT 0,
    last_recommended_at     TIMESTAMPTZ
);
```

**Constraints**

```sql
ALTER TABLE recommendation_exposure
    ADD CONSTRAINT chk_re_counts_non_negative
        CHECK (recommendation_count >= 0 AND winner_count >= 0),
    ADD CONSTRAINT chk_re_winner_lte_recommendations
        CHECK (winner_count <= recommendation_count);
```

**Indexes**

```sql
CREATE INDEX idx_re_last_recommended_at ON recommendation_exposure (last_recommended_at DESC NULLS LAST);
CREATE INDEX idx_re_winner_count ON recommendation_exposure (winner_count DESC);
```

-----

### 4.13 `rss_sync_events`

Idempotent event ledger for Letterboxd RSS feed updates. Duplicate events are ignored.

```sql
CREATE TABLE rss_sync_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          rss_event_type NOT NULL,
    event_timestamp     TIMESTAMPTZ NOT NULL,
    letterboxd_uri      TEXT,
    payload             JSONB NOT NULL,
    processed           BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Constraints**

```sql
ALTER TABLE rss_sync_events
    ADD CONSTRAINT chk_rss_processed_at_requires_flag
        CHECK (processed_at IS NULL OR processed = TRUE);
```

**Indexes**

```sql
CREATE INDEX idx_rss_processed ON rss_sync_events (processed) WHERE processed = FALSE;
CREATE INDEX idx_rss_event_type ON rss_sync_events (event_type);
CREATE INDEX idx_rss_event_timestamp ON rss_sync_events (event_timestamp DESC);
```

-----

### 4.14 `system_versions`

Version registry for all AI artifacts. Every session records which versions were active at generation time.

```sql
CREATE TABLE system_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type   artifact_type NOT NULL,
    artifact_name   TEXT NOT NULL,
    version         TEXT NOT NULL,
    configuration   JSONB,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_system_versions_name_version UNIQUE (artifact_name, version)
);
```

**Indexes**

```sql
CREATE INDEX idx_system_versions_active ON system_versions (artifact_type, active) WHERE active = TRUE;
CREATE INDEX idx_system_versions_artifact_name ON system_versions (artifact_name);
```

-----

## 5. Relationships

```
import_jobs
    └── films (import_job_id → import_jobs.id)

films
    ├── film_metadata           (1:1, film_id → films.id, CASCADE DELETE)
    ├── film_semantic_profiles  (1:1, film_id → films.id, CASCADE DELETE)
    ├── film_embeddings         (1:N, film_id → films.id, CASCADE DELETE)
    ├── watchlist_entries       (1:N, film_id → films.id, CASCADE DELETE)
    ├── metadata_match_reviews  (1:N, film_id → films.id, CASCADE DELETE)
    ├── recommendation_exposure (1:1, film_id → films.id, CASCADE DELETE)
    ├── recommendation_candidates (N:M via session, film_id → films.id)
    └── recommendation_sessions (winner_film_id → films.id, SET NULL)

recommendation_profiles
    └── recommendation_sessions (profile_id → recommendation_profiles.id)

recommendation_sessions
    ├── recommendation_candidates (session_id → recommendation_sessions.id, CASCADE DELETE)
    └── recommendation_results    (session_id → recommendation_sessions.id, CASCADE DELETE)
```

-----

## 6. Constraints Summary

|Table                      |Constraint                                |Rule                                                   |
|---------------------------|------------------------------------------|-------------------------------------------------------|
|`import_jobs`              |`chk_import_jobs_processed_lte_total`     |`processed_films <= total_films`                       |
|`films`                    |`chk_films_year_range`                    |`year` between 1880 and current year + 2               |
|`film_metadata`            |`chk_film_metadata_runtime_positive`      |`runtime > 0`                                          |
|`film_metadata`            |`chk_film_metadata_tmdb_rating_range`     |`tmdb_rating` 0–10                                     |
|`film_metadata`            |`chk_film_metadata_rt_score_range`        |`rotten_tomatoes_score` 0–100                          |
|`film_metadata`            |`chk_film_metadata_lb_rating_range`       |`letterboxd_rating` 0–5                                |
|`film_metadata`            |`chk_film_metadata_match_confidence_range`|`match_confidence` 0–1                                 |
|`film_semantic_profiles`   |`chk_fsp_*_range`                         |`complexity`, `pacing`, `energy`, `obscurity` 0–10     |
|`watchlist_entries`        |`chk_watchlist_removed_after_added`       |`removed_at >= added_at`                               |
|`watchlist_entries`        |`uq_watchlist_film_active`                |Only one active entry per film                         |
|`metadata_match_reviews`   |`chk_mmr_confidence_range`                |`confidence_score` 0–1                                 |
|`metadata_match_reviews`   |`chk_mmr_reviewed_at_requires_status`     |`reviewed_at` only set when status is accepted/rejected|
|`recommendation_candidates`|`chk_rc_similarity_range`                 |`similarity_score` -1–1                                |
|`recommendation_candidates`|`chk_rc_llm_rank_positive`                |`llm_rank > 0`                                         |
|`recommendation_exposure`  |`chk_re_counts_non_negative`              |Both counts ≥ 0                                        |
|`recommendation_exposure`  |`chk_re_winner_lte_recommendations`       |`winner_count <= recommendation_count`                 |
|`rss_sync_events`          |`chk_rss_processed_at_requires_flag`      |`processed_at` only set when `processed = TRUE`        |
|`system_versions`          |`uq_system_versions_name_version`         |Unique per artifact name + version                     |

-----

## 7. Indexes Summary

|Table                      |Index                                                          |Type         |Purpose                 |
|---------------------------|---------------------------------------------------------------|-------------|------------------------|
|`import_jobs`              |`status`, `created_at`                                         |B-tree       |Job polling             |
|`films`                    |`status`, `enrichment_status`, composite                       |B-tree       |Filtering candidates    |
|`film_metadata`            |`tmdb_id`, `imdb_id`                                           |B-tree       |Deduplication           |
|`film_metadata`            |`original_language`                                            |B-tree       |Subtitle filtering      |
|`film_metadata`            |`genres`, `keywords`                                           |GIN          |JSONB containment search|
|`film_semantic_profiles`   |`subgenres`, `themes`, `emotional_outcomes`, `viewing_contexts`|GIN          |Scoring queries         |
|`film_embeddings`          |`embedding` (semantic, HNSW)                                   |HNSW         |ANN retrieval           |
|`watchlist_entries`        |`active = TRUE` (partial)                                      |B-tree       |Active list lookups     |
|`recommendation_profiles`  |`profile_hash`                                                 |Unique B-tree|Cache hit/miss          |
|`recommendation_profiles`  |`embedding` (HNSW)                                             |HNSW         |Profile similarity      |
|`recommendation_candidates`|`final_score DESC`, `llm_rank ASC`                             |B-tree       |Results ordering        |
|`recommendation_sessions`  |`created_at DESC`                                              |B-tree       |History view            |
|`rss_sync_events`          |`processed = FALSE` (partial)                                  |B-tree       |Unprocessed event queue |
|`system_versions`          |`active = TRUE` (partial)                                      |B-tree       |Active version lookup   |

-----

## 8. Recommendation Candidate View

A convenience view that joins candidate observability data for the Developer Mode and history screens.

```sql
CREATE OR REPLACE VIEW v_recommendation_candidates_detail AS
SELECT
    rc.session_id,
    rc.film_id,
    f.title,
    f.year,
    rc.retrieval_rank,
    rc.similarity_score,
    rc.raw_score,
    rc.final_score,
    rc.llm_rank,
    rc.score_breakdown,
    fmd.runtime,
    fmd.director,
    fmd.genres,
    fmd.original_language,
    fmd.poster_url,
    fmd.rotten_tomatoes_score,
    fmd.letterboxd_rating,
    fsp.themes,
    fsp.tones,
    fsp.emotional_outcomes,
    fsp.complexity,
    fsp.pacing,
    fsp.obscurity
FROM recommendation_candidates rc
JOIN films f                        ON f.id = rc.film_id
LEFT JOIN film_metadata fmd         ON fmd.film_id = rc.film_id
LEFT JOIN film_semantic_profiles fsp ON fsp.film_id = rc.film_id;
```

-----

## 9. pgvector Strategy

### Extension & Configuration

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Dimensions

|Embedding Use                   |Column                             |Dimension|Notes                                     |
|--------------------------------|-----------------------------------|---------|------------------------------------------|
|Film semantic embedding         |`film_embeddings.embedding`        |1536     |OpenAI default. Alter if provider changes.|
|Recommendation profile embedding|`recommendation_profiles.embedding`|1536     |Must match film embedding dimension.      |

If a different provider is configured (e.g. Voyage AI at 1024 dimensions), create a migration to `ALTER COLUMN embedding TYPE VECTOR(1024)` and drop/recreate the HNSW index.

### Index Type: HNSW

HNSW is preferred over IVFFlat for this workload because:

- No training step required (IVFFlat requires `lists` tuning against the dataset size)
- Better recall at low-to-mid dataset sizes (up to 500 films is well within HNSW’s sweet spot)
- Supports incremental inserts without index rebuild

```sql
-- Film embeddings (semantic type only for initial implementation)
CREATE INDEX idx_film_embeddings_semantic_hnsw
    ON film_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding_type = 'semantic';

-- Recommendation profile embeddings
CREATE INDEX idx_rec_profiles_embedding_hnsw
    ON recommendation_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding IS NOT NULL;
```

### Distance Function

**Cosine similarity** (`vector_cosine_ops`) is used for both film and profile embeddings. This is appropriate because:

- OpenAI embedding vectors benefit from cosine distance
- Magnitude differences (caused by text length variance) are normalised out

### Candidate Retrieval Query Pattern

```sql
-- Stage 2: retrieve top-N candidates by cosine similarity
SELECT
    fe.film_id,
    1 - (fe.embedding <=> :profile_embedding) AS similarity_score
FROM film_embeddings fe
JOIN films f ON f.id = fe.film_id
JOIN film_metadata fmd ON fmd.film_id = fe.film_id
WHERE
    fe.embedding_type = 'semantic'
    AND fe.embedding_version = :active_embedding_version
    AND f.status = 'active'
    AND f.enrichment_status = 'ready'
    -- Subtitle hard constraint (Stage 1 applied before or filtered here)
    AND (:subtitle_no = FALSE OR fmd.original_language = 'en')
    -- Runtime hard constraint
    AND (:max_runtime IS NULL OR fmd.runtime <= :max_runtime)
ORDER BY fe.embedding <=> :profile_embedding
LIMIT :retrieval_candidate_limit;
```

### `ef_search` Tuning

At query time, `ef_search` can be raised to improve recall at the cost of speed:

```sql
SET hnsw.ef_search = 100;  -- default is 40; increase for better recall
```

For a 500-film watchlist the default is sufficient.

-----

## 10. Migration Strategy

### Tooling

**Alembic** (Python) manages all schema migrations, consistent with the FastAPI + SQLAlchemy stack.

```
alembic/
├── env.py
├── script.py.mako
└── versions/
    ├── 0001_initial_schema.py
    ├── 0002_add_hnsw_indexes.py
    └── ...
```

### Conventions

- Every migration has a unique revision ID (auto-generated by Alembic)
- Migrations are **always reversible** — every `upgrade()` has a corresponding `downgrade()`
- No raw SQL DDL outside migration files
- Migration files are committed to version control
- API container runs `alembic upgrade head` on startup before serving traffic

### Baseline Migration (`0001_initial_schema`)

Creates all enumerations, tables, constraints, and indexes in dependency order:

1. Extensions (`pgcrypto`, `vector`)
1. Enumerations
1. `import_jobs`
1. `films` + `updated_at` trigger
1. `film_metadata`
1. `film_semantic_profiles`
1. `film_embeddings` + HNSW index
1. `watchlist_entries`
1. `metadata_match_reviews`
1. `recommendation_profiles` + HNSW index
1. `recommendation_sessions`
1. `recommendation_candidates`
1. `recommendation_results`
1. `recommendation_exposure`
1. `rss_sync_events`
1. `system_versions`
1. `v_recommendation_candidates_detail` view

### Semantic Re-enrichment (`0003_semantic_v2` — future)

When a new semantic model requires re-enrichment:

1. Add a new `semantic_version` value to `system_versions`
1. Do **not** delete existing `film_semantic_profiles` rows — update them in place with the new version fields
1. Reset `enrichment_status` to `enriching` on affected films via a data migration
1. Existing recommendation session records retain their `semantic_version` reference for auditability

### Embedding Dimension Change (future)

If the embedding provider changes and dimensions differ:

```python
# In the migration upgrade():
op.execute("DROP INDEX IF EXISTS idx_film_embeddings_semantic_hnsw")
op.execute("ALTER TABLE film_embeddings ALTER COLUMN embedding TYPE VECTOR(1024)")
op.execute("""
    CREATE INDEX idx_film_embeddings_semantic_hnsw
    ON film_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding_type = 'semantic'
""")
# Existing embeddings must be regenerated after migration
```

Existing embeddings under the old version remain stored (different `embedding_version`) until explicitly pruned.

### Zero-Downtime Considerations

Film Picker is a local, single-user application. Zero-downtime deployment is not a requirement. Migrations run synchronously at startup and the application begins serving only after `alembic upgrade head` completes successfully.

-----

## 11. Seed Data

On first run, insert active system version records:

```sql
INSERT INTO system_versions (artifact_type, artifact_name, version, active) VALUES
    ('semantic',   'semantic-profile',   'semantic-v1',   TRUE),
    ('embedding',  'film-embedding',     'embedding-v1',  TRUE),
    ('scoring',    'recommendation',     'scoring-v1',    TRUE),
    ('prompt',     'ranking-prompt',     'recommendation-v1', TRUE);
```