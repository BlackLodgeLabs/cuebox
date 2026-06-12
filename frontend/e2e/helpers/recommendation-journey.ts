import { expect, type Page } from "@playwright/test";
import path from "path";

const fixturePath = path.join(__dirname, "..", "fixtures", "watchlist-small.csv");

/** Import watchlist, resolve reviews if needed, complete questionnaire; return results URL. */
export async function completeRecommendationJourney(page: Page): Promise<string> {
  await page.goto("/");

  await page.getByRole("link", { name: /import watchlist/i }).click();
  await expect(page).toHaveURL(/\/import$/);

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.getByRole("button", { name: /start import/i }).click();
  await expect(page).toHaveURL(/\/import\/[a-f0-9-]+$/i, { timeout: 15_000 });

  await expect(
    page.getByText(/import complete|get a recommendation|review matches/i),
  ).toBeVisible({ timeout: 180_000 });

  if (await page.getByRole("link", { name: /review matches/i }).isVisible()) {
    await page.getByRole("link", { name: /review matches/i }).click();
    while (await page.getByRole("button", { name: "Accept" }).count()) {
      await page.getByRole("button", { name: "Accept" }).first().click();
      await page.waitForTimeout(500);
    }
    await page.getByRole("link", { name: /get a recommendation/i }).click();
  } else if (
    await page.getByRole("link", { name: /get a recommendation/i }).isVisible()
  ) {
    await page.getByRole("link", { name: /get a recommendation/i }).click();
  } else {
    await page.goto("/recommend");
  }

  await expect(page).toHaveURL(/\/recommend$/);

  await page.getByRole("button", { name: "Horror" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: "Next" }).click();
  }

  await page.getByRole("button", { name: "Disturbed" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Atmospheric" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Next" }).click();
  }

  await page.getByRole("button", { name: /get recommendation/i }).click();

  await expect(page).toHaveURL(/\/recommend\/results\/[a-f0-9-]+$/i, {
    timeout: 60_000,
  });

  return page.url();
}
