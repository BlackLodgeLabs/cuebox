Film Picker Technical Architecture

Version 1.0

⸻

1. Executive Summary

Film Picker is a locally hosted, single-user recommendation application designed to help users choose films from their existing Letterboxd watchlist.

The system does not discover new films. All recommendations are generated exclusively from films contained within the user’s active watchlist.

The architecture combines:

* Deterministic filtering
* Semantic enrichment
* Vector similarity search
* Structured scoring
* LLM-assisted ranking

The objective is to behave like a trusted film-loving friend rather than a deterministic search engine.

⸻

2. Architectural Principles

Recommendation Quality Over Determinism

Recommendations should be explainable but not rigidly deterministic.

The system should naturally surface different suitable candidates over time while remaining consistent with user preferences.

Semantic Understanding Over Genre Matching

Genres alone are insufficient.

The recommendation engine should understand:

* Themes
* Tone
* Emotional impact
* Complexity
* Pacing
* Viewing context
* Visual style

as first-class recommendation signals.

Enrich Once, Use Many Times

Semantic enrichment is generated once per film and persisted indefinitely.

Recommendation generation should be fast and should not depend on repeated enrichment calls.

Letterboxd Is Source Of Truth

Watchlist state originates from Letterboxd.

Local data acts as a cache and enrichment layer.

⸻

3. System Architecture

High-Level Architecture

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
│ Recommendation Service                       │
│ Sync Service                                 │
│ Provider Service                             │
│ Developer Mode Service                       │
└───────────────┬───────────────┬──────────────┘
│               │
▼               ▼
┌─────────────┐   ┌──────────────┐
│ PostgreSQL  │   │ Celery Worker│
│ + pgvector  │   │ + Redis      │
└──────┬──────┘   └──────┬───────┘
│                 │
▼                 ▼
┌─────────────────────────────────┐
│ External Providers              │
│                                 │
│ TMDB                            │
│ OMDb                            │
│ Letterboxd RSS                  │
│ OpenAI-Compatible LLMs          │
└─────────────────────────────────┘

⸻

4. Technology Stack

Frontend

* Next.js
* TypeScript
* React Query
* TailwindCSS
* shadcn/ui

Backend

* FastAPI
* Pydantic
* SQLAlchemy 2.x

Database

* PostgreSQL 16+
* pgvector extension

Background Processing

* Celery
* Redis

Containerisation

Docker Compose

Services:

* frontend
* api
* worker
* postgres
* redis

⸻

5. Core Services

Import Service

Responsibilities:

* CSV validation
* CSV parsing
* Duplicate detection
* Film creation
* Metadata match workflow
* Enrichment scheduling

Import Pipeline:

CSV Upload
↓
Validation
↓
Film Creation
↓
TMDB Matching
↓
Metadata Retrieval
↓
Semantic Enrichment
↓
Embedding Generation
↓
Persist

⸻

Metadata Service

Responsibilities:

* TMDB search
* OMDb enrichment
* Confidence scoring
* Metadata updates

Stored Metadata:

* TMDB ID
* IMDB ID
* Letterboxd URI
* Title
* Original Title
* Runtime
* Release Year
* Synopsis
* Genres
* Keywords
* Director
* Ratings
* Poster
* Backdrop

⸻

Semantic Enrichment Service

Semantic enrichment is a first-class architectural component.

It exists independently of recommendation generation.

Each film is enriched once and cached indefinitely.

Inputs:

* Synopsis
* Genres
* Keywords
* Director
* Runtime
* Ratings

Outputs:

* Themes
* Subgenres
* Tone descriptors
* Emotional outcomes
* Visual descriptors
* Viewing contexts
* Complexity score
* Pacing score
* Energy score
* Obscurity score
* Semantic summary

Example:

{
“themes”: [
“obsession”,
“identity”,
“grief”
],
“subgenres”: [
“psychological horror”,
“body horror”
],
“tones”: [
“bleak”,
“surreal”
],
“emotional_outcomes”: [
“disturbed”,
“haunted”
],
“complexity”: 4,
“pacing”: 2
}

⸻

Embedding Service

A semantic embedding is generated once for each film.

Embedding Inputs:

* Synopsis
* Genres
* Keywords
* Semantic enrichment tags
* Semantic summary

Output:

Embedding Vector

Stored using pgvector.

Purpose:

* Similarity search
* Candidate retrieval
* Future recommendation enhancements

⸻

6. Recommendation Architecture

Recommendation generation is a four-stage pipeline.

⸻

Stage 1: Hard Constraint Filtering

Mandatory constraints.

Examples:

* Watched status
* Archived status
* Runtime limits
* Subtitle preference
* Metadata resolution state

Films failing hard constraints are removed.

⸻

Stage 2: Semantic Candidate Retrieval

Inputs:

* Questionnaire responses
* Additional notes

A recommendation profile is generated.

Example:

“I want a slow-burn folk horror that’s unsettling but not exhausting.”

A recommendation embedding is generated.

Candidate retrieval uses vector similarity.

SELECT film_id
FROM film_embeddings
ORDER BY embedding <=> query_embedding
LIMIT 100

This produces the semantic candidate pool.

⸻

Stage 3: Structured Scoring

Candidates are scored using deterministic signals.

Signals:

* Genre overlap
* Theme overlap
* Emotional outcome overlap
* Complexity fit
* Pacing fit
* Era fit
* Obscurity fit
* Viewing context fit
* Diversity adjustment

Score breakdowns are persisted.

Developer Mode exposes all scoring factors.

⸻

Stage 4: LLM Ranking

Input:

* User answers
* Additional notes
* Candidate metadata
* Semantic enrichment
* Candidate scores

The LLM may:

* Reorder candidates
* Promote lower-ranked candidates
* Explain selections

Output:

* Winner
* Four runners-up
* Structured explanations
* Caveats
* Trade-offs

⸻

7. Diversity Strategy

Randomness is not used.

Instead:

Each film tracks:

* Recommendation count
* Winner count
* Last recommendation timestamp

A diversity adjustment modifies scores.

Example:

Freshness Bonus
+
Exposure Penalty

This allows similarly suitable films to rotate naturally over time.

Benefits:

* Reduced repetition
* More discovery
* Better long-term recommendation quality

⸻

8. Database Model

films

id

title

year

status

created_at

updated_at

⸻

film_metadata

film_id

tmdb_id

imdb_id

runtime

synopsis

language

country

director

tmdb_rating

rotten_tomatoes_score

letterboxd_rating

poster_url

backdrop_url

⸻

film_keywords

film_id

keyword

⸻

film_semantic_profiles

film_id

subgenres JSONB

themes JSONB

tones JSONB

visual_descriptors JSONB

emotional_outcomes JSONB

viewing_contexts JSONB

complexity

pacing

energy

obscurity

semantic_summary

⸻

film_embeddings

film_id

embedding VECTOR

embedding_model

generated_at

⸻

watchlist_entries

id

film_id

letterboxd_uri

active

added_at

removed_at

⸻

recommendation_sessions

id

created_at

winner_film_id

provider

model

constraint_relaxation

⸻

recommendation_answers

id

session_id

question_key

answer_value

⸻

recommendation_candidates

id

session_id

film_id

raw_score

final_score

score_breakdown JSONB

llm_rank

⸻

recommendation_results

session_id

winner_explanation

runner_up_explanations JSONB

⸻

recommendation_exposure

film_id

recommendation_count

winner_count

last_recommended_at

⸻

rss_sync_events

id

event_type

event_timestamp

payload JSONB

processed

⸻

metadata_match_reviews

id

film_id

candidate_tmdb_id

confidence_score

review_status

⸻

9. API Design

Import

POST /api/import/watchlist

Upload Letterboxd CSV.

Response:

{
“imported”: 342,
“failed”: 2,
“pending_review”: 3
}

⸻

Metadata

POST /api/films/{id}/enrich

Retry enrichment.

POST /api/matches/{id}/resolve

Resolve ambiguous matches.

⸻

Recommendations

POST /api/recommendations

Create recommendation session.

POST /api/recommendations/{id}/answers

Store questionnaire answer.

POST /api/recommendations/{id}/generate

Generate recommendation.

Response:

{
“winner”: {},
“runners_up”: []
}

⸻

History

GET /api/history

Supports:

* title
* date
* watch_status

GET /api/history/{id}

Returns original recommendation.

⸻

Sync

POST /api/sync/rss

Trigger RSS sync.

GET /api/sync/status

Retrieve sync status.

⸻

10. Synchronisation Strategy

Source Of Truth

Letterboxd

Always.

⸻

Manual Sync

CSV Upload
↓
Diff
↓
Additions
Removals
Updates

⸻

RSS Sync

Poll every 15 minutes.

Supported Events:

* Watchlist additions
* Watchlist removals
* Watched activity

⸻

Event Processing

Watchlist Addition

Create Film
↓
Enrich
↓
Activate

Watchlist Removal

Archive

Watched Activity

Mark Watched

⸻

Idempotency

All RSS events are stored.

Duplicate events are ignored.

rss_sync_events acts as the event ledger.

⸻

11. Metadata Matching Strategy

Confidence Scoring

Inputs:

* Title similarity
* Release year match
* Director match

Thresholds:

95%+     Auto Accept

80–95%   Accept + Flag

Below 80% Manual Review

⸻

12. Developer Mode

Developer Mode exposes the full recommendation pipeline.

Filtering

* Candidate counts
* Constraint removal
* Relaxation history

Scoring

* Raw scores
* Weightings
* Diversity adjustments

Semantic Layer

* Enrichment payload
* Embedding metadata

LLM Layer

* Provider
* Model
* Prompt
* Response
* Token usage

Metadata

* Match confidence
* Source attribution

⸻

13. Future Expansion

The architecture supports future enhancements without redesign.

Examples:

* Conversational recommendation flows
* Similar-film browsing
* Watchlist clustering
* Recommendation collections
* Alternative ranking models
* Local embedding models
* Full semantic search

Because semantic enrichment and embeddings are first-class architectural components, future recommendation capabilities can be added without changing the underlying data model.

⸻

14. Success Criteria

The system is complete when:

1. Watchlists import successfully.
2. Metadata enrichment completes successfully.
3. Semantic enrichment is generated and persisted.
4. Embeddings are generated and stored.
5. RSS synchronisation updates watchlist state.
6. Recommendations are generated from active watchlist films only.
7. Candidate retrieval uses vector similarity.
8. Scoring remains explainable.
9. LLM ranking provides structured reasoning.
10. Recommendation history is fully reproducible.
11. Developer Mode exposes all recommendation internals.
12. Recommendation generation completes within 30 seconds.