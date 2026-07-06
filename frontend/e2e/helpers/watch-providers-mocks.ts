import type { Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

export const WATCH_PROVIDERS_FILM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const WATCH_PROVIDERS_SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const filmDetailWithTmdb = {
  id: WATCH_PROVIDERS_FILM_ID,
  title: "The Matrix",
  year: 1999,
  letterboxd_uri: "https://letterboxd.com/film/the-matrix/",
  status: "active",
  enrichment_status: "ready",
  metadata: {
    tmdb_id: 603,
    imdb_id: "tt0133093",
    original_title: "The Matrix",
    runtime: 136,
    synopsis: "A computer hacker learns about the true nature of reality.",
    genres: ["Action", "Science Fiction"],
    keywords: ["artificial reality"],
    original_language: "en",
    country: "US",
    director: "Lana Wachowski",
    tmdb_rating: 8.7,
    rotten_tomatoes_score: 88,
    letterboxd_rating: 4.2,
    poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    backdrop_url: null,
    match_confidence: 1.0,
    metadata_source: "tmdb",
  },
  semantic_profile: null,
  created_at: "2024-11-01T14:30:00Z",
  updated_at: "2024-11-01T15:00:00Z",
};

const populatedWatchProviders = {
  film_id: WATCH_PROVIDERS_FILM_ID,
  tmdb_id: 603,
  country_code: "GB",
  link: "https://www.themoviedb.org/movie/603/watch?locale=GB",
  categories: [
    {
      type: "flatrate",
      label: "Stream",
      providers: [
        {
          provider_id: 8,
          provider_name: "Netflix",
          logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
          display_priority: 1,
        },
        {
          provider_id: 337,
          provider_name: "Disney Plus",
          logo_url: "https://image.tmdb.org/t/p/w92/disney.jpg",
          display_priority: 2,
        },
      ],
    },
  ],
};

const emptyWatchProviders = {
  ...populatedWatchProviders,
  categories: [],
};

const recommendationDetail = {
  session_id: WATCH_PROVIDERS_SESSION_ID,
  profile_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  profile_cache_hit: false,
  winner: {
    film_id: WATCH_PROVIDERS_FILM_ID,
    title: "The Matrix",
    year: 1999,
    runtime: 136,
    director: "Lana Wachowski",
    synopsis: "A computer hacker learns about the true nature of reality.",
    letterboxd_rating: 4.2,
    tmdb_rating: 8.7,
    rotten_tomatoes_score: 88,
    poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    explanation: {
      why_it_matches: "Strong sci-fi alignment.",
      most_influential_factors: ["theme fit"],
      why_it_beat_alternatives: "Best match.",
      caveats: null,
    },
  },
  runners_up: [],
  constraint_relaxation: null,
  created_at: "2024-11-01T14:30:00Z",
};

function apiPattern(path: string): string {
  return `**${API_PATH_PREFIX}${path}`;
}

export async function mockWatchProvidersFilmDetail(
  page: Page,
  options?: { empty?: boolean },
): Promise<void> {
  const watchProviders = options?.empty ? emptyWatchProviders : populatedWatchProviders;

  await page.route(apiPattern(`/films/${WATCH_PROVIDERS_FILM_ID}`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(filmDetailWithTmdb),
    });
  });

  await page.route(
    apiPattern(`/films/${WATCH_PROVIDERS_FILM_ID}/watch-providers`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(watchProviders),
      });
    },
  );
}

export async function mockWatchProvidersResults(page: Page): Promise<void> {
  await mockWatchProvidersFilmDetail(page);

  await page.route(
    apiPattern(`/recommendations/${WATCH_PROVIDERS_SESSION_ID}`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(recommendationDetail),
      });
    },
  );
}
