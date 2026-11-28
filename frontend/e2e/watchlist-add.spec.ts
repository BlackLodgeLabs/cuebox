import { expect, test } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

const searchResults = {
  data: [
    {
      tmdb_id: 603,
      title: "The Matrix",
      original_title: "The Matrix",
      year: 1999,
      overview: "A computer hacker learns about the true nature of reality.",
      poster_url: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0, has_more: false },
};

const addedFilmId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test.describe("watchlist add flow (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films?limit=1**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "seed-film", title: "Seed Film" }],
          pagination: { total: 12, limit: 1, offset: 0, has_more: true },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films?on_watchlist=true**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "seed-film", title: "Seed Film" }],
          pagination: { total: 12, limit: 1, offset: 0, has_more: true },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/review-required**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 1, offset: 0, has_more: false },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films?statuses=**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/reviews/pending-count**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metadata_count: 0,
          watch_review_count: 0,
          total: 0,
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/health**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          database: "ok",
          version: "test",
          providers: {},
        }),
      });
    });
  });

  test("add and search paths open the header search card", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films/tmdb-search**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(searchResults),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/watchlist/films`, async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          film_id: addedFilmId,
          enrichment_status: "enriching",
        }),
      });
    });

    let filmPolls = 0;
    await page.route(`**${API_PATH_PREFIX}/films/${addedFilmId}`, async (route) => {
      filmPolls += 1;
      const status = filmPolls >= 2 ? "ready" : "enriching";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: addedFilmId,
          title: "The Matrix",
          year: 1999,
          letterboxd_uri: "https://letterboxd.com/film/the-matrix/",
          status: "active",
          enrichment_status: status,
          metadata: null,
          semantic_profile: null,
          watches: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/watchlist/add");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
  });

  test("home shows the daily feature actions without the old hub", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films?**`, async (route) => {
      const url = new URL(route.request().url());
      const active = url.searchParams.get("status") === "active";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: active
            ? [
                {
                  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  title: "The Wicker Man",
                  year: 1973,
                  status: "active",
                  enrichment_status: "ready",
                  runtime: 88,
                  genres: ["Folk horror"],
                  tones: ["dread"],
                  emotional_outcomes: ["unease"],
                  synopsis: "A devout policeman lands on a Hebridean island.",
                  poster_url: null,
                  backdrop_url: null,
                  letterboxd_uri: "https://letterboxd.com/film/the-wicker-man/",
                  created_at: "2024-01-01T00:00:00Z",
                  updated_at: "2024-01-01T00:00:00Z",
                },
              ]
            : [],
          pagination: {
            total: active ? 1 : 0,
            limit: 20,
            offset: 0,
            has_more: false,
          },
        }),
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The Wicker Man" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get a pick for tonight" })).toHaveAttribute(
      "href",
      "/recommend",
    );
    await expect(page.getByRole("button", { name: "Surprise me" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "History" })).toHaveCount(0);
  });

  test("watchlist page shows add button to /search", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.goto("/watchlist");
    await expect(page.getByRole("link", { name: "Add film" })).toHaveAttribute(
      "href",
      "/search",
    );
  });
});
