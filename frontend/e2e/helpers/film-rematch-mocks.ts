import type { Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

export const REMATCH_FILM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEARCH_TMDB_ID = 11453;
const UPDATED_TMDB_ID = 11622;

const failedFilmDetail = {
  id: REMATCH_FILM_ID,
  title: "Wrong Match Film",
  year: 1981,
  letterboxd_uri: "https://letterboxd.com/film/wrong-match/",
  status: "active",
  enrichment_status: "failed",
  metadata: null,
  semantic_profile: null,
  created_at: "2024-11-01T14:30:00Z",
  updated_at: "2024-11-01T15:00:00Z",
};

const enrichingFilmDetail = {
  ...failedFilmDetail,
  enrichment_status: "enriching",
  metadata: {
    tmdb_id: UPDATED_TMDB_ID,
    imdb_id: "tt0081505",
    original_title: "Possession",
    runtime: 124,
    synopsis: "A woman undergoes a terrifying transformation.",
    genres: ["Horror", "Drama"],
    keywords: ["horror"],
    original_language: "en",
    country: "FR",
    director: "Andrzej Żuławski",
    tmdb_rating: 7.2,
    rotten_tomatoes_score: 88,
    letterboxd_rating: null,
    poster_url: "https://image.tmdb.org/t/p/w500/rematch-poster.jpg",
    backdrop_url: null,
    match_confidence: 1.0,
    metadata_source: "tmdb_manual",
  },
  semantic_profile: null,
  updated_at: "2024-11-01T16:00:00Z",
};

const readyFilmDetail = {
  ...enrichingFilmDetail,
  enrichment_status: "ready",
  semantic_profile: {
    subgenres: ["body horror"],
    themes: ["marriage", "madness"],
    tones: ["intense"],
    visual_descriptors: ["claustrophobic"],
    emotional_outcomes: ["disturbed"],
    viewing_contexts: ["solo viewing"],
    complexity: 8.0,
    pacing: 6.0,
    energy: 7.5,
    obscurity: 5.0,
    semantic_summary: "A harrowing psychological horror.",
    semantic_version: "semantic-v1",
    generated_by_model: "gpt-4o-mini",
    generated_at: "2024-11-01T16:05:00Z",
  },
  updated_at: "2024-11-01T16:05:00Z",
};

const searchResults = {
  data: [
    {
      tmdb_id: SEARCH_TMDB_ID,
      title: "The Wicker Man",
      original_title: "The Wicker Man",
      year: 1973,
      overview: "A police officer investigates a missing girl on a remote island.",
      poster_url: "https://image.tmdb.org/t/p/w500/wicker.jpg",
    },
    {
      tmdb_id: UPDATED_TMDB_ID,
      title: "Possession",
      original_title: "Possession",
      year: 1981,
      overview: "A woman undergoes a terrifying transformation.",
      poster_url: "https://image.tmdb.org/t/p/w500/possession.jpg",
    },
  ],
  pagination: {
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
  },
};

const PAGINATED_PAGE_SIZE = 2;
const PAGINATED_TOTAL = 4;

function paginatedSearchResults(page: number) {
  const pages = [
    [
      {
        tmdb_id: 9001,
        title: "Alpha Film",
        original_title: "Alpha Film",
        year: 1970,
        overview: "First page result A.",
        poster_url: "https://image.tmdb.org/t/p/w500/alpha.jpg",
      },
      {
        tmdb_id: 9002,
        title: "Beta Film",
        original_title: "Beta Film",
        year: 1971,
        overview: "First page result B.",
        poster_url: "https://image.tmdb.org/t/p/w500/beta.jpg",
      },
    ],
    [
      {
        tmdb_id: 9003,
        title: "Gamma Film",
        original_title: "Gamma Film",
        year: 1972,
        overview: "Second page result A.",
        poster_url: "https://image.tmdb.org/t/p/w500/gamma.jpg",
      },
      {
        tmdb_id: 9004,
        title: "Delta Film",
        original_title: "Delta Film",
        year: 1973,
        overview: "Second page result B.",
        poster_url: "https://image.tmdb.org/t/p/w500/delta.jpg",
      },
    ],
  ];

  const safePage = Math.min(Math.max(page, 1), pages.length);
  const data = pages[safePage - 1] ?? [];
  const offset = (safePage - 1) * PAGINATED_PAGE_SIZE;

  return {
    data,
    pagination: {
      total: PAGINATED_TOTAL,
      limit: PAGINATED_PAGE_SIZE,
      offset,
      has_more: offset + data.length < PAGINATED_TOTAL,
    },
  };
}

async function mockFilmDetailRoutes(page: Page) {
  let filmState: "failed" | "enriching" | "ready" = "failed";
  let pollsWhileEnriching = 0;

  await page.route(`**${API_PATH_PREFIX}/films/${REMATCH_FILM_ID}/rematch`, async (route) => {
    filmState = "enriching";
    pollsWhileEnriching = 0;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        film_id: REMATCH_FILM_ID,
        enrichment_status: "enriching",
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/films/${REMATCH_FILM_ID}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    if (filmState === "enriching") {
      pollsWhileEnriching += 1;
      if (pollsWhileEnriching >= 3) {
        filmState = "ready";
      }
    }

    const payload =
      filmState === "ready"
        ? readyFilmDetail
        : filmState === "enriching"
          ? enrichingFilmDetail
          : failedFilmDetail;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

export async function mockFilmRematchFlow(page: Page) {
  await mockFilmDetailRoutes(page);

  await page.route(`**${API_PATH_PREFIX}/films/${REMATCH_FILM_ID}/tmdb-search**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(searchResults),
    });
  });
}

export async function mockFilmRematchPaginationFlow(page: Page) {
  await mockFilmDetailRoutes(page);

  await page.route(`**${API_PATH_PREFIX}/films/${REMATCH_FILM_ID}/tmdb-search**`, async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get("page") || "1");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(paginatedSearchResults(requestedPage)),
    });
  });
}

export { UPDATED_TMDB_ID };
