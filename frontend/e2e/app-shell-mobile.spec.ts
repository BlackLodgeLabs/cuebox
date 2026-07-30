import { expect, test, type Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

async function stubShellApis(page: Page, pendingTotal = 0) {
  await page.route(`**${API_PATH_PREFIX}/films/reviews/pending-count**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        metadata_count: pendingTotal,
        watch_review_count: 0,
        total: pendingTotal,
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

  await page.route(`**${API_PATH_PREFIX}/sync/rss**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: null,
        enabled: false,
        last_polled_at: null,
        last_success_at: null,
        last_error: null,
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/recommendations**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, has_more: false },
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/films/review-required**`, async (route) => {
    const data =
      pendingTotal > 0
        ? [
            {
              review_id: "review-1",
              film_id: "seed-film",
              title: "Seed Film",
              year: 1973,
              poster_url: null,
              letterboxd_uri: "https://letterboxd.com/film/seed-film/",
              review_type: "tmdb_match",
              candidate_tmdb_id: 550,
              confidence_score: 0.42,
              candidate_payload: {
                title: "Demo Candidate",
                year: 1973,
                director: null,
              },
              created_at: "2024-01-01T00:00:00Z",
            },
          ]
        : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        pagination: {
          total: data.length,
          limit: 50,
          offset: 0,
          has_more: false,
        },
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/films/watch-review-required**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { total: 0, limit: 50, offset: 0, has_more: false },
      }),
    });
  });
}

test.describe("AppShell mobile chrome (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom tabs order and labels; History/Settings not tabs", async ({
    page,
  }) => {
    await stubShellApis(page);
    await page.goto("/");

    const primary = page.getByRole("navigation", { name: "Primary" });
    const hrefs = await primary.getByRole("link").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );
    expect(hrefs).toEqual(["/", "/watchlist", "/recommend", "/more"]);
    for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
      await expect(primary.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(primary.getByRole("link", { name: /history/i })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: /^settings$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("More opens hub then Sync; More stays active on settings", async ({
    page,
  }) => {
    await stubShellApis(page);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "More" })
      .click();
    await expect(page).toHaveURL(/\/more$/);
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByRole("link", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const destinations = page.getByRole("navigation", {
      name: "More destinations",
    });
    await expect(destinations.getByRole("link", { name: /sync/i })).toBeVisible();
    await expect(destinations.getByRole("link", { name: /import/i })).toBeVisible();
    await expect(destinations.getByRole("link", { name: /history/i })).toBeVisible();

    await destinations.getByRole("link", { name: /sync/i }).click();
    await expect(page).toHaveURL(/\/settings\/sync/);
    await expect(page.getByRole("heading", { name: "Sync settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("active tab uses primary tint and indicator", async ({ page }) => {
    await stubShellApis(page);
    await page.goto("/");

    const home = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Home" });
    await expect(home).toHaveClass(/text-primary/);
    await expect(home.locator("[data-active-indicator]")).toHaveCount(1);
  });

  test("sticky header includes top safe-area padding class", async ({ page }) => {
    await stubShellApis(page);
    await page.goto("/");

    const header = page.locator("header").first();
    await expect(header).toHaveClass(/safe-area-inset-top/);
  });

  test("off-tab pages expose ← Home chrome", async ({ page }) => {
    await stubShellApis(page);

    await page.goto("/history");
    await expect(page.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );

    await page.goto("/import");
    await expect(page.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );

    await stubShellApis(page, 2);
    await page.goto("/review");
    await expect(page.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("Review badge appears when pending and opens /review", async ({ page }) => {
    await stubShellApis(page, 2);
    await page.goto("/");

    const review = page.getByRole("link", { name: "Review 2" });
    await expect(review).toBeVisible();
    await review.click();
    await expect(page).toHaveURL(/\/review/);
    await expect(
      page.getByRole("heading", { name: "Review", exact: true }),
    ).toBeVisible();
  });

  test("Search films lands on Home picker via /search", async ({ page }) => {
    await stubShellApis(page);
    await page.goto("/watchlist");
    await page.getByRole("link", { name: "Search films" }).click();
    await expect(page).toHaveURL(/\/(\?focus=search)?$/);
    await expect(page.getByTestId("library-search-input")).toBeVisible();
  });

  test("tab hit targets meet 44px minimum", async ({ page }) => {
    await stubShellApis(page);
    await page.goto("/");

    for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
      const box = await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: label })
        .boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
