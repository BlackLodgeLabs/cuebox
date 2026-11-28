import { expect, test, type Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

async function hideDevIndicator(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
  });
}

test.describe("my services (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("saves a teal selection and keeps the locked intro", async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.documentElement.append(style);
    });

    await page.route(`**${API_PATH_PREFIX}/health`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", database: "ok", version: "test", providers: {} }),
      });
    });
    await page.route(`**${API_PATH_PREFIX}/films/reviews/pending-count**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metadata_count: 0, watch_review_count: 0, total: 0 }),
      });
    });
    await page.route(`**${API_PATH_PREFIX}/settings/services**`, async (route) => {
      const url = route.request().url();
      if (url.includes("/catalog")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            country_code: "GB",
            providers: [
              { provider_id: 8, provider_name: "Netflix", logo_url: null, display_priority: 1 },
              { provider_id: 9, provider_name: "Prime Video", logo_url: null, display_priority: 2 },
              { provider_id: 337, provider_name: "Disney Plus", logo_url: null, display_priority: 3 },
              { provider_id: 38, provider_name: "BBC iPlayer", logo_url: null, display_priority: 4 },
            ],
          }),
        });
        return;
      }
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ country_code: "GB", provider_ids: [8, 9] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ country_code: "GB", provider_ids: [8] }),
      });
    });

    await page.goto("/settings/services");
    await expect(
      page.getByText(
        "Used to sort Where to watch, so your subscriptions come first, and by the On my services filter on the Watchlist. You can change this whenever you like.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Netflix" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Prime Video" }).click();
    await expect(page.getByRole("button", { name: "Prime Video" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("settings-my-services.png") });

    const saved = page.waitForRequest(
      (request) =>
        request.method() === "PUT" && request.url().includes("/settings/services"),
    );
    await page.getByRole("button", { name: "Done" }).click();
    expect((await saved).postDataJSON()).toEqual({ provider_ids: [8, 9] });
    await expect(page).toHaveURL(/\/more$/);
  });
});
