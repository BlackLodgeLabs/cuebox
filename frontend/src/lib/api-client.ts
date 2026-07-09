/**
 * Base API client for Cuebox backend.
 */

import type {
  CreateRecommendationRequest,
  DevAIDetail,
  DevFilmMatch,
  DevRetrievalTrace,
  DevScoringDetail,
  DevSystemVersions,
  ErrorResponse,
  FilmsQueryParams,
  HealthResponse,
  HistoryQueryParams,
  ImportJobResponse,
  ImportStatusResponse,
  PaginatedResponse,
  RecommendationDetailResponse,
  RecommendationResponse,
  ReviewActionResponse,
  ReviewRequiredFilm,
  ReviewRequiredQueryParams,
  RematchResponse,
  ResolveLetterboxdRequest,
  FilmSummary,
  FilmDetail,
  FilmWatchProvidersResponse,
  TmdbSearchParams,
  TmdbSearchResponse,
  WatchlistAddRequest,
  WatchlistAddResponse,
  HistoryCard,
  SyncCsvResponse,
  SyncRssConfigResponse,
  SyncRssStatusResponse,
} from "@/types/api";

/** Same-origin path on client; absolute URL on server for SSR/Server Components. */
const isServer = typeof window === "undefined";
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (isServer
    ? `${process.env.API_UPSTREAM_URL ?? "http://localhost:8000"}/api/v1`
    : "/api/v1");

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: ErrorResponse["error"]["details"];

  constructor(error: ErrorResponse["error"]) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
  }
}

function buildQuery(
  params?: Record<string, string | number | undefined> | object,
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function parseErrorResponse(response: Response): Promise<never> {
  let body: ErrorResponse | undefined;
  try {
    body = (await response.json()) as ErrorResponse;
  } catch {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  if (body?.error) {
    throw new ApiClientError(body.error);
  }

  throw new Error(
    `API request failed: ${response.status} ${response.statusText}`,
  );
}

export async function fetchApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function fetchMultipart<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await parseErrorResponse(response);
  }

  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>("/health");
}

export function postImport(file: File): Promise<ImportJobResponse> {
  return fetchMultipart<ImportJobResponse>("/import", file);
}

export function getImportStatus(jobId: string): Promise<ImportStatusResponse> {
  return fetchApi<ImportStatusResponse>(`/import/${jobId}/status`);
}

export function getFilms(
  params?: FilmsQueryParams,
): Promise<PaginatedResponse<FilmSummary>> {
  return fetchApi<PaginatedResponse<FilmSummary>>(
    `/films${buildQuery(params)}`,
  );
}

export function getFilm(filmId: string): Promise<FilmDetail> {
  return fetchApi<FilmDetail>(`/films/${filmId}`);
}

export function getFilmWatchProviders(
  filmId: string,
  params?: { country?: string },
): Promise<FilmWatchProvidersResponse> {
  return fetchApi<FilmWatchProvidersResponse>(
    `/films/${filmId}/watch-providers${buildQuery(params)}`,
  );
}

export function getReviewRequired(
  params?: ReviewRequiredQueryParams,
): Promise<PaginatedResponse<ReviewRequiredFilm>> {
  return fetchApi<PaginatedResponse<ReviewRequiredFilm>>(
    `/films/review-required${buildQuery(params)}`,
  );
}

export function acceptReview(reviewId: string): Promise<ReviewActionResponse> {
  return fetchApi<ReviewActionResponse>(`/reviews/${reviewId}/accept`, {
    method: "POST",
  });
}

export function rejectReview(reviewId: string): Promise<ReviewActionResponse> {
  return fetchApi<ReviewActionResponse>(`/reviews/${reviewId}/reject`, {
    method: "POST",
  });
}

export function searchTmdbGlobal(
  params: TmdbSearchParams,
): Promise<TmdbSearchResponse> {
  return fetchApi<TmdbSearchResponse>(
    `/films/tmdb-search${buildQuery(params)}`,
  );
}

export function searchTmdb(
  filmId: string,
  params: TmdbSearchParams,
): Promise<TmdbSearchResponse> {
  return fetchApi<TmdbSearchResponse>(
    `/films/${filmId}/tmdb-search${buildQuery(params)}`,
  );
}

export function rematchFilm(
  filmId: string,
  tmdbId: number,
): Promise<RematchResponse> {
  return fetchApi<RematchResponse>(`/films/${filmId}/rematch`, {
    method: "POST",
    body: JSON.stringify({ tmdb_id: tmdbId }),
  });
}

export function addToWatchlist(
  body: WatchlistAddRequest,
): Promise<WatchlistAddResponse> {
  return fetchApi<WatchlistAddResponse>("/watchlist/films", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resolveLetterboxdReview(
  reviewId: string,
  body: ResolveLetterboxdRequest,
): Promise<ReviewActionResponse> {
  return fetchApi<ReviewActionResponse>(
    `/reviews/${reviewId}/resolve-letterboxd`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function postRecommendation(
  body: CreateRecommendationRequest,
): Promise<RecommendationResponse> {
  return fetchApi<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getRecommendation(
  sessionId: string,
): Promise<RecommendationDetailResponse> {
  return fetchApi<RecommendationDetailResponse>(
    `/recommendations/${sessionId}`,
  );
}

export function listRecommendations(
  params?: HistoryQueryParams,
): Promise<PaginatedResponse<HistoryCard>> {
  return fetchApi<PaginatedResponse<HistoryCard>>(
    `/recommendations${buildQuery(params)}`,
  );
}

export function deleteRecommendation(sessionId: string): Promise<void> {
  return fetchApi<void>(`/recommendations/${sessionId}`, { method: "DELETE" });
}

export function postSyncCsv(file: File): Promise<SyncCsvResponse> {
  return fetchMultipart<SyncCsvResponse>("/sync/csv", file);
}

export function putSyncRss(username: string): Promise<SyncRssConfigResponse> {
  return fetchApi<SyncRssConfigResponse>("/sync/rss", {
    method: "PUT",
    body: JSON.stringify({ username }),
  });
}

export function getSyncRssStatus(): Promise<SyncRssStatusResponse> {
  return fetchApi<SyncRssStatusResponse>("/sync/rss/status");
}

export async function probeDevModeEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/dev/system/versions`);
    return response.ok;
  } catch {
    return false;
  }
}

export function getDevRetrieval(sessionId: string): Promise<DevRetrievalTrace> {
  return fetchApi<DevRetrievalTrace>(
    `/dev/recommendations/${sessionId}/retrieval`,
  );
}

export function getDevScoring(sessionId: string): Promise<DevScoringDetail> {
  return fetchApi<DevScoringDetail>(
    `/dev/recommendations/${sessionId}/scoring`,
  );
}

export function getDevAI(sessionId: string): Promise<DevAIDetail> {
  return fetchApi<DevAIDetail>(`/dev/recommendations/${sessionId}/ai`);
}

export function getDevFilmMatch(filmId: string): Promise<DevFilmMatch> {
  return fetchApi<DevFilmMatch>(`/dev/films/${filmId}/match`);
}

export function getDevSystemVersions(): Promise<DevSystemVersions> {
  return fetchApi<DevSystemVersions>("/dev/system/versions");
}
