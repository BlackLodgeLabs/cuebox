import { expect, test } from "@playwright/test";
import path from "path";

const fixturePath = path.join(
  __dirname,
  "fixtures",
  "watchlist-small.csv",
);

test.describe("First-time user journey", () => {
  test.skip(
    !process.env.PLAYWRIGHT_E2E_STACK,
    "Set PLAYWRIGHT_E2E_STACK=1 with docker compose up (frontend + api + postgres)",
  );

  test("import → recommend → history", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /import watchlist/i }).click();
    await expect(page).toHaveURL(/\/import$/);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(fixturePath);
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

    // Genres — select Horror
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

    await expect(page).toHaveURL(/\/recommend\/results\/[a-f0-9-]+\?stage=1/i, {
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: /your pick/i })).toBeVisible();
    await expect(page.getByTestId("ceremony-stage-winner")).toBeVisible();
    const winnerTitleEl = page
      .getByTestId("ceremony-stage-winner")
      .locator(".font-heading")
      .first();
    await expect(winnerTitleEl).toBeVisible();
    const winnerTitle =
      (await winnerTitleEl.textContent())?.replace(/\s*\(\d{4}\)\s*$/, "").trim() ??
      "";

    await page.goto("/history");
    await expect(
      page.getByRole("link", { name: new RegExp(winnerTitle, "i") }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
