# Film Picker Product Requirements Document (PRD)

Version 2.1

---

## 1. Product Overview

### Purpose

Film Picker is a locally hosted, single-user application that helps users decide what to watch from their existing Letterboxd watchlist.

The application does not discover new films.

All recommendations must be selected exclusively from films currently present in the user's active watchlist.

The goal is to reduce decision paralysis by combining:

- User preferences
- Film metadata
- Semantic enrichment
- Recommendation scoring
- LLM-assisted ranking

to produce a highly relevant recommendation for the user's current mood.

---

### Core Product Philosophy

Film Picker should behave like a trusted film-loving friend rather than a deterministic search engine.

The objective is:

> Help the user choose a film they are likely to enjoy right now.

Not:

> Calculate a single objectively correct answer.

Recommendations may vary between runs if multiple films are similarly suitable.

---

## 2. Product Goals

The application should:

- Help users choose from their watchlist
- Reduce watchlist decision paralysis
- Preserve recommendation history
- Explain recommendation decisions
- Leverage semantic understanding rather than genre matching alone
- Keep Letterboxd as the source of truth for watchlist state and watch status

---

## 3. User Type

Single user only.

No authentication is required.

The application assumes one user owns the installation and all stored data.

Multi-user support is out of scope.

---

## 4. Core User Journeys

### First-Time User

1. Launch application
2. Upload Letterboxd watchlist CSV
3. Import returns immediately; enrichment begins asynchronously in the background
4. User monitors enrichment progress via a status view (poll-based)
5. Match films to metadata providers
6. Resolve ambiguous matches if required
7. Once enrichment is complete, begin recommendation flow

---

### Returning User

1. Launch application
2. Choose:
   - New Recommendation
   - View Recommendation History

---

### Recommendation Flow

1. Answer recommendation questions
2. Provide optional free-text notes
3. Generate recommendation
4. Review winner and runners-up
5. Save recommendation automatically

---

## 5. Watchlist Import

### Input

Letterboxd watchlist CSV export.

Expected fields:

- Date
- Title
- Year
- Letterboxd URI

---

### Requirements

System must:

- Validate CSV format
- Return immediately with an import job ID
- Begin metadata matching and enrichment asynchronously
- Expose a `/import/{job_id}/status` endpoint for progress polling
- Display import summary and failures once complete
- Detect duplicates
- Support watchlists up to 500 films

---

### Enrichment Status

Films move through the following enrichment states, stored on the `films` record:

- `pending` — awaiting metadata matching
- `matching` — metadata lookup in progress
- `review_required` — low-confidence match needs user resolution
- `enriching` — semantic enrichment and embedding generation in progress
- `ready` — fully enriched and eligible for recommendation
- `failed` — enrichment failed; retryable

Films in any state other than `ready` are excluded from recommendations.

---

### Metadata Matching

**High Confidence Match**

Automatically accepted.

**Medium Confidence Match**

Accepted and flagged for review.

**Low Confidence Match**

Requires user review before the film becomes eligible for recommendations.

**Unresolved Match**

Film remains stored but excluded from recommendations until resolved.

---

## 6. Synchronisation

### Source Of Truth

Letterboxd is always the source of truth for:

- Watchlist membership
- Watch status

Local storage acts as a cache and enrichment layer.

---

### Manual Synchronisation

User uploads a fresh CSV export.

System performs:

- Additions
- Removals
- Updates

---

### RSS Synchronisation

User provides Letterboxd username.

System polls RSS feed every 15 minutes.

Supported events:

- Watchlist additions
- Watchlist removals
- Logged/watched films

---

### Film Lifecycle

**Active**

Fully enriched and eligible for recommendation.

**Watched**

Excluded from future recommendations.

**Archived**

Removed from watchlist. Retains:

- Metadata
- Recommendation history
- Semantic enrichment
- Watch status

Automatically restored to active if re-added to the watchlist.

---

## 7. Metadata Enrichment

### Primary Source

TMDB

### Secondary Source

OMDb

---

### Stored Metadata

**Identification**

- TMDB ID
- IMDB ID
- Letterboxd URI

**Core Metadata**

- Title
- Original Title
- Runtime
- Release Year
- Synopsis

**Classification**

- Genres (JSONB)
- Keywords (JSONB)
- Original Language
- Country

**Crew**

- Director

**Ratings**

- TMDB Rating
- Rotten Tomatoes Score
- Letterboxd Rating

**Assets**

- Poster URL
- Backdrop URL

---

## 8. Subtitle Handling

Subtitle preference is captured in the recommendation questionnaire with the following options:

- Yes
- No
- No preference

Because subtitle availability data is not reliably available from TMDB, `original_language` is used as a proxy. Films with a non-English `original_language` are treated as likely to require subtitles.

When the user selects **No**, films with a non-English original language are excluded during Stage 1 hard constraint filtering.

When the user selects **Yes** or **No preference**, no language-based filtering is applied.

This is a known approximation. English-language films with optional subtitles and dubbed foreign films are out of scope for now.

---

## 9. Semantic Enrichment

Semantic enrichment is a first-class architectural component.

It is generated once and persisted indefinitely.

Recommendation generation should never require re-enrichment.

---

### Inputs

- Synopsis
- Genres
- Keywords
- Director
- Runtime
- Ratings

---

### Outputs

**Themes**

Examples: Obsession, Grief, Identity

**Subgenres**

Examples: Folk Horror, Psychological Horror, Body Horror

**Tone Descriptors**

Examples: Bleak, Surreal, Hopeful

**Emotional Outcomes**

Examples: Inspired, Disturbed, Comforted

**Visual Descriptors**

Examples: Gritty, Arty, Cozy

**Viewing Contexts**

Examples: Solo Viewing, Group Viewing

**Numerical Scores**

- Complexity
- Pacing
- Energy
- Obscurity

**Semantic Summary**

Natural-language summary used for embedding generation.

---

### Semantic Versioning

Every semantic profile stores:

- `semantic_version`
- `generated_by_model`
- `generated_at`

---

## 10. Embeddings

### Film Embeddings

Generated once per film.

Inputs:

- Synopsis
- Genres
- Keywords
- Semantic enrichment
- Semantic summary

Stored indefinitely.

---

### Multi-Embedding Support

Architecture must support:

- `semantic`
- `synopsis`
- `theme`

Initial implementation only requires:

- `semantic`

---

## 11. Recommendation Questionnaire

Questions are presented one at a time.

---

**Q1 Genre**

Multi-select. Hierarchy: Genre → Subgenre → Microgenre. No Preference allowed.

**Q2 Runtime**

Options: ≤90 mins / ≤120 mins / ≤150 mins / All the time in the world

**Q3 Viewing Context**

Options: Solo / With others

**Q4 Thinking Effort**

Options: Brain-off entertainment / Follow a decent plot / Complex puzzle

**Q5 Pacing**

Options: Slow burn / Balanced / Fast paced / No preference

**Q6 Emotional Outcome**

Multi-select. Examples: Inspired, Comforted, Terrified, Mind-blown, Emotionally wrecked, Amused. No preference allowed.

**Q7 Visual/Tonal Vibe**

Multi-select. Examples: Gritty, Bright, Cozy, Arty. No preference allowed.

**Q8 Era Preference**

Options: Current (2020s) / Modern Classics / Vintage / No preference

**Q9 Subtitle Preference**

Options: Yes / No / No preference

**Q10 Obscurity Preference**

Options: Mainstream / Hidden Gems / Obscure / No preference

**Additional Notes**

Optional free-text input.

Example: *I'm enjoying cheesy 80s horror films lately.*

---

## 12. Recommendation Profile Service

The Recommendation Profile Service is the central recommendation component.

The recommendation engine never directly consumes questionnaire answers. It consumes recommendation profiles.

Recommendation profiles are created independently of sessions. A session references a profile via `profile_id`. This supports profile caching across sessions — identical questionnaire answers reuse an existing profile and its embedding.

---

### Responsibilities

- Transform questionnaire responses
- Interpret free-text notes
- Generate recommendation profile
- Generate recommendation embedding

---

### Outputs

**Structured Profile**

Machine-readable representation.

**Narrative Profile**

Human-readable semantic description.

Example: *Slow-burn atmospheric horror with immersive visuals, emotional unease and a sense of dread.*

**Embedding Vector**

Used for candidate retrieval.

---

### Profile Caching

Profiles are canonicalized and hashed before lookup.

Normalization rules:

- Sort arrays
- Remove empty values and nulls
- Normalize case and whitespace
- Sort object keys recursively

System stores:

- `profile_hash`
- `embedding`
- `embedding_model`
- `embedding_version`

Duplicate profiles reuse cached embeddings. No new embedding call is made.

---

## 13. Recommendation Pipeline

### Stage 1: Hard Constraint Filtering

Remove:

- Watched films
- Archived films
- Films with `enrichment_status` other than `ready`
- Runtime violations
- Language/subtitle violations (non-English films when user selects "No" to subtitles)

If too few candidates pass filtering, constraints may be relaxed. Any relaxation is recorded in `constraint_relaxation` on the session as a JSONB object describing which constraints were loosened and by how much.

---

### Stage 2: Semantic Candidate Retrieval

Generate recommendation embedding.

Perform vector similarity search.

Candidate limit must be configurable.

Example:

```
recommendation:
  retrieval_candidate_limit: 100
```

---

### Stage 3: Structured Scoring

Deterministic scoring signals:

- Theme fit
- Emotional fit
- Complexity fit
- Pacing fit
- Era fit
- Obscurity fit
- Viewing context fit
- Recommendation history

All score breakdowns are persisted.

---

### Stage 4: Diversity Adjustment

Signals:

- Recommendation count
- Winner count
- Last recommendation timestamp

Apply:

- Exposure penalties
- Freshness bonuses

---

### Stage 5: Controlled Stochastic Selection

Among similarly scored candidates:

- Weighted candidate selection is permitted
- Diversity-adjusted candidates may be promoted

Goal: reduce recommendation stagnation and encourage discovery.

---

### Stage 6: LLM Ranking

Input:

- User profile
- Candidate metadata
- Semantic enrichment
- Candidate scores

Output:

- Winner
- Four runners-up
- Structured explanations
- Trade-offs
- Caveats

The LLM may reorder candidates and promote lower-scoring candidates when justified.

---

## 14. Scoring Configuration

Scoring weights must be configurable.

Signals:

- Theme Fit
- Emotional Fit
- Pacing Fit
- Complexity Fit
- Era Fit
- Obscurity Fit
- Viewing Context Fit
- Diversity Adjustment

System stores `scoring_version` and `weight_set` with every session. Developer Mode exposes both values.

---

## 15. Provider Configuration

All provider configuration is managed via a `config.yaml` file mounted into the API container.

This includes:

- Active provider per role (embedding, semantic enrichment, ranking)
- Model selection per provider
- API keys per provider
- Any provider-specific parameters

API keys must not be committed to version control. The `config.yaml` path should be excluded from the repository and documented in `.env.example` or equivalent.

---

## 16. Results Screen

### Winner

- Poster
- Title
- Year
- Runtime
- Director
- Synopsis (film overview from metadata)
- TMDB Rating
- Rotten Tomatoes Score

### Structured Explanation

- Why It Matches
- Most Influential Factors
- Why It Beat Alternatives
- Caveats & Trade-Offs

### Runners-Up

Four alternatives, each with poster, metadata (including TMDB and Rotten Tomatoes scores), and explanation.

### Navigation

Each result card (winner and runners-up) links to the corresponding watchlist film detail view (`/watchlist/[filmId]`).

### Answer Summary

User can review questionnaire answers and additional notes via a modal, drawer, or expandable section.

---

## 17. Recommendation History

History is retained indefinitely. No automatic pruning.

---

### Stored Data

- Recommendation profile (structured + narrative)
- Candidate set with full score breakdowns
- Winner and runners-up
- Explanations
- Retrieval information
- Model and version metadata

Note: raw questionnaire answers are not stored separately. The structured profile is the authoritative record of user intent for auditability purposes.

---

### History View

Card-based interface displaying:

- Winner poster
- Winner title
- Year
- Recommendation date
- Preference summary

Selecting a card reopens the original recommendation results. On the results and history detail views, each recommended film card (winner and runners-up) links to that film’s watchlist detail page.

### Search & Filtering

Search by winner title. Filter by date and watch status.

---

## 18. Auditability

Recommendation history must be fully auditable. Every session stores:

- Recommendation profile (structured + narrative)
- Embedding model and version
- Semantic version
- Scoring version and weight set
- Ranking provider, model, and prompt version
- Constraint relaxation record

---

## 19. Recommendation Observability

For every recommendation candidate store:

- Retrieval rank
- Similarity score
- Raw score
- Final score
- LLM rank
- Score breakdown

---

## 20. Developer Mode

Developer Mode is optional and hidden from normal users.

**Retrieval:** recommendation profile, narrative profile, embedding metadata, candidate similarity scores.

**Scoring:** individual scoring factors, weightings, diversity adjustments, final rankings.

**AI:** semantic provider, embedding provider, ranking provider, models used, prompt versions, token usage.

**Metadata:** match confidence, source attribution.

---

## 21. Non-Functional Requirements

**Hosting:** local deployment only, Docker Compose supported.

**Database:** PostgreSQL with pgvector extension.

**Watchlist Size:** up to 500 active films.

**Recommendation Generation:** target < 30 seconds.

**History Loading:** target < 2 seconds.

**Import:** returns immediately. Enrichment completes asynchronously; no fixed SLA, progress is poll-visible.

---

## 22. Future Expansion

The architecture should support future additions without redesign:

- Conversational recommendations
- Similar-film exploration
- Watchlist clustering
- Recommendation collections
- Offline recommendation generation
- Alternative ranking engines
- Local embedding models
- Semantic search

---

## 23. Success Criteria

The system is complete when:

1. Watchlists import successfully and return immediately with a job ID.
2. Enrichment status is poll-visible per film and per job.
3. Metadata enrichment succeeds.
4. Semantic enrichment is generated and persisted.
5. Semantic profiles are versioned.
6. Film embeddings are generated and stored.
7. Recommendation profiles are created independently of sessions.
8. Sessions reference profiles via `profile_id`.
9. Recommendation profile embeddings are cached by profile hash.
10. Candidate retrieval uses vector similarity.
11. Retrieval traces are stored.
12. Recommendations come exclusively from films with `enrichment_status = ready`.
13. Subtitle filtering uses `original_language` as proxy; behaviour matches questionnaire selection.
14. Recommendation history is auditable via stored profile and version metadata.
15. RSS synchronization updates watchlist state.
16. Developer Mode exposes recommendation internals.
17. Recommendation generation completes within 30 seconds.
18. Users receive one winner and four runners-up with structured reasoning.
19. All recommendation decisions are explainable and traceable.
20. Archived films retain metadata and recommendation history.
21. Watched films are excluded from future recommendations.
22. Provider changes require only `config.yaml` edits, not code changes.
23. Constraint relaxation is recorded as a JSONB object on the session.
24. The recommendation system promotes variety while remaining explainable.
