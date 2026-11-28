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

  test("add film from the search card via the legacy add route", async ({ page }) => {
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

    await page.goto("/watchlist/add");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await page.getByRole("combobox", { name: "Search films" }).fill("Matrix");
    await expect(page.getByRole("option", { name: /The Matrix/ })).toBeVisible();
    await page.getByRole("button", { name: "Add The Matrix to watchlist" }).click();
    await expect(page.getByText("Added to watchlist")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("home shows recommendation and history without the inline picker", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What do you want to watch?" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    const links = page.getByRole("link");
    await expect(links.filter({ hasText: "Create a recommendation" })).toHaveAttribute(
      "href",
      "/recommend",
    );
    await expect(links.filter({ hasText: "History" })).toHaveAttribute("href", "/history");
    await expect(links.filter({ hasText: "View watchlist" })).toHaveCount(0);
    await expect(links.filter({ hasText: "Start questionnaire" })).toHaveCount(0);
    await expect(links.filter({ hasText: "Add a film" })).toHaveCount(0);
    await expect(links.filter({ hasText: "Mark watched" })).toHaveCount(0);
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
