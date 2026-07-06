import { expect, test } from "@playwright/test";
import {
  mockWatchProvidersFilmDetail,
  mockWatchProvidersResults,
  WATCH_PROVIDERS_FILM_ID,
  WATCH_PROVIDERS_SESSION_ID,
} from "./helpers/watch-providers-mocks";

test.describe("Watch providers UI (mocked API)", () => {
  test("film detail shows Where to Watch with provider names", async ({ page }) => {
    await mockWatchProvidersFilmDetail(page);
    await page.goto(`/watchlist/${WATCH_PROVIDERS_FILM_ID}`);

    await expect(page.getByText("Where to Watch")).toBeVisible();
    await expect(page.getByText("Netflix")).toBeVisible();
    await expect(page.getByText("Disney Plus")).toBeVisible();
    await expect(
      page.getByText("Streaming data provided by JustWatch via TMDB."),
    ).toBeVisible();
  });

  test("film detail shows UK empty-state when categories are empty", async ({ page }) => {
    await mockWatchProvidersFilmDetail(page, { empty: true });
    await page.goto(`/watchlist/${WATCH_PROVIDERS_FILM_ID}`);

    await expect(
      page.getByText("No streaming options currently listed for the UK."),
    ).toBeVisible();
  });

  test("results page shows provider icons on winner card", async ({ page }) => {
    await mockWatchProvidersResults(page);
    await page.goto(`/recommend/results/${WATCH_PROVIDERS_SESSION_ID}`);

    await expect(page.getByTestId("watch-provider-icons")).toBeVisible();
    await expect(page.locator('[aria-label="Netflix"]')).toBeVisible();
  });
});
