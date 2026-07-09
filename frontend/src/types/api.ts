export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_CSV_FORMAT"
  | "WATCHLIST_SIZE_EXCEEDED"
  | "NO_PREFERENCE_CONFLICT"
  | "ENRICHMENT_NOT_READY"
  | "INSUFFICIENT_CANDIDATES"
  | "PROVIDER_ERROR"
  | "UNPROCESSABLE"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[] | null;
}

export interface ErrorResponse {
  error: ErrorBody;
}

export type HealthStatus = "ok" | "error";

export interface HealthProviders {
  embedding: HealthStatus;
  semantic_enrichment: HealthStatus;
  ranking: HealthStatus;
}

export interface HealthResponse {
  status: "ok";
  database: HealthStatus;
  providers: HealthProviders;
  version: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export type ImportJobStatus = "running" | "complete" | "failed";

export interface ImportFailureSummaryItem {
  letterboxd_uri: string;
  reason: string;
}

export interface ImportJobResponse {
  job_id: string;
  status: ImportJobStatus;
  created_at: string;
}

export interface ImportStatusResponse {
  job_id: string;
  status: ImportJobStatus;
  total_films: number | null;
  processed_films: number;
  failed_films: number;
  duplicate_films: number;
  failure_summary: ImportFailureSummaryItem[] | null;
  created_at: string;
  completed_at: string | null;
}

export type FilmStatus = "active" | "watched" | "archived";

export interface FilmSummary {
  id: string;
  title: string;
  year: number | null;
  letterboxd_uri: string;
  status: FilmStatus;
  enrichment_status: string;
  poster_url: string | null;
  director: string | null;
  runtime: number | null;
  genres: string[];
  created_at: string;
  updated_at: string;
}

export interface FilmMetadataBlock {
  tmdb_id: number | null;
  imdb_id: string | null;
  original_title: string | null;
  runtime: number | null;
  synopsis: string | null;
  genres: string[];
  keywords: string[];
  original_language: string | null;
  country: string | null;
  director: string | null;
  tmdb_rating: number | null;
  rotten_tomatoes_score: number | null;
  letterboxd_rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  match_confidence: number | null;
  metadata_source: string | null;
}

export interface SemanticProfileBlock {
  subgenres: string[];
  themes: string[];
  tones: string[];
  visual_descriptors: string[];
  emotional_outcomes: string[];
  viewing_contexts: string[];
  complexity: number | null;
  pacing: number | null;
  energy: number | null;
  obscurity: number | null;
  semantic_summary: string | null;
  semantic_version: string;
  generated_by_model: string;
  generated_at: string;
}

export interface FilmDetail {
  id: string;
  title: string;
  year: number | null;
  letterboxd_uri: string;
  status: FilmStatus;
  enrichment_status: string;
  metadata: FilmMetadataBlock | null;
  semantic_profile: SemanticProfileBlock | null;
  created_at: string;
  updated_at: string;
}

export interface WatchProviderItem {
  provider_id: number;
  provider_name: string;
  logo_url: string | null;
  display_priority: number;
}

export type WatchProviderCategoryType = "flatrate" | "rent" | "buy" | "ads";

export interface WatchProviderCategory {
  type: WatchProviderCategoryType;
  label: "Stream" | "Rent" | "Buy" | "Free with Ads";
  providers: WatchProviderItem[];
}

export interface FilmWatchProvidersResponse {
  film_id: string;
  tmdb_id: number;
  country_code: string;
  link: string | null;
  categories: WatchProviderCategory[];
}

export interface CandidatePayload {
  tmdb_id: number;
  title: string;
  year: number | null;
  director: string | null;
  poster_url: string | null;
}

export interface ReviewRequiredFilm {
  film_id: string;
  title: string;
  year: number | null;
  letterboxd_uri: string;
  review_id: string;
  review_type: "tmdb_match" | "letterboxd_uri";
  candidate_tmdb_id: number;
  confidence_score: number;
  candidate_payload: CandidatePayload;
  created_at: string;
}

export interface ReviewActionResponse {
  review_id: string;
  film_id: string;
  review_status: "accepted" | "rejected";
  reviewed_at: string;
}

export interface TmdbSearchResultItem {
  tmdb_id: number;
  title: string;
  original_title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
}

export interface TmdbSearchResponse {
  data: TmdbSearchResultItem[];
  pagination: Pagination;
}

export interface TmdbSearchParams {
  q: string;
  year?: number;
  page?: number;
  limit?: number;
}

export interface RematchResponse {
  film_id: string;
  enrichment_status: string;
}

export interface WatchlistAddRequest {
  tmdb_id: number;
}

export interface WatchlistAddResponse {
  film_id: string;
  enrichment_status?: string | null;
  already_on_watchlist?: boolean;
  restored?: boolean;
  review_id?: string | null;
}

export interface ResolveLetterboxdRequest {
  letterboxd_uri: string;
}

export interface SyncFilmSummary {
  film_id: string;
  title: string;
  year: number | null;
}

export interface SyncCsvResponse {
  added: number;
  removed: number;
  watched: number;
  unchanged: number;
  failed: number;
  added_films: SyncFilmSummary[];
  removed_films: SyncFilmSummary[];
  watched_films: SyncFilmSummary[];
}

export interface SyncRssConfigResponse {
  username: string;
  polling_interval_seconds: number;
  configured_at: string;
}

export interface SyncRssStatusResponse {
  configured: boolean;
  username: string | null;
  polling_interval_seconds: number;
  last_polled_at: string | null;
  last_poll_status: "success" | "error" | null;
  events_processed_last_poll: number | null;
}

export type RuntimePreference = "le_90" | "le_120" | "le_150" | "any";
export type ViewingContext = "solo" | "with_others";
export type ThinkingEffort = "brain_off" | "decent_plot" | "complex_puzzle";
export type PacingPreference =
  | "slow_burn"
  | "balanced"
  | "fast_paced"
  | "no_preference";
export type EraPreference =
  | "current"
  | "modern_classics"
  | "vintage"
  | "no_preference";
export type SubtitlePreference = "yes" | "no" | "no_preference";
export type ObscurityPreference =
  | "mainstream"
  | "hidden_gems"
  | "obscure"
  | "no_preference";

export interface Questionnaire {
  genres: string[];
  runtime: RuntimePreference;
  viewing_context: ViewingContext;
  thinking_effort: ThinkingEffort;
  pacing: PacingPreference;
  emotional_outcomes: string[];
  visual_tonal_vibes: string[];
  era: EraPreference;
  subtitle_preference: SubtitlePreference;
  obscurity_preference: ObscurityPreference;
}

export interface CreateRecommendationRequest {
  questionnaire: Questionnaire;
  notes?: string;
}

export interface FilmExplanation {
  why_it_matches: string;
  most_influential_factors: string[];
  why_it_beat_alternatives: string | null;
  caveats: string | null;
}

export interface FilmResult {
  film_id: string;
  title: string;
  year: number | null;
  runtime: number | null;
  director: string | null;
  synopsis: string | null;
  letterboxd_rating: number | null;
  tmdb_rating: number | null;
  rotten_tomatoes_score: number | null;
  poster_url: string | null;
  explanation: FilmExplanation;
}

export type ConstraintRelaxation = Record<
  string,
  { original?: number; relaxed_to?: number; relaxed?: boolean }
>;

export interface RecommendationResponse {
  session_id: string;
  profile_id: string;
  profile_cache_hit: boolean;
  winner: FilmResult;
  runners_up: FilmResult[];
  constraint_relaxation: ConstraintRelaxation | null;
  created_at: string;
}

export interface ProfileSummary {
  narrative_profile: string;
  structured_profile: Record<string, unknown>;
}

export interface RecommendationDetailResponse extends RecommendationResponse {
  profile_summary?: ProfileSummary;
}

export type WatchStatusFilter = "watched" | "unwatched";

export interface HistoryCard {
  session_id: string;
  winner_film_id: string | null;
  winner_title: string;
  winner_year: number | null;
  winner_poster_url: string | null;
  winner_watch_status: FilmStatus | null;
  preference_summary: string;
  created_at: string;
}

export type FilmSortField = "title" | "year" | "created_at" | "enrichment_status";
export type SortDirection = "asc" | "desc";

export interface FilmsQueryParams {
  status?: FilmStatus;
  enrichment_status?: string;
  on_watchlist?: boolean;
  search?: string;
  year?: number;
  year_from?: number;
  year_to?: number;
  created_from?: string;
  created_to?: string;
  sort?: FilmSortField;
  sort_dir?: SortDirection;
  limit?: number;
  offset?: number;
}

export interface ReviewRequiredQueryParams {
  limit?: number;
  offset?: number;
}

export interface HistoryQueryParams {
  search?: string;
  date_from?: string;
  date_to?: string;
  watch_status?: WatchStatusFilter;
  limit?: number;
  offset?: number;
}

export interface DevProfileTrace {
  profile_id: string;
  profile_hash: string;
  structured_profile: Record<string, unknown>;
  narrative_profile: string | null;
  embedding_model: string | null;
  embedding_version: string | null;
  profile_cache_hit: boolean;
}

export interface DevRetrievalCandidate {
  film_id: string;
  title: string;
  retrieval_rank: number | null;
  similarity_score: number | null;
}

export interface DevRetrievalTrace {
  session_id: string;
  profile: DevProfileTrace;
  candidates: DevRetrievalCandidate[];
  retrieval_candidate_limit: number;
  candidates_returned: number;
}

export interface DevScoringCandidate {
  film_id: string;
  title: string;
  raw_score: number | null;
  final_score: number | null;
  llm_rank: number | null;
  score_breakdown: Record<string, number>;
}

export interface DevScoringDetail {
  session_id: string;
  scoring_version: string | null;
  weight_set: string | null;
  weights: Record<string, number>;
  candidates: DevScoringCandidate[];
}

export interface DevAIDetail {
  session_id: string;
  semantic_enrichment: {
    provider: string;
    model: string;
    semantic_version: string | null;
  };
  embedding: {
    provider: string;
    model: string;
    embedding_version: string | null;
  };
  ranking: {
    provider: string;
    model: string;
    prompt_version: string | null;
    tokens_input: number | null;
    tokens_output: number | null;
  };
}

export interface DevFilmMatch {
  film_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  match_confidence: number | null;
  metadata_source: string | null;
  enrichment_status: string;
}

export interface DevSystemVersionEntry {
  artifact_type: string;
  artifact_name: string;
  version: string;
  active: boolean;
  created_at: string;
}

export interface DevSystemVersions {
  versions: DevSystemVersionEntry[];
}
