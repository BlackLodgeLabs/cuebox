import { expect, test } from "@playwright/test";
import path from "path";

const fixturePath = path.join(__dirname, "fixtures", "watchlist-small.csv");
const sampleJobId = "00000000-0000-4000-8000-000000000001";
const sampleSessionId = "00000000-0000-4000-8000-000000000002";

test.describe("All 9 frontend routes", () => {
  test.skip(
    !process.env.PLAYWRIGHT_E2E_STACK,
    "Set PLAYWRIGHT_E2E_STACK=1 with docker compose stack running",
  );

  test("route 1: home /", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Cuebox" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("route 2: import /import", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByRole("heading", { name: /import watchlist/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /start import/i })).toBeVisible();
  });

  test("route 3: import status /import/[jobId]", async ({ page }) => {
    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: /start import/i }).click();
    await expect(page).toHaveURL(/\/import\/[a-f0-9-]+$/i, { timeout: 15_000 });
    await expect(page.getByText(/import|processing|complete|failed/i).first()).toBeVisible();
  });

  test("route 4: review /review", async ({ page }) => {
    await page.goto("/review");
    await expect(
      page.getByRole("heading", { name: /review matches|all matches resolved/i }),
    ).toBeVisible();
  });

  test("route 5: recommend /recommend", async ({ page }) => {
    await page.goto("/recommend");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  });

  test("route 6: results /recommend/results/[sessionId]", async ({ page }) => {
    await page.goto(`/recommend/results/${sampleSessionId}`);
    await expect(
      page.getByText(/loading|could not|not found|results|recommendation/i).first(),
    ).toBeVisible();
  });

  test("route 7: history /history", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: /history/i })).toBeVisible();
  });

  test("route 8: history detail /history/[sessionId]", async ({ page }) => {
    await page.goto(`/history/${sampleSessionId}`);
    await expect(
      page.getByText(/loading|could not|not found|session|history/i).first(),
    ).toBeVisible();
  });

  test("route 9: sync settings /settings/sync", async ({ page }) => {
    await page.goto("/settings/sync");
    await expect(page.getByRole("heading", { name: /sync/i })).toBeVisible();
  });
});
