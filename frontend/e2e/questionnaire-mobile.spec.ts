import { expect, test, type Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

async function stubRecommendApis(page: Page) {
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
}

test.describe("Questionnaire mobile density (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("progress and Next stay visible with ≥44px controls and no horizontal overflow", async ({
    page,
  }) => {
    await stubRecommendApis(page);
    await page.goto("/recommend");

    await expect(page.getByText(/step 1 of 11/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Genres", level: 1 })).toBeVisible();
    await expect(page.getByLabel(/questionnaire progress/i)).toBeVisible();

    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeVisible();
    const nextBox = await next.boundingBox();
    expect(nextBox).toBeTruthy();
    expect(nextBox!.height).toBeGreaterThanOrEqual(44);

    const chip = page.getByRole("button", { name: "No Preference", exact: true });
    const chipBox = await chip.boundingBox();
    expect(chipBox).toBeTruthy();
    expect(chipBox!.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth <= root.clientWidth;
    });
    expect(overflow).toBe(true);
  });
});
