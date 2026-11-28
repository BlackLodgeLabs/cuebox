import { expect, test } from "@playwright/test";

/**
 * The home library picker was replaced by the header search card.
 * Grouped results, mark watched, and TMDB add belong to the search ticket.
 * These tests keep the entry points that used to land on that picker.
 */

const API_PATH_PREFIX = "/api/v1";

test.describe("search entry points", () => {
  test.beforeEach(async ({ page }) => {
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

  test("/search and /watchlist/add open the search card and clear the focus param", async ({
    page,
  }) => {
    await page.goto("/search");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();

    await page.goto("/watchlist/add");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
  });

  test("Home ?focus=search opens the card then clears the param", async ({ page }) => {
    await page.goto("/?focus=search");
    await expect(page).not.toHaveURL(/focus=search/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
  });

  test("empty watchlist offers import and no old hub", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Nothing on your watchlist yet" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Import watchlist" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Welcome to Cuebox" })).toHaveCount(0);
  });
});
