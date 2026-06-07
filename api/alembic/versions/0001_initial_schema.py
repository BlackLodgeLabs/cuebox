"""Initial schema — extensions, enums, tables, indexes, view, triggers.

Revision ID: 0001
Revises:
Create Date: 2026-06-07

Design note: watchlist active-entry uniqueness uses a partial unique index
(see phase-1-plan.md) instead of UNIQUE NULLS NOT DISTINCT (film_id, active).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    op.execute(
        """
        CREATE TYPE film_status AS ENUM ('active', 'watched', 'archived');
        CREATE TYPE enrichment_status AS ENUM (
            'pending', 'matching', 'review_required', 'enriching', 'ready', 'failed'
        );
        CREATE TYPE import_job_status AS ENUM ('running', 'complete', 'failed');
        CREATE TYPE review_status AS ENUM ('pending', 'accepted', 'rejected');
        CREATE TYPE embedding_type AS ENUM ('semantic', 'synopsis', 'theme');
        CREATE TYPE rss_event_type AS ENUM ('watchlist_add', 'watchlist_remove', 'watched');
        CREATE TYPE artifact_type AS ENUM ('semantic', 'embedding', 'scoring', 'prompt');
        """
    )

    op.execute(
        """
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
        ALTER TABLE import_jobs
            ADD CONSTRAINT chk_import_jobs_processed_lte_total
                CHECK (total_films IS NULL OR processed_films <= total_films);
        CREATE INDEX idx_import_jobs_status ON import_jobs (status);
        CREATE INDEX idx_import_jobs_created_at ON import_jobs (created_at DESC);
        """
    )

    op.execute(
        """
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
        ALTER TABLE films
            ADD CONSTRAINT chk_films_year_range
                CHECK (year IS NULL OR (year >= 1880 AND year <= EXTRACT(YEAR FROM now()) + 2));
        CREATE INDEX idx_films_status ON films (status);
        CREATE INDEX idx_films_enrichment_status ON films (enrichment_status);
        CREATE INDEX idx_films_status_enrichment ON films (status, enrichment_status);
        CREATE INDEX idx_films_updated_at ON films (updated_at DESC);
        """
    )

    op.execute(
        """
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
        ALTER TABLE film_metadata
            ADD CONSTRAINT chk_film_metadata_runtime_positive
                CHECK (runtime IS NULL OR runtime > 0),
            ADD CONSTRAINT chk_film_metadata_tmdb_rating_range
                CHECK (tmdb_rating IS NULL OR (tmdb_rating >= 0 AND tmdb_rating <= 10)),
            ADD CONSTRAINT chk_film_metadata_rt_score_range
                CHECK (rotten_tomatoes_score IS NULL OR
                    (rotten_tomatoes_score >= 0 AND rotten_tomatoes_score <= 100)),
            ADD CONSTRAINT chk_film_metadata_lb_rating_range
                CHECK (letterboxd_rating IS NULL OR
                    (letterboxd_rating >= 0 AND letterboxd_rating <= 5)),
            ADD CONSTRAINT chk_film_metadata_match_confidence_range
                CHECK (match_confidence IS NULL OR
                    (match_confidence >= 0 AND match_confidence <= 1));
        CREATE INDEX idx_film_metadata_tmdb_id ON film_metadata (tmdb_id);
        CREATE INDEX idx_film_metadata_imdb_id ON film_metadata (imdb_id);
        CREATE INDEX idx_film_metadata_original_language ON film_metadata (original_language);
        CREATE INDEX idx_film_metadata_genres ON film_metadata USING GIN (genres);
        CREATE INDEX idx_film_metadata_keywords ON film_metadata USING GIN (keywords);
        """
    )

    op.execute(
        """
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
        ALTER TABLE film_semantic_profiles
            ADD CONSTRAINT chk_fsp_complexity_range
                CHECK (complexity IS NULL OR (complexity >= 0 AND complexity <= 10)),
            ADD CONSTRAINT chk_fsp_pacing_range
                CHECK (pacing IS NULL OR (pacing >= 0 AND pacing <= 10)),
            ADD CONSTRAINT chk_fsp_energy_range
                CHECK (energy IS NULL OR (energy >= 0 AND energy <= 10)),
            ADD CONSTRAINT chk_fsp_obscurity_range
                CHECK (obscurity IS NULL OR (obscurity >= 0 AND obscurity <= 10));
        CREATE INDEX idx_fsp_semantic_version ON film_semantic_profiles (semantic_version);
        CREATE INDEX idx_fsp_subgenres ON film_semantic_profiles USING GIN (subgenres);
        CREATE INDEX idx_fsp_themes ON film_semantic_profiles USING GIN (themes);
        CREATE INDEX idx_fsp_emotional_outcomes ON film_semantic_profiles USING GIN (emotional_outcomes);
        CREATE INDEX idx_fsp_viewing_contexts ON film_semantic_profiles USING GIN (viewing_contexts);
        """
    )

    op.execute(
        """
        CREATE TABLE film_embeddings (
            film_id             UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
            embedding_type      embedding_type NOT NULL,
            embedding_model     TEXT NOT NULL,
            embedding_version   TEXT NOT NULL,
            embedding           VECTOR(1536) NOT NULL,
            generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (film_id, embedding_type, embedding_version)
        );
        CREATE INDEX idx_film_embeddings_semantic_hnsw
            ON film_embeddings
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            WHERE embedding_type = 'semantic';
        CREATE INDEX idx_film_embeddings_film_id ON film_embeddings (film_id);
        CREATE INDEX idx_film_embeddings_type_version
            ON film_embeddings (embedding_type, embedding_version);
        """
    )

    op.execute(
        """
        CREATE TABLE watchlist_entries (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            film_id         UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
            letterboxd_uri  TEXT NOT NULL,
            active          BOOLEAN NOT NULL DEFAULT TRUE,
            added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            removed_at      TIMESTAMPTZ
        );
        ALTER TABLE watchlist_entries
            ADD CONSTRAINT chk_watchlist_removed_after_added
                CHECK (removed_at IS NULL OR removed_at >= added_at);
        CREATE UNIQUE INDEX uq_watchlist_film_active
            ON watchlist_entries (film_id)
            WHERE (active = TRUE);
        CREATE INDEX idx_watchlist_film_id ON watchlist_entries (film_id);
        CREATE INDEX idx_watchlist_active ON watchlist_entries (active) WHERE active = TRUE;
        CREATE INDEX idx_watchlist_letterboxd_uri ON watchlist_entries (letterboxd_uri);
        """
    )

    op.execute(
        """
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
        ALTER TABLE metadata_match_reviews
            ADD CONSTRAINT chk_mmr_confidence_range
                CHECK (confidence_score >= 0 AND confidence_score <= 1),
            ADD CONSTRAINT chk_mmr_reviewed_at_requires_status
                CHECK (reviewed_at IS NULL OR review_status IN ('accepted', 'rejected'));
        CREATE INDEX idx_mmr_film_id ON metadata_match_reviews (film_id);
        CREATE INDEX idx_mmr_review_status ON metadata_match_reviews (review_status);
        CREATE INDEX idx_mmr_pending ON metadata_match_reviews (film_id)
            WHERE review_status = 'pending';
        """
    )

    op.execute(
        """
        CREATE TABLE recommendation_profiles (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            profile_hash        CHAR(64) UNIQUE NOT NULL,
            structured_profile  JSONB NOT NULL,
            narrative_profile   TEXT,
            embedding_model     TEXT,
            embedding_version   TEXT,
            embedding           VECTOR(1536),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX idx_rec_profiles_hash ON recommendation_profiles (profile_hash);
        CREATE INDEX idx_rec_profiles_embedding_hnsw
            ON recommendation_profiles
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            WHERE embedding IS NOT NULL;
        """
    )

    op.execute(
        """
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
        CREATE INDEX idx_rec_sessions_profile_id ON recommendation_sessions (profile_id);
        CREATE INDEX idx_rec_sessions_winner_film_id ON recommendation_sessions (winner_film_id);
        CREATE INDEX idx_rec_sessions_created_at ON recommendation_sessions (created_at DESC);
        """
    )

    op.execute(
        """
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
        ALTER TABLE recommendation_candidates
            ADD CONSTRAINT chk_rc_similarity_range
                CHECK (similarity_score IS NULL OR
                    (similarity_score >= -1 AND similarity_score <= 1)),
            ADD CONSTRAINT chk_rc_llm_rank_positive
                CHECK (llm_rank IS NULL OR llm_rank > 0);
        CREATE INDEX idx_rc_session_id ON recommendation_candidates (session_id);
        CREATE INDEX idx_rc_film_id ON recommendation_candidates (film_id);
        CREATE INDEX idx_rc_final_score ON recommendation_candidates (session_id, final_score DESC);
        CREATE INDEX idx_rc_llm_rank ON recommendation_candidates (session_id, llm_rank ASC NULLS LAST);
        """
    )

    op.execute(
        """
        CREATE TABLE recommendation_results (
            session_id              UUID PRIMARY KEY REFERENCES recommendation_sessions (id) ON DELETE CASCADE,
            winner_explanation      TEXT,
            runner_up_explanations  JSONB
        );
        """
    )

    op.execute(
        """
        CREATE TABLE recommendation_exposure (
            film_id                 UUID PRIMARY KEY REFERENCES films (id) ON DELETE CASCADE,
            recommendation_count    INTEGER NOT NULL DEFAULT 0,
            winner_count            INTEGER NOT NULL DEFAULT 0,
            last_recommended_at     TIMESTAMPTZ
        );
        ALTER TABLE recommendation_exposure
            ADD CONSTRAINT chk_re_counts_non_negative
                CHECK (recommendation_count >= 0 AND winner_count >= 0),
            ADD CONSTRAINT chk_re_winner_lte_recommendations
                CHECK (winner_count <= recommendation_count);
        CREATE INDEX idx_re_last_recommended_at
            ON recommendation_exposure (last_recommended_at DESC NULLS LAST);
        CREATE INDEX idx_re_winner_count ON recommendation_exposure (winner_count DESC);
        """
    )

    op.execute(
        """
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
        ALTER TABLE rss_sync_events
            ADD CONSTRAINT chk_rss_processed_at_requires_flag
                CHECK (processed_at IS NULL OR processed = TRUE);
        CREATE INDEX idx_rss_processed ON rss_sync_events (processed) WHERE processed = FALSE;
        CREATE INDEX idx_rss_event_type ON rss_sync_events (event_type);
        CREATE INDEX idx_rss_event_timestamp ON rss_sync_events (event_timestamp DESC);
        """
    )

    op.execute(
        """
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
        CREATE INDEX idx_system_versions_active
            ON system_versions (artifact_type, active) WHERE active = TRUE;
        CREATE INDEX idx_system_versions_artifact_name ON system_versions (artifact_name);
        """
    )

    op.execute(
        """
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

        CREATE TRIGGER trg_film_metadata_updated_at
            BEFORE UPDATE ON film_metadata
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.execute(
        """
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
        JOIN films f ON f.id = rc.film_id
        LEFT JOIN film_metadata fmd ON fmd.film_id = rc.film_id
        LEFT JOIN film_semantic_profiles fsp ON fsp.film_id = rc.film_id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_recommendation_candidates_detail")

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_film_metadata_updated_at ON film_metadata;
        DROP TRIGGER IF EXISTS trg_films_updated_at ON films;
        DROP FUNCTION IF EXISTS set_updated_at();
        """
    )

    op.execute("DROP TABLE IF EXISTS system_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS rss_sync_events CASCADE")
    op.execute("DROP TABLE IF EXISTS recommendation_exposure CASCADE")
    op.execute("DROP TABLE IF EXISTS recommendation_results CASCADE")
    op.execute("DROP TABLE IF EXISTS recommendation_candidates CASCADE")
    op.execute("DROP TABLE IF EXISTS recommendation_sessions CASCADE")
    op.execute("DROP TABLE IF EXISTS recommendation_profiles CASCADE")
    op.execute("DROP TABLE IF EXISTS metadata_match_reviews CASCADE")
    op.execute("DROP TABLE IF EXISTS watchlist_entries CASCADE")
    op.execute("DROP TABLE IF EXISTS film_embeddings CASCADE")
    op.execute("DROP TABLE IF EXISTS film_semantic_profiles CASCADE")
    op.execute("DROP TABLE IF EXISTS film_metadata CASCADE")
    op.execute("DROP TABLE IF EXISTS films CASCADE")
    op.execute("DROP TABLE IF EXISTS import_jobs CASCADE")

    op.execute(
        """
        DROP TYPE IF EXISTS artifact_type;
        DROP TYPE IF EXISTS rss_event_type;
        DROP TYPE IF EXISTS embedding_type;
        DROP TYPE IF EXISTS review_status;
        DROP TYPE IF EXISTS import_job_status;
        DROP TYPE IF EXISTS enrichment_status;
        DROP TYPE IF EXISTS film_status;
        """
    )

    op.execute('DROP EXTENSION IF EXISTS "vector"')
    op.execute('DROP EXTENSION IF EXISTS "pgcrypto"')
