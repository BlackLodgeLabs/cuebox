# Film Picker — Sequence Diagrams

Version 1.0

Sequence diagrams for the major flows described in [Architecture.md](./Architecture.md), [PRD.md](./PRD.md), [api-contracts.md](./api-contracts.md), and [database-design.md](./database-design.md).

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and can be rendered in GitHub, VS Code, and most Markdown viewers.

---

## Table of Contents

1. [Watchlist Import & Async Enrichment](#1-watchlist-import--async-enrichment)
2. [Import Job Status Polling](#2-import-job-status-polling)
3. [Metadata Matching & Enrichment (Per Film)](#3-metadata-matching--enrichment-per-film)
4. [Metadata Match Review](#4-metadata-match-review)
5. [Manual CSV Synchronisation](#5-manual-csv-synchronisation)
6. [RSS Synchronisation](#6-rss-synchronisation)
7. [Recommendation Profile Creation & Caching](#7-recommendation-profile-creation--caching)
8. [Recommendation Generation Pipeline](#8-recommendation-generation-pipeline)
9. [Recommendation History](#9-recommendation-history)
10. [Developer Mode Observability](#10-developer-mode-observability)
11. [First-Time User Journey](#11-first-time-user-journey)

---

## 1. Watchlist Import & Async Enrichment

User uploads a Letterboxd CSV. The API returns immediately with a job ID; enrichment runs asynchronously via FastAPI Background Tasks.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI<br/>(Next.js)
    participant API as FastAPI API
    participant Import as Import Service
    participant DB as PostgreSQL
    participant BG as Background Task

    User->>UI: Upload Letterboxd CSV
    UI->>API: POST /import (multipart CSV)
    API->>Import: Validate CSV format & size (≤500 films)
    alt Invalid CSV
        Import-->>API: VALIDATION_ERROR / INVALID_CSV_FORMAT
        API-->>UI: 400 Bad Request
        UI-->>User: Show validation error
    else Valid CSV
        Import->>DB: INSERT import_jobs (status: running)
        Import->>DB: INSERT films (enrichment_status: pending)
        Import->>DB: INSERT watchlist_entries (active: true)
        Import->>BG: Schedule enrichment pipeline
        Import-->>API: job_id
        API-->>UI: 202 Accepted { job_id, status: running }
        UI-->>User: Show import started; redirect to status view

        loop For each film in job
            BG->>BG: Run metadata matching & enrichment (see §3)
        end
    end
```

---

## 2. Import Job Status Polling

The UI polls aggregate progress while enrichment runs in the background.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Import as Import Service
    participant DB as PostgreSQL

    loop Until job complete or failed
        User->>UI: View import status page
        UI->>API: GET /import/{job_id}/status
        API->>Import: Fetch job progress
        Import->>DB: SELECT import_jobs + aggregate film counts
        DB-->>Import: total_films, processed_films, failed_films, duplicate_films
        Import-->>API: Job status payload
        API-->>UI: 200 OK { status, counts, failure_summary }
        UI-->>User: Display progress bar & per-film status
        Note over UI: Poll interval (e.g. every 2–5 seconds)
    end

    alt status = complete
        UI-->>User: Show import summary; enable recommendations
    else status = failed
        UI-->>User: Show failure summary
    end
```

---

## 3. Metadata Matching & Enrichment (Per Film)

Each film progresses through metadata lookup, semantic enrichment, and embedding generation. Films are excluded from recommendations until `enrichment_status = ready`.

```mermaid
sequenceDiagram
    autonumber
    participant BG as Background Task
    participant Meta as Metadata Service
    participant Semantic as Semantic Enrichment Service
    participant Provider as Provider Service
    participant TMDB as TMDB API
    participant OMDb as OMDb API
    participant Embed as Embedding Provider
    participant LLM as Semantic Enrichment Provider
    participant DB as PostgreSQL

    BG->>DB: UPDATE films SET enrichment_status = matching
    BG->>Meta: Match film (title, year, director)
    Meta->>TMDB: Search & retrieve metadata
    TMDB-->>Meta: Candidate matches
    Meta->>Meta: Compute confidence score

    alt Confidence ≥ 95%
        Meta->>DB: INSERT film_metadata (match_confidence)
        Meta->>DB: UPDATE films SET enrichment_status = enriching
    else Confidence 80–95%
        Meta->>DB: INSERT film_metadata + metadata_match_reviews (flagged)
        Meta->>DB: UPDATE films SET enrichment_status = enriching
        Note over DB: Accepted but flagged for later review
    else Confidence < 80%
        Meta->>DB: INSERT metadata_match_reviews (review_status: pending)
        Meta->>DB: UPDATE films SET enrichment_status = review_required
        Note over BG: Pipeline pauses for this film until user resolves
    end

    opt enrichment_status = enriching
        Meta->>OMDb: Supplement ratings (RT score, etc.)
        OMDb-->>Meta: Additional metadata
        Meta->>DB: UPDATE film_metadata

        BG->>Semantic: Enrich film
        Semantic->>Provider: Resolve semantic enrichment provider
        Provider-->>Semantic: Provider instance (from config.yaml)
        Semantic->>LLM: Generate semantic profile
        LLM-->>Semantic: themes, tones, subgenres, ratings, summary
        Semantic->>DB: INSERT film_semantic_profiles (versioned)

        BG->>Semantic: Generate film embedding
        Semantic->>Provider: Resolve embedding provider
        Semantic->>Embed: Embed (synopsis + genres + semantic profile)
        Embed-->>Semantic: embedding vector
        Semantic->>DB: INSERT film_embeddings (type: semantic)

        BG->>DB: UPDATE films SET enrichment_status = ready
    end

    opt Enrichment failure
        BG->>DB: UPDATE films SET enrichment_status = failed
        BG->>DB: UPDATE import_jobs (failed_films++, failure_summary)
    end
```

---

## 4. Metadata Match Review

User resolves low-confidence TMDB matches before the film becomes recommendation-eligible.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Meta as Metadata Service
    participant BG as Background Task
    participant DB as PostgreSQL

    User->>UI: Open films pending review
    UI->>API: GET /films/review-required
    API->>DB: SELECT pending reviews from metadata_match_reviews
    DB-->>API: Films with candidate_payload & confidence_score
    API-->>UI: 200 OK { data: [...] }
    UI-->>User: Display candidate match for review

    alt User accepts match
        User->>UI: Accept proposed TMDB match
        UI->>API: POST /reviews/{review_id}/accept
        API->>Meta: Accept review
        Meta->>DB: UPDATE metadata_match_reviews SET review_status = accepted
        Meta->>DB: INSERT film_metadata from candidate
        Meta->>DB: UPDATE films SET enrichment_status = enriching
        Meta->>BG: Schedule semantic enrichment & embedding
        API-->>UI: 200 OK { review_status: accepted }
        Note over BG: Continues pipeline from §3 (semantic + embedding)
    else User rejects match
        User->>UI: Reject proposed TMDB match
        UI->>API: POST /reviews/{review_id}/reject
        API->>Meta: Reject review
        Meta->>DB: UPDATE metadata_match_reviews SET review_status = rejected
        Meta->>DB: UPDATE films SET enrichment_status = failed
        API-->>UI: 200 OK { review_status: rejected }
        Note over DB: Film excluded from recommendations until re-imported
    end
```

---

## 5. Manual CSV Synchronisation

Returning user uploads a fresh CSV. The system diffs against the active watchlist and applies additions, removals, and watched-status changes.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Sync as Sync Service
    participant Import as Import Service
    participant DB as PostgreSQL
    participant BG as Background Task

    User->>UI: Upload fresh Letterboxd CSV
    UI->>API: POST /sync/csv (multipart CSV)
    API->>Sync: Validate CSV (same rules as import)
    Sync->>DB: SELECT active watchlist_entries + films
    DB-->>Sync: Current watchlist state
    Sync->>Sync: Diff CSV vs active watchlist

    alt Post-sync watchlist > 500 films
        Sync-->>API: WATCHLIST_SIZE_EXCEEDED
        API-->>UI: 400 Bad Request
    else Valid diff
        loop Added films
            Sync->>DB: INSERT films (or restore archived → active)
            Sync->>DB: INSERT/UPDATE watchlist_entries (active: true)
            Sync->>BG: Schedule enrichment for new films
        end
        loop Removed films
            Sync->>DB: UPDATE watchlist_entries SET active = false, removed_at
            Sync->>DB: UPDATE films SET status = archived
            Note over DB: Metadata & history retained
        end
        loop Newly watched films
            Sync->>DB: UPDATE films SET status = watched
            Sync->>DB: UPDATE watchlist_entries SET active = false, removed_at
            Note over DB: Excluded from future recommendations
        end
        Sync-->>API: { added, removed, watched, unchanged, failed }
        API-->>UI: 200 OK sync summary
        UI-->>User: Display changes
    end
```

---

## 6. RSS Synchronisation

APScheduler polls the Letterboxd RSS feed every 15 minutes. Events are recorded in an idempotent ledger before being applied.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Scheduler as APScheduler
    participant Sync as Sync Service
    participant RSS as Letterboxd RSS
    participant DB as PostgreSQL
    participant BG as Background Task

    User->>UI: Configure RSS sync username
    UI->>API: PUT /sync/rss { username }
    API->>DB: Persist RSS configuration
    API-->>UI: 200 OK { polling_interval_seconds: 900 }

    loop Every 15 minutes
        Scheduler->>Sync: Trigger RSS poll
        Sync->>RSS: Fetch RSS feed for username
        RSS-->>Sync: Feed entries (additions, removals, watched)

        loop For each feed event
            Sync->>DB: Check if event already exists
            alt Duplicate event (idempotent)
                Sync->>DB: Skip (event already exists)
            else New event
                Sync->>DB: INSERT rss_sync_events (processed: false)
                alt watchlist_add
                    Sync->>DB: INSERT/restore film + watchlist_entry
                    Sync->>BG: Schedule enrichment if new
                else watchlist_remove
                    Sync->>DB: Archive film; deactivate watchlist_entry
                else watched
                    Sync->>DB: UPDATE films SET status = watched
                    Sync->>DB: UPDATE watchlist_entries SET active = false, removed_at
                end
                Sync->>DB: UPDATE rss_sync_events SET processed = true
            end
        end
        Sync->>DB: Record last_polled_at, last_poll_status
    end

    User->>UI: View RSS sync status
    UI->>API: GET /sync/rss/status
    API->>DB: SELECT RSS config & last poll metadata
    API-->>UI: 200 OK { configured, last_polled_at, events_processed }
```

---

## 7. Recommendation Profile Creation & Caching

Questionnaire answers are transformed into a canonical recommendation profile. Profiles are created independently of sessions and cached by SHA-256 hash.

```mermaid
sequenceDiagram
    autonumber
    participant Rec as Recommendation Service
    participant Profile as Recommendation Profile Service
    participant Provider as Provider Service
    participant Embed as Embedding Provider
    participant DB as PostgreSQL

    Rec->>Profile: Build profile from questionnaire + notes
    Profile->>Profile: Transform to structured_profile
    Profile->>Profile: Generate narrative_profile (interpret notes)
    Profile->>Profile: Canonicalize profile (sort arrays, normalize case/whitespace)
    Profile->>Profile: SHA-256 hash → profile_hash
    Profile->>DB: SELECT recommendation_profiles WHERE profile_hash = ?

    alt Cache hit
        DB-->>Profile: Existing profile + embedding
        Profile-->>Rec: profile_id, embedding, profile_cache_hit = true
        Note over Rec: No embedding API call
    else Cache miss
        Profile->>Provider: Resolve embedding provider (config.yaml)
        Provider-->>Profile: Provider instance
        Profile->>Embed: Generate embedding from narrative_profile
        Embed-->>Profile: embedding vector
        Profile->>DB: INSERT recommendation_profiles (hash, structured, narrative, embedding)
        DB-->>Profile: profile_id
        Profile-->>Rec: profile_id, embedding, profile_cache_hit = false
    end
```

---

## 8. Recommendation Generation Pipeline

Synchronous endpoint (`POST /recommendations`). Target response time under 30 seconds. Six-stage pipeline with full audit trail persisted to the database.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Rec as Recommendation Service
    participant Profile as Recommendation Profile Service
    participant Provider as Provider Service
    participant Rank as Ranking Provider (LLM)
    participant DB as PostgreSQL

    User->>UI: Submit questionnaire + optional notes
    UI->>API: POST /recommendations
    API->>Rec: Validate questionnaire (NO_PREFERENCE_CONFLICT, etc.)

    Rec->>Profile: Create or reuse profile (see §7)
    Profile-->>Rec: profile_id, embedding, profile_cache_hit

    Note over Rec,DB: Stage 1 — Hard Constraint Filtering
    Rec->>DB: SELECT ready, active films with metadata
    Rec->>Rec: Filter: exclude watched, archived, not-ready
    Rec->>Rec: Filter: runtime violations
    Rec->>Rec: Filter: subtitle proxy (non-English if subtitle_preference = no)
    alt Too few candidates
        Rec->>Rec: Relax constraints (record in constraint_relaxation)
    end
    alt Still insufficient
        Rec-->>API: INSUFFICIENT_CANDIDATES (422)
        API-->>UI: 422 Unprocessable Entity
    end

    Note over Rec,DB: Stage 2 — Semantic Retrieval
    Rec->>DB: Vector similarity search (pgvector HNSW, cosine)
    DB-->>Rec: Top-N candidates (retrieval_candidate_limit)

    Note over Rec: Stage 3 — Structured Scoring
    Rec->>DB: Load film_semantic_profiles + recommendation_exposure
    Rec->>Rec: Score: theme, emotional, pacing, complexity, era, obscurity, context, history
    Rec->>Rec: Compute raw_score per candidate

    Note over Rec: Stage 4 — Diversity Adjustment
    Rec->>Rec: Apply exposure penalties & freshness bonuses
    Rec->>Rec: Compute final_score per candidate

    Note over Rec: Stage 5 — Controlled Stochastic Selection
    Rec->>Rec: Weighted selection among similarly scored candidates

    Note over Rec,Rank: Stage 6 — LLM Ranking
    Rec->>Provider: Resolve ranking provider (config.yaml)
    Provider-->>Rec: Ranking provider instance
    Rec->>Rank: Rank candidates (profile, metadata, scores)
    Rank-->>Rec: winner, 4 runners-up, explanations, trade-offs

    Rec->>DB: INSERT recommendation_sessions (profile_id, versions, constraint_relaxation)
    Rec->>DB: INSERT recommendation_candidates (scores, breakdowns, llm_rank)
    Rec->>DB: INSERT recommendation_results (winner_explanation_detail + runner_up_explanations)
    Rec->>DB: UPDATE recommendation_exposure counters

    Rec-->>API: Session result payload
    API-->>UI: 200 OK { session_id, winner, runners_up, profile_cache_hit }
    UI->>API: GET /recommendations/{session_id}
    API-->>UI: 200 OK (full winner explanation + metadata round-trip)
    UI-->>User: Display results (synopsis, TMDB/RT scores, clickable cards → watchlist detail)
```

---

## 9. Recommendation History

Past sessions are listed and can be reopened in full detail.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API
    participant Rec as Recommendation Service
    participant DB as PostgreSQL

    User->>UI: Open recommendation history
    UI->>API: GET /recommendations?search=&date_from=&watch_status=
    API->>Rec: List sessions with filters
    Rec->>DB: SELECT recommendation_sessions JOIN films, profiles
    DB-->>Rec: Paginated history cards
    Rec-->>API: { data, pagination }
    API-->>UI: 200 OK history list
    UI-->>User: Display cards (poster, title, date, preference summary)

    User->>UI: Select a history card
    UI->>API: GET /recommendations/{session_id}
    API->>Rec: Fetch full session
    Rec->>DB: SELECT session, results, profile, winner film metadata
    DB-->>Rec: Full session detail + profile_summary
    Rec-->>API: Complete result payload
    API-->>UI: 200 OK { winner, runners_up, profile_summary, ... }
    UI-->>User: Reopen original recommendation results
```

---

## 10. Developer Mode Observability

Developer Mode endpoints expose internal pipeline data for a recommendation session. Requires `developer_mode: true` in `config.yaml`.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Browser UI<br/>(Dev Mode)
    participant API as FastAPI API
    participant DevSvc as Developer Mode Service
    participant DB as PostgreSQL

    Dev->>UI: Open session internals for session_id
    UI->>API: GET /dev/recommendations/{session_id}/retrieval

    alt Developer Mode disabled
        API-->>UI: 404 Not Found
    else Developer Mode enabled
        API->>DevSvc: Fetch retrieval trace
        DevSvc->>DB: SELECT profile, candidates (similarity scores, ranks)
        DB-->>DevSvc: Retrieval data
        DevSvc-->>API: { profile, candidates, retrieval_candidate_limit }
        API-->>UI: 200 OK retrieval trace
    end

    UI->>API: GET /dev/recommendations/{session_id}/scoring
    API->>DevSvc: Fetch scoring detail
    DevSvc->>DB: SELECT candidates (score_breakdown, weights, versions)
    DevSvc-->>API: Per-candidate scoring breakdown
    API-->>UI: 200 OK scoring detail

    UI->>API: GET /dev/recommendations/{session_id}/ai
    API->>DevSvc: Fetch AI provider metadata
    DevSvc->>DB: SELECT session (ranking_provider, models, prompt_version, tokens)
    DevSvc-->>API: AI provider & token usage
    API-->>UI: 200 OK AI detail

    UI->>API: GET /dev/system/versions
    API->>DevSvc: Fetch active system versions
    DevSvc->>DB: SELECT system_versions WHERE active = true
    DevSvc-->>API: Version registry
    API-->>UI: 200 OK active versions
```

---

## 11. First-Time User Journey

End-to-end flow from first launch through first recommendation.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Browser UI
    participant API as FastAPI API

    User->>UI: Launch application
    UI-->>User: Show empty state; prompt CSV upload

    User->>UI: Upload Letterboxd watchlist CSV
    Note over UI,API: See §1 Watchlist Import
    UI->>API: POST /import
    API-->>UI: 202 { job_id }

    loop Poll until enrichment complete
        Note over UI,API: See §2 Import Job Status Polling
        UI->>API: GET /import/{job_id}/status
        API-->>UI: Progress counts
    end

    opt Films require metadata review
        Note over UI,API: See §4 Metadata Match Review
        User->>UI: Resolve ambiguous matches
    end

    UI-->>User: Enrichment complete; enable recommendations

    User->>UI: Start new recommendation
    UI-->>User: Present questionnaire (Q1–Q10 + notes)

    User->>UI: Answer questions & submit
    Note over UI,API: See §8 Recommendation Generation Pipeline
    UI->>API: POST /recommendations
    API-->>UI: 200 { winner, runners_up, explanations }

    UI->>API: GET /recommendations/{session_id}
    API-->>UI: 200 OK (persisted session detail)
    UI-->>User: Display results (auto-saved to history; cards link to watchlist detail)
    Note over User: Session persisted with full audit trail
```

---

## Diagram Index

| Diagram | Primary Reference Docs | Key API Endpoints |
|---------|------------------------|-------------------|
| §1 Import & Enrichment | Architecture §7, PRD §5 | `POST /import` |
| §2 Status Polling | Architecture §7, PRD §5 | `GET /import/{job_id}/status` |
| §3 Per-Film Enrichment | Architecture §7–12, DB §4.2–4.5 | — (background) |
| §4 Match Review | Architecture §19, PRD §5 | `GET /films/review-required`, `POST /reviews/{id}/accept`, `POST /reviews/{id}/reject` |
| §5 Manual Sync | Architecture §18, PRD §6 | `POST /sync/csv` |
| §6 RSS Sync | Architecture §18, PRD §6, DB §4.13 | `PUT /sync/rss`, `GET /sync/rss/status` |
| §7 Profile Caching | Architecture §13–14, PRD §12 | — (internal) |
| §8 Recommendation Pipeline | Architecture §15, PRD §13, DB §9 | `POST /recommendations` |
| §9 History | PRD §17, API §8 | `GET /recommendations`, `GET /recommendations/{id}` |
| §10 Developer Mode | Architecture §21, PRD §20, API §9 | `GET /dev/...` |
| §11 First-Time User | PRD §4 | Multiple |
