# Cuebox Application Overview

Cuebox helps you decide what to watch from your own Letterboxd watchlist.

It does not search the whole internet for new movies. Instead, it starts with the films you already saved on Letterboxd, fills in useful information about those films, and then recommends one film that fits your current mood. It also shows four runner-up choices so you still have options.

The app runs locally, which means it is designed for one person using it on their own machine.

## What the application does

At a high level, Cuebox works like this:

1. You import your Letterboxd watchlist.
2. Cuebox creates a local record for each film.
3. Cuebox enriches each film with extra information, such as runtime, director, genres, poster art, and a short AI-generated description of the film's themes and mood.
4. You answer a short questionnaire about what kind of film you want right now.
5. Cuebox filters your watchlist to remove films that do not fit hard requirements, such as runtime or subtitle preference.
6. Cuebox scores the remaining films, adds some variety so the same films are not recommended again and again, and asks an LLM to make the final ranked choice.
7. The result is saved so you can review past recommendations later.

## Part 1: Film metadata enrichment

Film metadata enrichment is the process of turning a simple Letterboxd watchlist entry into a richer local film record.

When you first import a Letterboxd CSV, Cuebox only has a few pieces of information:

- Film title
- Release year, if present in the CSV
- Letterboxd URI
- Watchlist membership

That is enough to identify the film, but not enough to make good recommendations. Cuebox therefore adds several layers of extra information.

### What metadata is added

Cuebox stores basic film facts:

- TMDB ID
- IMDb ID
- Original title
- Runtime
- Synopsis
- Genres
- Keywords
- Original language
- Production country
- Director
- TMDB rating
- Rotten Tomatoes score, when available
- Poster image URL
- Backdrop image URL
- Match confidence score
- Metadata source

Cuebox also creates a semantic profile. This is a plain-language description of what the film feels like, not just what genre it belongs to. The semantic profile includes:

- Subgenres, such as "psychological horror" or "neo-noir"
- Themes, such as grief, identity, revenge, or isolation
- Tones, such as bleak, playful, tense, or hopeful
- Visual descriptors, such as dreamlike, gritty, stylish, or restrained
- Emotional outcomes, meaning how the film may leave the viewer feeling
- Viewing contexts, such as better alone or better with others
- Scores from 0 to 10 for complexity, pacing, energy, and obscurity
- A short semantic summary of the film

Finally, Cuebox creates a film embedding. An embedding is a numeric fingerprint of the film's meaning. Cuebox uses it later to find films whose content and mood are close to what you asked for in the questionnaire.

### Where the metadata comes from

Cuebox uses several sources:

| Source | What Cuebox gets from it |
| --- | --- |
| Letterboxd CSV | Title, year, Letterboxd URI, and watchlist membership |
| TMDB | Search matches, runtime, synopsis, genres, original language, country, director, TMDB rating, poster, and backdrop |
| TMDB keywords endpoint | Keyword tags that describe topics or story elements |
| OMDb | Rotten Tomatoes score, when an IMDb ID is available and OMDb is configured |
| Semantic enrichment provider | Themes, tones, emotional outcomes, viewing contexts, complexity, pacing, energy, obscurity, and semantic summary |
| Embedding provider | Numeric vector used for similarity search during recommendations |

TMDB is the main metadata source. Cuebox searches TMDB using the Letterboxd title and year, checks likely matches, and scores the match confidence using title, year, and director information.

If the match confidence is high, Cuebox accepts the match automatically. If the confidence is uncertain, Cuebox creates a review item so the user can accept or reject the match. If the match is rejected or no useful match is found, the film is marked as failed until it is retried or corrected.

After TMDB metadata is saved, Cuebox asks the semantic enrichment provider to describe the film's deeper qualities. The default configuration uses an OpenAI model, but the app is designed so providers can be changed in `config.yaml`.

The semantic enrichment prompt sends the provider:

- Title
- Year
- Director
- Genres
- Keywords
- Synopsis

The provider is expected to return structured JSON containing the semantic fields listed earlier, such as themes, tones, emotional outcomes, and the semantic summary.

After that, Cuebox sends a text summary to the embedding provider. That text includes the synopsis, genres, keywords, themes, and semantic summary. The provider returns a 1536-number vector in the default setup.

### How enrichment is stored

Cuebox stores enriched data in PostgreSQL.

The main storage areas are:

| Storage area | What it stores |
| --- | --- |
| `films` | The core film record: title, year, Letterboxd URI, active/watched/archived status, and enrichment status |
| `watchlist_entries` | Whether a film is currently on the user's active watchlist |
| `film_metadata` | TMDB and OMDb facts, poster/backdrop URLs, ratings, match confidence, and source |
| `metadata_match_reviews` | Matches that need user review before enrichment can continue |
| `film_semantic_profiles` | AI-generated themes, tones, emotional outcomes, viewing contexts, scores, summary, model name, and semantic version |
| `film_embeddings` | The film's numeric embedding vector, embedding model, and embedding version |

Each film moves through enrichment statuses:

| Status | Meaning |
| --- | --- |
| `pending` | Waiting to be enriched |
| `matching` | Cuebox is looking for the film in TMDB |
| `review_required` | Cuebox found a possible match, but the user needs to confirm it |
| `enriching` | Metadata is matched and Cuebox is generating semantic data and an embedding |
| `ready` | The film has everything needed for recommendations |
| `failed` | Enrichment failed and needs attention or retry |

Only films marked `ready` are eligible for recommendations.

## Part 2: Recommendation engine

The recommendation engine turns your current mood into one winner and four runner-up films from your watchlist.

It uses your questionnaire answers, film metadata, semantic profiles, embeddings, previous recommendation history, and a final LLM ranking step.

### What the questionnaire captures

The questionnaire captures:

| Questionnaire field | What it means |
| --- | --- |
| Genres | Broad kinds of films you are open to |
| Runtime | Whether you want a shorter film, a medium-length film, a longer film, or any runtime |
| Viewing context | Whether you are watching alone or with others |
| Thinking effort | Whether you want something easy, moderately involved, or complex |
| Pacing | Slow burn, balanced, fast paced, or no preference |
| Emotional outcomes | How you want the film to leave you feeling |
| Visual and tonal vibes | The kind of mood or style you want |
| Era | Current films, modern classics, vintage films, or no preference |
| Subtitle preference | Whether subtitles are okay, not okay, or not important |
| Obscurity preference | Mainstream, hidden gems, obscure films, or no preference |
| Notes | Optional free-text context, such as "something tense but not too bleak" |

For genres, emotional outcomes, and visual or tonal vibes, "No Preference" must be selected by itself. It cannot be combined with other choices.

Cuebox turns the questionnaire into two internal forms:

- A structured profile, which keeps the answers as organized data.
- A narrative profile, which turns the answers and notes into a short readable description.

Cuebox stores the structured and narrative profile, but it does not store the raw questionnaire as a separate record. It also creates a hash of the normalized profile. If you submit the same preferences again later, Cuebox can reuse the existing profile and embedding instead of generating a duplicate.

### How the questionnaire filters the watchlist

The recommendation process starts with hard filtering. A film must:

- Be on the active watchlist
- Not be marked watched
- Not be archived
- Have enrichment status `ready`
- Have metadata available

Then Cuebox applies questionnaire-based hard filters:

- Runtime: `90 minutes or less`, `120 minutes or less`, `150 minutes or less`, or no limit.
- Subtitle preference: if you choose "No" for subtitles, Cuebox excludes films whose original language is not English.

Subtitle filtering is an approximation. Cuebox does not know every film's actual subtitle availability, so it uses original language as a practical signal.

If too few films survive filtering, Cuebox may relax constraints:

- Runtime can be extended by 30 minutes.
- If subtitle preference removed too many films, the language filter can be relaxed.

When Cuebox relaxes a constraint, it saves that fact with the recommendation session so the result remains explainable.

### How the remaining films are scored

After filtering, Cuebox uses several stages to choose good candidates:

1. Similarity search: Cuebox compares the questionnaire profile embedding with film embeddings and retrieves the closest films.
2. Structured scoring: Cuebox scores each candidate against the profile using theme fit, emotional fit, pacing fit, complexity fit, era fit, obscurity fit, and viewing context fit.
3. Diversity adjustment: Cuebox checks recommendation history and slightly penalizes films that were recently recommended, while giving a freshness boost to films that have not appeared recently.
4. Controlled variety: among similarly strong candidates, Cuebox may promote one candidate from the top score band so results do not become stale.
5. LLM ranking: the LLM makes the final choice from a shortlist.

The scoring weights are configurable in `config.yaml`.

### What information is sent to the LLM

Cuebox uses the LLM at the final ranking stage after filtering, similarity search, scoring, and diversity adjustment have already narrowed the list.

The ranking service sends up to 20 candidates to the ranking provider.

In the current default OpenAI ranking implementation, the LLM receives:

- A system instruction that tells it to pick one winner and up to four runners-up.
- The narrative profile built from the questionnaire and notes.
- The structured questionnaire preferences.
- A candidate list containing each candidate's:
  - Film ID
  - Title
  - Year
  - Final score

The application prepares richer candidate information internally, including runtime, director, genres, semantic summary, raw score, final score, and score breakdown. The current OpenAI prompt keeps the actual LLM payload smaller and sends only the film ID, title, year, and final score for each candidate.

### What the LLM is expected to return

The LLM must return JSON with:

- `winner_film_id`: the chosen film ID
- `runners_up_film_ids`: up to four runner-up film IDs
- `explanations`: explanation details for the winner and runners-up

Each explanation should include:

- `why_it_matches`: why this film fits the viewer's request
- `most_influential_factors`: the main reasons it was selected
- `why_it_beat_alternatives`: why the winner beat the other options
- `caveats`: any useful warning or trade-off, if there is one

Cuebox only accepts film IDs from the candidate list. If the LLM gives an invalid winner or too few runners-up, Cuebox falls back to valid candidates from the shortlist so the response still stays inside the user's watchlist.

### What gets saved after a recommendation

Each recommendation session saves:

- The profile used for the recommendation
- Whether the profile came from cache
- The winner
- The ranking provider and model
- The active semantic, embedding, scoring, and prompt versions
- Any constraint relaxation
- Token usage from the ranking provider, when available
- Every candidate considered, including retrieval rank, similarity score, raw score, final score, LLM rank, and score breakdown
- Winner and runner-up explanations
- Updated exposure counters so future recommendations can account for recent results

This is why Cuebox can show recommendation history and Developer Mode traces later. The app is not just saving the final answer; it is saving enough context to explain how the answer was produced.
