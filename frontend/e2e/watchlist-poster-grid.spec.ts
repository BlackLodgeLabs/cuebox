import { expect, test, type Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

const activeFilm = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "The Wicker Man",
  year: 1973,
  letterboxd_uri: "https://letterboxd.com/film/the-wicker-man/",
  status: "active",
  enrichment_status: "ready",
  tmdb_id: 11453,
  poster_url: null,
  director: "Robin Hardy",
  runtime: 88,
  genres: ["Horror"],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const watchedRated = {
  ...activeFilm,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Blade Runner",
  year: 1982,
  runtime: 117,
  status: "watched",
  latest_score: 4.5,
  latest_watched_at: null,
};

const watchedUnrated = {
  ...activeFilm,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  title: "Sid and Nancy",
  year: 1986,
  runtime: 112,
  status: "watched",
  latest_score: null,
};

async function hideDevIndicator(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
  });
}

async function stubCommon(page: Page) {
  await page.route(`**${API_PATH_PREFIX}/films/review-required**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { total: 0, limit: 1, offset: 0, has_more: false },
      }),
    });
  });

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

function filmList(data: unknown[], total = data.length) {
  return {
    data,
    pagination: { total, limit: 20, offset: 0, has_more: false },
  };
}

test.describe("watchlist poster grid (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.documentElement.append(style);
    });
    await stubCommon(page);

    await page.route(`**${API_PATH_PREFIX}/films**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/genres")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: ["Horror", "Drama", "Thriller"] }),
        });
        return;
      }

      const status = url.searchParams.get("status");
      const runtime = url.searchParams.get("runtime");
      const limit = url.searchParams.get("limit");
      const offset = Number(url.searchParams.get("offset") ?? "0");

      if (status === "watched") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            filmList(offset > 0 ? [] : [watchedRated, watchedUnrated], 2),
          ),
        });
        return;
      }

      if (status === "archived") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(filmList([], 0)),
        });
        return;
      }

      const total = runtime === "le_90" ? 4 : 239;
      const filteredFilm = { ...activeFilm, title: "Lamb", year: 2021, runtime: 106 };
      const data =
        offset > 0 ? [] : runtime === "le_90" ? [filteredFilm] : [activeFilm];
      if (runtime === "le_90" && limit !== "1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(filmList([filteredFilm], 4)),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data,
          pagination: {
            total,
            limit: Number(limit ?? 18),
            offset,
            has_more: offset === 0 && data.length > 0 && data.length < total,
          },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/genres`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: ["Horror", "Drama", "Thriller"] }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/${activeFilm.id}/status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...activeFilm, status: "pending_watch_review" }),
      });
    });
  });

  test("shows the view total, a poster grid, and no next page button", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/films") && url.searchParams.get("limit") === "18") {
        requested.push(url.search);
      }
    });

    await page.goto("/watchlist");
    await expect(page.getByRole("heading", { name: "Watchlist" })).toBeVisible();
    await expect(page.getByText("239 unwatched")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Unwatched", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Watched", exact: true })).toHaveText(
      "Watched",
    );
    await expect(page.getByTestId("watchlist-poster-grid")).toBeVisible();
    await expect(page.getByText("The Wicker Man")).toBeVisible();
    await expect(page.getByText("1973 · 88m")).toBeVisible();
    await expect(page.getByText("NO POSTER")).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
    await hideDevIndicator(page);
    await page.screenshot({
      path: test.info().outputPath("watchlist-unwatched.png"),
    });
    await expect.poll(() => requested.some((query) => query.includes("status=active"))).toBe(
      true,
    );
  });

  test("crossfades at the locked timings", async ({ page }) => {
    await page.goto("/watchlist");
    const fade = page.locator("[data-cb-watchlist-crossfade]");
    await expect(fade).toHaveAttribute("data-out-ms", "400");
    await expect(fade).toHaveAttribute("data-in-ms", "600");
    await expect(fade).toHaveAttribute("data-delay-ms", "200");
  });

  test("uses a 300ms crossfade when motion is reduced", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/watchlist");
    const fade = page.locator("[data-cb-watchlist-crossfade]");
    await expect(fade).toHaveAttribute("data-out-ms", "300");
    await expect(fade).toHaveAttribute("data-in-ms", "300");
    await expect(fade).toHaveAttribute("data-delay-ms", "0");
  });

  test("Filter sheet applies one runtime limit and can clear it", async ({ page }) => {
    await page.goto("/watchlist");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByRole("heading", { name: "Filter" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "No limit" })).toBeChecked();
    const onMyServices = page.getByRole("switch", { name: /On my services/i });
    await expect(onMyServices).toBeVisible();
    await expect(onMyServices).toHaveAttribute("aria-checked", "false");
    await onMyServices.click();
    await expect(onMyServices).toHaveAttribute("data-state", "checked");

    await page.getByRole("button", { name: "Horror" }).click();
    await page.getByRole("radio", { name: "≤ 90 minutes" }).click();
    await expect(page.getByRole("button", { name: "Show 4 films" })).toBeVisible();
    await page.waitForTimeout(700);
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("watchlist-filter.png") });
    await page.getByRole("button", { name: "Show 4 films" }).click();
    await expect(page).toHaveURL(/runtime=le_90/);
    await expect(page).toHaveURL(/on_my_services=true/);
    await expect(page.getByText("4 unwatched")).toBeVisible();
    await expect(page.getByText("Lamb")).toBeVisible();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Clear all" }).click();
    await page.getByRole("button", { name: "Show 239 films" }).click();
    await expect(page).not.toHaveURL(/runtime=/);
    await expect(page).not.toHaveURL(/on_my_services/);
    await expect(page.getByText("The Wicker Man")).toBeVisible();
  });

  test("Sort sheet selects runtime, shortest first", async ({ page }) => {
    await page.goto("/watchlist");
    await page.getByRole("button", { name: "Sort by Date added" }).click();
    await expect(page.getByRole("heading", { name: "Sort by" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Date added/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("option", { name: /Rating/ })).toBeInViewport();
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("watchlist-sort.png") });
    await page.getByRole("option", { name: /Runtime/ }).click();
    await expect(page).toHaveURL(/sort=runtime/);
    await expect(page).toHaveURL(/sort_dir=asc/);
    await expect(page.getByRole("button", { name: "Sort by Runtime" })).toBeVisible();
  });

  test("shows an error when the list fails to load", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/genres")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await page.goto("/watchlist");
    await expect(page.getByText("Could not load watchlist.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("watchlist-error.png") });
  });

  test("pills switch datasets and rated watched films show an amber badge", async ({
    page,
  }) => {
    await page.goto("/watchlist");
    await expect(page.getByText("The Wicker Man")).toBeVisible();

    await page.getByRole("tab", { name: "Watched", exact: true }).click();
    await expect(page).toHaveURL(/tab=watched/);
    await expect(page.getByText("2 watched")).toBeVisible();
    await expect(page.getByText("Blade Runner")).toBeVisible();
    await expect(page.getByText("1982 · 117m")).toBeVisible();
    await expect(page.getByTestId("watchlist-rating-badge")).toContainText("4.5");
    await expect(page.getByText("Sid and Nancy")).toBeVisible();
    await expect(page.getByTestId("watchlist-rating-badge")).toHaveCount(1);
    await expect(page.locator("[data-cb-watchlist-crossfade]")).toHaveCount(1);
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("watchlist-watched.png") });

    await page.getByRole("tab", { name: "Archived", exact: true }).click();
    await expect(page).toHaveURL(/tab=archived/);
    await expect(page.getByText("No archived films.")).toBeVisible();
    await expect(page.getByText("0 archived")).toBeVisible();
    await expect(page.locator("[data-cb-watchlist-crossfade]")).toHaveCount(1);
    await expect(page.getByText("The Wicker Man")).toHaveCount(0);
    await hideDevIndicator(page);
    await page.screenshot({ path: test.info().outputPath("watchlist-archived-empty.png") });
  });
});
