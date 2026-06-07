Film Picker Technical Architecture

Version 3.0 (Implementation Baseline)

⸻

1. Overview

Film Picker is a locally hosted, single-user recommendation application that helps users choose films from their existing Letterboxd watchlist.

The application does not discover new films.

All recommendations must originate exclusively from films contained within the user’s active Letterboxd watchlist.

The primary objective is to reduce decision paralysis through a combination of:

* Metadata enrichment
* Semantic enrichment
* Embedding-based retrieval
* Structured scoring
* Diversity-aware selection
* LLM-assisted ranking

The system should behave like a trusted film-loving friend rather than a deterministic search engine.

⸻

2. Goals

Functional Goals

* Import Letterboxd watchlists
* Synchronize watchlist changes
* Enrich films with metadata
* Enrich films with semantic understanding
* Generate recommendations
* Store recommendation history
* Explain recommendations
* Provide developer observability

Non-Functional Goals

* Local-first deployment
* Single-user operation
* Provider independence
* Full recommendation auditability
* Explainable recommendation pipeline
* Fast recommendation generation (<30s)

⸻

3. Architectural Principles

Semantic-First Recommendation

Recommendations are driven primarily by semantic understanding rather than genre matching.

The system should understand:

* Themes
* Emotional outcomes
* Tone
* Visual style
* Complexity
* Pacing
* Viewing context

as first-class recommendation signals.

⸻

Enrich Once, Reuse Many Times

Film enrichment is generated once and persisted indefinitely.

Recommendation generation should never depend on repeated enrichment.

⸻

Auditability Over Reproducibility

The system should retain sufficient information to understand how recommendations were generated, even if providers, prompts or models evolve.

⸻

Provider Independence

Embedding generation, semantic enrichment and ranking are independent subsystems.

Providers must be replaceable without application redesign.

⸻

Letterboxd As Source Of Truth

Letterboxd remains authoritative for:

* Watchlist state
* Watched status

Local storage acts as an enrichment and recommendation layer.

⸻

4. High-Level Architecture

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

⸻

5. Technology Stack

Frontend

* Next.js
* TypeScript
* React Query
* TailwindCSS
* shadcn/ui

Backend

* FastAPI
* Pydantic
* SQLAlchemy

Database

* PostgreSQL 16+
* pgvector

Scheduling

* APScheduler
* FastAPI Background Tasks

Deployment

Docker Compose

Services:

* frontend
* api
* postgres

⸻

6. Provider Architecture

The system separates AI capabilities into independent providers.

Embedding Provider

Responsibilities:

* Film embeddings
* Recommendation profile embeddings

Examples:

* OpenAI
* Voyage AI
* Local embedding models

⸻

Semantic Enrichment Provider

Responsibilities:

* Theme extraction
* Tone analysis
* Emotional analysis
* Semantic profiling

Examples:

* OpenAI
* Ollama
* LM Studio

⸻

Ranking Provider

Responsibilities:

* Candidate ranking
* Recommendation explanations

Examples:

* OpenAI
* Claude
* OpenRouter
* Ollama

⸻

7. Import & Enrichment Pipeline

Letterboxd CSV
       ↓
Validation
       ↓
Film Creation
       ↓
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
Persistence

⸻

8. Metadata Enrichment Strategy

Stored Metadata

Identification

* TMDB ID
* IMDB ID
* Letterboxd URI

Core

* Title
* Original Title
* Runtime
* Release Year
* Synopsis

Classification

* Genres
* Keywords
* Language
* Country

Crew

* Director

Ratings

* TMDB Rating
* Rotten Tomatoes Score
* Letterboxd Rating

Assets

* Poster URL
* Backdrop URL

⸻

9. Semantic Enrichment Strategy

Semantic enrichment is a first-class architectural subsystem.

Generated once per film.

Persisted indefinitely.

Generated Signals

Subgenres

0..n

Examples:

* Folk Horror
* Psychological Horror
* Neo-Noir

Themes

0..n

Examples:

* Identity
* Obsession
* Isolation

Tones

0..n

Examples:

* Bleak
* Surreal
* Hopeful

Visual Descriptors

0..n

Examples:

* Atmospheric
* Gritty
* Dreamlike

Emotional Outcomes

0..n

Examples:

* Inspired
* Disturbed
* Comforted

Structured Ratings

* Complexity
* Pacing
* Energy
* Obscurity

Semantic Summary

Short narrative description of the film.

⸻

10. Semantic Profile Versioning

Every enrichment record stores:

* semantic_version
* generated_by_model
* generated_at

This enables future re-enrichment without losing provenance.

⸻

11. Embedding Strategy

Film Embeddings

Generated once per film.

Input:

* Synopsis
* Genres
* Keywords
* Semantic profile
* Semantic summary

Stored indefinitely.

⸻

Multi-Embedding Support

The architecture supports multiple embedding types.

Examples:

* semantic
* synopsis
* themes

Initial implementation uses:

* semantic

only.

⸻

12. Recommendation Profile Service

The Recommendation Profile Service is the canonical representation of user intent.

The recommendation engine never directly consumes questionnaire answers.

It consumes recommendation profiles.

Responsibilities:

* Transform questionnaire responses
* Interpret free-text notes
* Build recommendation profiles
* Generate recommendation embeddings

⸻

Structured Profile

Example:

{
  "genres": ["horror"],
  "subgenres": ["folk horror"],
  "pacing": "slow",
  "desired_emotions": ["unsettled"]
}

⸻

Narrative Profile

Example:

“Slow-burn atmospheric folk horror with immersive visuals, emotional unease and strong tension.”

⸻

13. Recommendation Profile Caching

Recommendation profiles are canonicalized before hashing.

Normalization rules:

* Sort arrays
* Remove empty values
* Remove nulls
* Normalize case
* Normalize whitespace
* Sort object keys recursively

Flow:

Recommendation Profile
        ↓
Canonicalization
        ↓
SHA-256 Hash
        ↓
Cache Lookup
        ↓
Embedding Generation (if miss)

This prevents duplicate embedding generation.

⸻

14. Recommendation Pipeline

Stage 1: Hard Constraint Filtering

Remove:

* Watched films
* Archived films
* Runtime violations
* Subtitle violations
* Unresolved metadata

⸻

Stage 2: Semantic Retrieval

Generate recommendation embedding.

Perform vector similarity search.

Candidate count is configurable.

Example:

recommendation:
  retrieval_candidate_limit: 100

⸻

Stage 3: Structured Scoring

Signals include:

* Theme fit
* Emotional fit
* Pacing fit
* Complexity fit
* Era fit
* Obscurity fit
* Viewing context fit
* Recommendation history

⸻

Stage 4: Diversity Adjustment

Apply:

* Exposure penalties
* Freshness bonuses

Inputs:

* Recommendation count
* Winner count
* Last recommendation date

⸻

Stage 5: Controlled Stochastic Selection

Among similarly scored candidates:

* Weighted candidate selection is permitted
* Diversity-adjusted candidates may be promoted

This prevents recommendation stagnation.

⸻

Stage 6: LLM Ranking

Input:

* Recommendation profile
* Candidate metadata
* Semantic enrichment
* Candidate scores

Output:

* Winner
* Four runners-up
* Explanations
* Trade-offs

⸻

15. Scoring Configuration

Scoring weights are configuration-driven.

Example:

scoring:
  theme_fit: 0.25
  emotional_fit: 0.20
  pacing_fit: 0.15
  complexity_fit: 0.10
  era_fit: 0.10
  obscurity_fit: 0.05
  viewing_context_fit: 0.05
  diversity_adjustment: 0.10

Stored with:

* scoring_version
* weight_set

Developer Mode displays active scoring configuration.

⸻

16. Database Model

films

* id
* title
* year
* status
* created_at
* updated_at

⸻

film_metadata

* film_id
* tmdb_id
* imdb_id
* runtime
* synopsis
* language
* country
* director
* tmdb_rating
* rotten_tomatoes_score
* letterboxd_rating
* poster_url
* backdrop_url

⸻

film_semantic_profiles

* film_id
* subgenres JSONB
* themes JSONB
* tones JSONB
* visual_descriptors JSONB
* emotional_outcomes JSONB
* viewing_contexts JSONB
* complexity
* pacing
* energy
* obscurity
* semantic_summary
* semantic_version
* generated_by_model
* generated_at

⸻

film_embeddings

* film_id
* embedding_type
* embedding_model
* embedding_version
* embedding VECTOR
* generated_at

⸻

watchlist_entries

* id
* film_id
* letterboxd_uri
* active
* added_at
* removed_at

⸻

recommendation_profiles

* id
* session_id
* profile_hash
* structured_profile JSONB
* narrative_profile
* embedding_model
* embedding_version
* embedding VECTOR
* created_at

⸻

recommendation_sessions

* id
* created_at
* winner_film_id
* ranking_provider
* ranking_model
* semantic_version
* embedding_version
* scoring_version
* weight_set
* prompt_version
* constraint_relaxation

⸻

recommendation_candidates

* session_id
* film_id
* retrieval_rank
* similarity_score
* raw_score
* final_score
* llm_rank
* score_breakdown JSONB

⸻

recommendation_results

* session_id
* winner_explanation
* runner_up_explanations JSONB

⸻

recommendation_exposure

* film_id
* recommendation_count
* winner_count
* last_recommended_at

⸻

rss_sync_events

* id
* event_type
* event_timestamp
* payload JSONB
* processed

⸻

metadata_match_reviews

* id
* film_id
* candidate_tmdb_id
* confidence_score
* review_status

⸻

system_versions

* id
* artifact_type
* artifact_name
* version
* configuration JSONB
* created_at
* active

⸻

17. Synchronization Strategy

Manual Sync

CSV Upload
      ↓
Diff Existing Watchlist
      ↓
Apply Changes

⸻

RSS Sync

Poll every 15 minutes.

Supported events:

* Watchlist additions
* Watchlist removals
* Watched activity

⸻

Event Ledger

rss_sync_events acts as an idempotent event ledger.

Duplicate events are ignored.

⸻

18. Metadata Matching

Confidence Scoring

Inputs:

* Title similarity
* Release year match
* Director match

Thresholds:

95%+ → Auto Accept

80–95% → Accept + Flag

<80% → Manual Review

⸻

19. Version Registry

All AI artifacts are versioned.

Examples:

semantic_version: semantic-v1
embedding_version: embedding-v1
scoring_version: scoring-v1
weight_set: default
prompt_version: recommendation-v1

Recommendation sessions reference active versions at generation time.

⸻

20. Developer Mode

Developer Mode exposes:

Retrieval

* Recommendation profile
* Narrative profile
* Retrieval candidates
* Similarity scores

Scoring

* Weight set
* Individual scores
* Diversity adjustments

Ranking

* Provider
* Model
* Prompt version
* Token usage

Metadata

* Match confidence
* Source attribution

Version Registry

* Semantic version
* Embedding version
* Scoring version
* Prompt version

⸻

21. Future Expansion

The architecture supports:

* Conversational recommendations
* Similar-film discovery
* Watchlist clustering
* Offline recommendation generation
* Local embedding models
* Alternate ranking providers
* Semantic search

without redesigning the core data model.

⸻

22. Success Criteria

The system is complete when:

1. Watchlists import successfully.
2. Metadata enrichment succeeds.
3. Semantic enrichment is generated and versioned.
4. Film embeddings are generated and stored.
5. Recommendation profiles are generated and cached.
6. Candidate retrieval uses vector similarity.
7. Recommendations are generated exclusively from active watchlist films.
8. Recommendation history is fully auditable.
9. Retrieval traces are persisted.
10. Developer Mode exposes recommendation internals.
11. RSS synchronization updates watchlist state.
12. Recommendation generation completes within 30 seconds.
13. All recommendation artifacts are versioned and traceable.

:::
This is the version I would treat as the authoritative architecture baseline before moving into schema design, service contracts, API implementation, and build planning.