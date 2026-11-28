import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const FIXTURES = path.join(process.cwd(), "e2e/fixtures");

const API_PATH_PREFIX = "/api/v1";
const SHOT_DIR = "/opt/cursor/artifacts";

const films = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "The Wicker Man",
    year: 1973,
    letterboxd_uri: "https://letterboxd.com/film/the-wicker-man/",
    status: "active",
    enrichment_status: "ready",
    tmdb_id: 11453,
    poster_url: "https://fixtures.local/poster-wicker.png",
    director: "Robin Hardy",
    runtime: 88,
    genres: ["Folk horror"],
    tones: ["ritual", "dread"],
    emotional_outcomes: ["unease"],
    synopsis:
      "A devout policeman lands on a Hebridean island where May Day comes with a sacrifice.",
    backdrop_url: "https://fixtures.local/backdrop.png",
    latest_score: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "The Witch",
    year: 2015,
    letterboxd_uri: "https://letterboxd.com/film/the-witch/",
    status: "active",
    enrichment_status: "ready",
    tmdb_id: 310131,
    poster_url: "https://fixtures.local/poster-witch.png",
    director: "Robert Eggers",
    runtime: 92,
    genres: ["Horror"],
    tones: ["folk", "dread"],
    emotional_outcomes: ["unease"],
    synopsis: "A family in the New England wilderness is torn apart by the forces of witchcraft.",
    backdrop_url: "https://fixtures.local/backdrop.png",
    latest_score: null,
    created_at: "2024-02-01T00:00:00Z",
    updated_at: "2024-02-01T00:00:00Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Lamb",
    year: 2021,
    letterboxd_uri: "https://letterboxd.com/film/lamb-2021/",
    status: "active",
    enrichment_status: "ready",
    tmdb_id: 639721,
    poster_url: "https://fixtures.local/poster-lamb.png",
    director: "Valdimar Jóhannsson",
    runtime: 106,
    genres: ["Drama"],
    tones: ["quiet"],
    emotional_outcomes: ["grief"],
    synopsis: "A childless couple adopt something that isn't quite a lamb.",
    backdrop_url: "https://fixtures.local/backdrop.png",
    latest_score: null,
    created_at: "2024-03-01T00:00:00Z",
    updated_at: "2024-03-01T00:00:00Z",
  },
];

async function stubHome(page: Page) {
  await page.route("https://fixtures.local/**", async (route) => {
    const url = route.request().url();
    const file = url.includes("poster-witch")
      ? "poster-witch.png"
      : url.includes("poster-lamb")
        ? "poster-lamb.png"
        : url.includes("poster-wicker")
          ? "poster-wicker.png"
          : "backdrop.png";
    await route.fulfill({ path: path.join(FIXTURES, file), contentType: "image/png" });
  });

  await page.route(`**${API_PATH_PREFIX}/films?**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") !== "active") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
        }),
      });
      return;
    }
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: films.slice(offset, offset + limit),
        pagination: {
          total: films.length,
          limit,
          offset,
          has_more: offset + limit < films.length,
        },
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/films/*/watch-providers**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        film_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tmdb_id: 11453,
        country_code: "GB",
        link: null,
        categories: [
          {
            type: "flatrate",
            label: "Stream",
            providers: [
              {
                provider_id: 9,
                provider_name: "Prime Video",
                logo_url: null,
                display_priority: 1,
              },
            ],
          },
        ],
      }),
    });
  });
}

test.describe("Home redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await stubHome(page);
  });

  test("daily feature, sheets, and rows", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Today's feature · from your watchlist")).toBeVisible();
    await expect(page.getByRole("link", { name: "Get a pick for tonight" })).toHaveAttribute(
      "href",
      "/recommend",
    );
    await expect(page.getByRole("heading", { name: "Folk dread" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Under 90 minutes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See all" }).first()).toBeVisible();

    const feature = films[0];
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    if (fs.existsSync(SHOT_DIR)) {
      await page.screenshot({ path: `${SHOT_DIR}/home-390.png` });
    }

    await page.getByRole("button", { name: "Where to watch" }).click();
    const watch = page.getByRole("dialog").filter({ hasText: "Where to watch" });
    await expect(watch.getByText("Prime Video")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Surprise me" }).click();
    const surprise = page.getByRole("dialog").filter({ hasText: "A suggestion from your watchlist" });
    await expect(surprise).toBeVisible();
    await expect(surprise.getByRole("button", { name: "Another" })).toBeVisible();
    await expect(surprise.getByRole("button", { name: "Where to watch" })).toBeVisible();

    await expect
      .poll(async () => surprise.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");

    if (fs.existsSync(SHOT_DIR)) {
      await page.screenshot({ path: `${SHOT_DIR}/home-surprise-390.png` });
    }

    await surprise.getByRole("button", { name: "Where to watch" }).click();
    const watchFromSurprise = page.getByRole("dialog").filter({ hasText: "Where to watch" });
    await expect(watchFromSurprise.getByText("Prime Video")).toBeVisible();

    expect(feature.title.length).toBeGreaterThan(0);
  });
});
