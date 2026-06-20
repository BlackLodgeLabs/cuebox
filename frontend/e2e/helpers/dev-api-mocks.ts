import type { Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

export const DEV_SESSION_ID = "11111111-1111-4111-8111-111111111111";
export const DEV_FILM_ID = "22222222-2222-4222-8222-222222222222";
export const DEV_PROFILE_ID = "33333333-3333-4333-8333-333333333333";

const recommendationDetail = {
  session_id: DEV_SESSION_ID,
  profile_id: DEV_PROFILE_ID,
  profile_cache_hit: false,
  winner: {
    film_id: DEV_FILM_ID,
    title: "The Wicker Man",
    year: 1973,
    runtime: 88,
    director: "Robin Hardy",
    synopsis: "A devoutly Christian police officer investigates a missing girl on a remote island.",
    letterboxd_rating: 4.2,
    tmdb_rating: 7.6,
    rotten_tomatoes_score: 91,
    poster_url: null,
    explanation: {
      why_it_matches: "Atmospheric folk horror aligns with your profile.",
      most_influential_factors: ["theme fit", "pacing fit"],
      why_it_beat_alternatives: "Strongest semantic match.",
      caveats: null,
    },
  },
  runners_up: [],
  constraint_relaxation: null,
  created_at: "2024-11-01T14:30:00Z",
};

const retrievalTrace = {
  session_id: DEV_SESSION_ID,
  profile: {
    profile_id: DEV_PROFILE_ID,
    profile_hash: "a3f2e1d0c4b5a6978865544433221100abcdef1234567890abcdef123456",
    structured_profile: { genres: ["horror"] },
    narrative_profile: "Slow-burn atmospheric folk horror.",
    embedding_model: "text-embedding-3-small",
    embedding_version: "embedding-v1",
    profile_cache_hit: false,
  },
  candidates: [
    {
      film_id: DEV_FILM_ID,
      title: "The Wicker Man",
      retrieval_rank: 1,
      similarity_score: 0.923456,
    },
  ],
  retrieval_candidate_limit: 100,
  candidates_returned: 1,
};

const scoringDetail = {
  session_id: DEV_SESSION_ID,
  scoring_version: "scoring-v1",
  weight_set: "default",
  weights: {
    theme_fit: 0.25,
    emotional_fit: 0.2,
    pacing_fit: 0.15,
    complexity_fit: 0.1,
    era_fit: 0.1,
    obscurity_fit: 0.05,
    viewing_context_fit: 0.05,
    diversity_adjustment: 0.1,
  },
  candidates: [
    {
      film_id: DEV_FILM_ID,
      title: "The Wicker Man",
      raw_score: 0.8812,
      final_score: 0.896,
      llm_rank: 1,
      score_breakdown: {
        theme_fit: 0.92,
        emotional_fit: 0.88,
        pacing_fit: 0.95,
      },
    },
  ],
};

const aiDetail = {
  session_id: DEV_SESSION_ID,
  semantic_enrichment: {
    provider: "openai",
    model: "gpt-4o-mini",
    semantic_version: "semantic-v1",
  },
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    embedding_version: "embedding-v1",
  },
  ranking: {
    provider: "openai",
    model: "gpt-4o",
    prompt_version: "recommendation-v1",
    tokens_input: 4821,
    tokens_output: 1103,
  },
};

const systemVersions = {
  versions: [
    {
      artifact_type: "semantic",
      artifact_name: "semantic-profile",
      version: "semantic-v1",
      active: true,
      created_at: "2024-11-01T12:00:00Z",
    },
  ],
};

function apiPattern(path: string): string {
  return `**${API_PATH_PREFIX}${path}`;
}

export async function mockRecommendationSession(page: Page): Promise<void> {
  await page.route(apiPattern(`/recommendations/${DEV_SESSION_ID}`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationDetail),
    });
  });
}

export async function mockDeveloperModeEnabled(page: Page): Promise<void> {
  await page.route(apiPattern("/dev/system/versions"), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(systemVersions),
    });
  });

  await page.route(
    apiPattern(`/dev/recommendations/${DEV_SESSION_ID}/retrieval`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(retrievalTrace),
      });
    },
  );

  await page.route(
    apiPattern(`/dev/recommendations/${DEV_SESSION_ID}/scoring`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scoringDetail),
      });
    },
  );

  await page.route(
    apiPattern(`/dev/recommendations/${DEV_SESSION_ID}/ai`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(aiDetail),
      });
    },
  );
}

export async function mockDeveloperModeDisabled(page: Page): Promise<void> {
  const disabledPaths = [
    "/dev/system/versions",
    `/dev/recommendations/${DEV_SESSION_ID}/retrieval`,
    `/dev/recommendations/${DEV_SESSION_ID}/scoring`,
    `/dev/recommendations/${DEV_SESSION_ID}/ai`,
  ];

  for (const path of disabledPaths) {
    await page.route(apiPattern(path), async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "NOT_FOUND", message: "Not found" },
        }),
      });
    });
  }
}
