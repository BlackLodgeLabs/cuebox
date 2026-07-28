import { expect, test, type Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";
export const CEREMONY_SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const CEREMONY_WINNER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
export const CEREMONY_RUNNER_ID = "11111111-1111-4111-8111-111111111111";

const ceremonyDetail = {
  session_id: CEREMONY_SESSION_ID,
  profile_id: "22222222-2222-4222-8222-222222222222",
  profile_cache_hit: false,
  winner: {
    film_id: CEREMONY_WINNER_ID,
    title: "Ceremony Winner",
    year: 1973,
    runtime: 120,
    director: "Robin Hardy",
    synopsis: "A police sergeant investigates a missing girl on a remote island.",
    letterboxd_rating: 4.0,
    tmdb_rating: 7.5,
    rotten_tomatoes_score: 89,
    poster_url: null,
    explanation: {
      why_it_matches: "Folk horror atmosphere matches your mood.",
      most_influential_factors: ["theme fit", "pacing"],
      why_it_beat_alternatives: "Stronger ritual tone than runners-up.",
      caveats: "May feel slow early on.",
    },
  },
  runners_up: [
    {
      film_id: CEREMONY_RUNNER_ID,
      title: "Ceremony Runner",
      year: 1980,
      runtime: 100,
      director: "Runner Director",
      synopsis: "Runner synopsis should stay off stage 2.",
      letterboxd_rating: 3.5,
      tmdb_rating: 6.8,
      rotten_tomatoes_score: 70,
      poster_url: null,
      explanation: {
        why_it_matches: "Close alternative with overlapping vibes.",
        most_influential_factors: ["semantic fit"],
        why_it_beat_alternatives: null,
        caveats: null,
      },
    },
  ],
  constraint_relaxation: null,
  created_at: "2024-11-01T14:30:00Z",
  profile_summary: {
    narrative_profile: "You asked for atmospheric folk horror.",
    structured_profile: { genres: ["Horror"] },
  },
};

function apiPattern(path: string): string {
  return `**${API_PATH_PREFIX}${path}`;
}

export async function mockCeremonySession(page: Page): Promise<void> {
  await page.route(
    apiPattern(`/recommendations/${CEREMONY_SESSION_ID}`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ceremonyDetail),
      });
    },
  );

  await page.route(
    apiPattern(`/films/${CEREMONY_WINNER_ID}/watch-providers`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          film_id: CEREMONY_WINNER_ID,
          tmdb_id: 1,
          country_code: "GB",
          link: null,
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
              ],
            },
          ],
        }),
      });
    },
  );

  await page.route(
    apiPattern(`/films/${CEREMONY_RUNNER_ID}/watch-providers`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          film_id: CEREMONY_RUNNER_ID,
          tmdb_id: 2,
          country_code: "GB",
          link: null,
          categories: [],
        }),
      });
    },
  );
}
