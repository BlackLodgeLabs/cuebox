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
  });

  test("add film search and confirm", async ({ page }) => {
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
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/watchlist/add");
    await page.getByLabel("TMDB search query").fill("Matrix");
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await page.getByText("The Matrix (1999)").click();
    await page.getByRole("button", { name: "Add to watchlist" }).click();
    await expect(page).toHaveURL(new RegExp(`/watchlist/${addedFilmId}$`));
  });

  test("home shows add film CTA between recommendation and history", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your watchlist" })).toBeVisible();
    await expect(page.getByText("12 films on your watchlist")).toBeVisible();
    const links = page.getByRole("link");
    await expect(links.filter({ hasText: "View watchlist" })).toHaveAttribute("href", "/watchlist");
    await expect(links.filter({ hasText: "Start questionnaire" })).toBeVisible();
    await expect(links.filter({ hasText: "Add a film" })).toBeVisible();
    await expect(links.filter({ hasText: "View history" })).toBeVisible();
  });

  test("watchlist page shows add button", async ({ page }) => {
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
      "/watchlist/add",
    );
  });
});
