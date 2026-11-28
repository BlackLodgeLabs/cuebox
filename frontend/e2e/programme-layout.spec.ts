import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WITCH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LAMB_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BURNING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const ART = path.resolve(
  __dirname,
  "../../docs/design/redesign-2026-11/motion/02-recommendation-shuffle/art",
);

const BACKDROP = "https://image.tmdb.org/t/p/w1280/witch-backdrop.jpg";
const POSTER = "https://image.tmdb.org/t/p/w500/witch-poster.jpg";

function film(options: {
  id: string;
  title: string;
  year: number;
  runtime: number;
  genre: string;
  synopsis: string;
  why: string;
  poster: string | null;
  backdrop: string | null;
}) {
  return {
    film_id: options.id,
    title: options.title,
    year: options.year,
    runtime: options.runtime,
    director: null,
    synopsis: options.synopsis,
    letterboxd_rating: null,
    tmdb_rating: null,
    rotten_tomatoes_score: null,
    poster_url: options.poster,
    backdrop_url: options.backdrop,
    genres: [options.genre],
    explanation: {
      why_it_matches: options.why,
      why_it_matches_short: null,
      most_influential_factors: [],
      why_it_beat_alternatives: null,
      caveats: null,
    },
  };
}

function service(filmId: string, name: string) {
  return {
    film_id: filmId,
    tmdb_id: 1,
    country_code: "GB",
    link: null,
    categories: [
      {
        type: "flatrate",
        label: "Stream",
        providers: [
          {
            provider_id: name === "Netflix" ? 8 : 11,
            provider_name: name,
            logo_url: null,
            display_priority: 1,
          },
        ],
      },
    ],
  };
}

const detail = {
  session_id: SESSION_ID,
  profile_id: "22222222-2222-4222-8222-222222222222",
  profile_cache_hit: false,
  winner: film({
    id: WITCH_ID,
    title: "The Witch",
    year: 2015,
    runtime: 92,
    genre: "Folk horror",
    synopsis: "A family is torn apart by the forces of witchcraft.",
    why: "The same folk dread you rated highly in The Wicker Man, in a tighter 92 minutes.",
    poster: POSTER,
    backdrop: BACKDROP,
  }),
  runners_up: [
    film({
      id: LAMB_ID,
      title: "Lamb",
      year: 2021,
      runtime: 106,
      genre: "Folk horror",
      synopsis: "A childless couple adopt something that isn’t quite a lamb.",
      why: "Close.",
      poster: "https://image.tmdb.org/t/p/w500/lamb-poster.jpg",
      backdrop: null,
    }),
    film({
      id: BURNING_ID,
      title: "Burning",
      year: 2018,
      runtime: 148,
      genre: "Mystery",
      synopsis: "A delivery boy, an old friend, and a stranger with a strange hobby.",
      why: "Close.",
      poster: "https://image.tmdb.org/t/p/w500/burning-poster.jpg",
      backdrop: null,
    }),
  ],
  constraint_relaxation: null,
  created_at: "2026-11-14T20:41:00.000Z",
  profile_summary: {
    narrative_profile: "slow, unsettling, under two hours.",
    structured_profile: {},
  },
};

async function fulfillJson(route: { fulfill: (opts: object) => Promise<void> }, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockProgrammeApi(page: Page) {
  await page.route(`**/api/v1/recommendations/${SESSION_ID}`, async (route) => {
    await fulfillJson(route, detail);
  });
  await page.route(`**/api/v1/films/${WITCH_ID}/watch-providers`, async (route) => {
    await fulfillJson(route, service(WITCH_ID, "Netflix"));
  });
  await page.route(`**/api/v1/films/${LAMB_ID}/watch-providers`, async (route) => {
    await fulfillJson(route, service(LAMB_ID, "MUBI"));
  });
  await page.route(`**/api/v1/films/${BURNING_ID}/watch-providers`, async (route) => {
    await fulfillJson(route, service(BURNING_ID, "MUBI"));
  });
  await page.route("https://image.tmdb.org/**", async (route) => {
    const url = route.request().url();
    const file = url.includes("lamb")
      ? "old-house.jpg"
      : url.includes("burning")
        ? "fire-warm.jpg"
        : "witch-forest.jpg";
    await route.fulfill({
      path: path.join(ART, file),
      contentType: "image/jpeg",
    });
  });
}

test.describe("Programme layout (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockProgrammeApi(page);
  });

  test("renders Tonight's programme at 390 × 844", async ({ page }) => {
    await page.goto(`/dev/programme?session=${SESSION_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tonight’s programme" }),
    ).toBeVisible();
    await expect(page.getByText("Sat 14 Nov")).toBeVisible();
    await expect(
      page.getByText("From your pick at 20:41 · slow, unsettling, under two hours"),
    ).toBeVisible();

    const hero = page.getByRole("article", { name: "Your pick" });
    const heroImage = hero.locator("img");
    await expect(heroImage).toHaveAttribute("src", BACKDROP);
    await expect(heroImage).not.toHaveAttribute("src", POSTER);
    await expect(hero).toContainText("2015 · Folk horror · 92m · Netflix");
    await expect(page.getByRole("link", { name: "View your pick" })).toHaveAttribute(
      "href",
      `/watchlist/${WITCH_ID}`,
    );
    await expect(page.getByRole("heading", { name: "Lamb" })).toBeVisible();
    await expect(page.getByText("MUBI").first()).toBeVisible();

    await page.waitForTimeout(800);
    await page.locator("nextjs-portal").evaluateAll((nodes) => {
      for (const node of nodes) node.remove();
    });
    await page.screenshot({
      path: "/opt/cursor/artifacts/programme-tonight-390x844.png",
      fullPage: false,
    });

    await page.getByRole("link", { name: "View your pick" }).click();
    await expect(page).toHaveURL(new RegExp(`/watchlist/${WITCH_ID}`));
  });

  test("renders a past night titled Sat 14 Nov with a History back link", async ({ page }) => {
    await page.goto(`/dev/programme/history?session=${SESSION_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Sat 14 Nov" })).toBeVisible();
    const back = page.getByRole("link", { name: "Back to History" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/history");
    await expect(page.getByRole("time")).toHaveCount(0);
    await expect(page.getByText("The Witch")).toBeVisible();
    await expect(page.getByText("Netflix")).toBeVisible();

    await page.waitForTimeout(800);
    await page.locator("nextjs-portal").evaluateAll((nodes) => {
      for (const node of nodes) node.remove();
    });
    await page.screenshot({
      path: "/opt/cursor/artifacts/programme-history-390x844.png",
      fullPage: false,
    });

    await back.click();
    await expect(page).toHaveURL(/\/history$/);
  });

  test("shows the settled layout at once when reduced motion is on", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/dev/programme?session=${SESSION_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tonight’s programme" }),
    ).toBeVisible();
    const items = page.locator("[data-settle]");
    await expect(items.first()).toHaveAttribute("data-travel", "none");
    await expect(items.first()).toHaveAttribute("data-rise-px", "0");
    const count = await items.count();
    for (let index = 0; index < count; index += 1) {
      await expect(items.nth(index)).toHaveAttribute("data-duration-ms", "0");
      await expect(items.nth(index)).toHaveAttribute("data-delay-ms", "0");
    }
  });
});
