import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  DEV_SESSION_ID,
  mockDeveloperModeDisabled,
  mockDeveloperModeEnabled,
  mockRecommendationSession,
} from "./helpers/dev-api-mocks";
import { completeRecommendationJourney } from "./helpers/recommendation-journey";

const API_BASE =
  process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000/api/v1";

async function isDeveloperModeEnabled(request: APIRequestContext): Promise<boolean> {
  const response = await request.get(`${API_BASE}/dev/system/versions`);
  return response.ok();
}

test.describe("Developer Mode UI (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockRecommendationSession(page);
  });

  test("hides dev panel when backend developer mode is disabled", async ({ page }) => {
    await mockDeveloperModeDisabled(page);
    await page.goto(`/recommend/results/${DEV_SESSION_ID}?dev=1`);
    await expect(page.getByRole("heading", { name: /your pick/i })).toBeVisible();
    await expect(page.getByText("Developer Mode", { exact: true })).not.toBeVisible();
  });

  test("shows retrieval, scoring, and AI tabs via ?dev=1 when enabled", async ({
    page,
  }) => {
    await mockDeveloperModeEnabled(page);
    await page.goto(`/recommend/results/${DEV_SESSION_ID}?dev=1`);
    await page.waitForResponse(
      (response) =>
        response.url().includes("/dev/system/versions") && response.ok(),
    );

    await expect(page.getByText("Developer Mode", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Retrieval" })).toBeVisible();
    await expect(page.getByText("Profile hash")).toBeVisible();
    await expect(page.getByText("Slow-burn atmospheric folk horror.")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "The Wicker Man" }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Scoring" }).click();
    await expect(page.getByText("theme_fit")).toBeVisible();
    await expect(page.getByRole("cell", { name: "0.8960" })).toBeVisible();

    await page.getByRole("tab", { name: "AI" }).click();
    await expect(page.getByText("4821")).toBeVisible();
    await expect(page.getByText("1103")).toBeVisible();

    await page.getByRole("tab", { name: "Versions" }).click();
    await expect(page.getByText("semantic-profile")).toBeVisible();
  });

  test("toggles dev panel with Ctrl+Shift+D when enabled", async ({ page }) => {
    await mockDeveloperModeEnabled(page);
    await page.goto(`/recommend/results/${DEV_SESSION_ID}`);
    await page.waitForResponse(
      (response) =>
        response.url().includes("/dev/system/versions") && response.ok(),
    );

    await expect(page.getByText("Developer Mode", { exact: true })).not.toBeVisible();

    await page.locator("main").click();
    await page.keyboard.press("Control+Shift+D");
    await expect(page.getByText("Developer Mode", { exact: true })).toBeVisible();
    await expect(page.getByText("Profile hash")).toBeVisible();

    await page.keyboard.press("Control+Shift+D");
    await expect(page.getByText("Developer Mode", { exact: true })).not.toBeVisible();
  });

  test("history detail shows dev panel with ?dev=1 when enabled", async ({ page }) => {
    await mockDeveloperModeEnabled(page);
    await page.goto(`/history/${DEV_SESSION_ID}?dev=1`);
    await page.waitForResponse(
      (response) =>
        response.url().includes("/dev/system/versions") && response.ok(),
    );

    await expect(page.getByRole("heading", { name: "The Wicker Man" })).toBeVisible();
    await expect(page.getByText("Developer Mode", { exact: true })).toBeVisible();
    await expect(page.getByText("Profile hash")).toBeVisible();
  });
});

test.describe("Developer Mode (full stack)", () => {
  test.skip(
    !process.env.PLAYWRIGHT_E2E_STACK,
    "Set PLAYWRIGHT_E2E_STACK=1 with docker compose up (frontend + api + postgres)",
  );

  test("dev panel hidden when developer_mode is false", async ({ page, request }) => {
    test.skip(
      await isDeveloperModeEnabled(request),
      "Requires developer_mode: false in config.yaml",
    );

    const resultsUrl = await completeRecommendationJourney(page);
    await page.goto(`${resultsUrl}?dev=1`);
    await expect(page.getByText("Developer Mode", { exact: true })).not.toBeVisible();
  });

  test("dev panel shows trace data when developer_mode is true", async ({
    page,
    request,
  }) => {
    test.skip(
      !(await isDeveloperModeEnabled(request)),
      "Set developer_mode: true in config.yaml and restart the API",
    );

    const resultsUrl = await completeRecommendationJourney(page);
    await page.goto(`${resultsUrl}?dev=1`);

    await expect(page.getByText("Developer Mode", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Retrieval" })).toBeVisible();
    await expect(page.getByText("Profile hash")).toBeVisible();

    await page.getByRole("tab", { name: "Scoring" }).click();
    await expect(page.getByText("theme_fit")).toBeVisible();

    await page.getByRole("tab", { name: "AI" }).click();
    await expect(page.getByText("Semantic enrichment")).toBeVisible();
  });
});
