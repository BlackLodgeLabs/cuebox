import { expect, test } from "@playwright/test";
import {
  mockFilmRematchFlow,
  mockFilmRematchPaginationFlow,
  REMATCH_FILM_ID,
  UPDATED_TMDB_ID,
} from "./helpers/film-rematch-mocks";

test.describe("Film rematch UI (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockFilmRematchFlow(page);
  });

  test("edit button visible on failed film detail", async ({ page }) => {
    await page.goto(`/watchlist/${REMATCH_FILM_ID}`);
    await expect(page.getByRole("heading", { name: /wrong match film/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit film match/i })).toBeVisible();
  });

  test("opens dialog with pre-filled search", async ({ page }) => {
    await page.goto(`/watchlist/${REMATCH_FILM_ID}`);
    await page.getByRole("button", { name: /edit film match/i }).click();
    await expect(page.getByRole("dialog", { name: /edit film match/i })).toBeVisible();
    await expect(page.getByLabel("TMDB search query")).toHaveValue("Wrong Match Film");
    await expect(page.getByLabel("Release year filter")).toHaveValue("1981");
  });

  test("search results render; select and confirm calls rematch", async ({ page }) => {
    await page.goto(`/watchlist/${REMATCH_FILM_ID}`);
    await page.getByRole("button", { name: /edit film match/i }).click();

    await expect(page.getByText("Possession (1981)")).toBeVisible();
    await page.getByRole("button").filter({ hasText: "Possession" }).click();
    await page.getByRole("button", { name: /confirm match/i }).click();

    await expect(
      page.getByText("Regenerating enrichment…", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("after mocked rematch metadata updates on detail page", async ({ page }) => {
    await page.goto(`/watchlist/${REMATCH_FILM_ID}`);
    await page.getByRole("button", { name: /edit film match/i }).click();
    await expect(page.getByRole("dialog", { name: /edit film match/i })).toBeVisible();

    await page.getByRole("button").filter({ hasText: "Possession" }).click();
    await page.getByRole("button", { name: /confirm match/i }).click();

    await expect(page.getByText("Updating metadata…")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("Enrichment complete", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Possession")).toBeVisible();
    await expect(page.getByText(String(UPDATED_TMDB_ID))).toBeVisible();
  });
});

test.describe("Film rematch pagination (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockFilmRematchPaginationFlow(page);
  });

  test("next page loads a different result set", async ({ page }) => {
    await page.goto(`/watchlist/${REMATCH_FILM_ID}`);
    await page.getByRole("button", { name: /edit film match/i }).click();

    await expect(page.getByText("Alpha Film (1970)")).toBeVisible();
    await expect(page.getByText("Page 1 of 2 (4 results)")).toBeVisible();

    await page.getByRole("button", { name: /^next$/i }).click();

    await expect(page.getByText("Gamma Film (1972)")).toBeVisible();
    await expect(page.getByText("Page 2 of 2 (4 results)")).toBeVisible();
    await expect(page.getByText("Alpha Film (1970)")).not.toBeVisible();
  });
});
