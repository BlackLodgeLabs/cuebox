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

const watchedFilm = {
  ...activeFilm,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Blade Runner",
  year: 1982,
  status: "watched",
  latest_watched_at: "2024-06-01",
};

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
    await stubCommon(page);

    await page.route(`**${API_PATH_PREFIX}/films**`, async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get("status");
      const onWatchlist = url.searchParams.get("on_watchlist");
      const search = url.searchParams.get("search");
      const limit = url.searchParams.get("limit");

      if (limit === "1") {
        if (status === "watched") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(filmList([watchedFilm], 1)),
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
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(filmList([activeFilm], 1)),
        });
        return;
      }

      if (status === "watched") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(filmList([watchedFilm], 1)),
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

      if (onWatchlist === "true" || (!status && !onWatchlist)) {
        const data =
          search && !activeFilm.title.toLowerCase().includes(search.toLowerCase())
            ? []
            : [activeFilm];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(filmList(data, data.length)),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(filmList([activeFilm], 1)),
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

  test("shows poster grid without table headers", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.getByTestId("watchlist-poster-grid")).toBeVisible();
    await expect(page.getByText("The Wicker Man")).toBeVisible();
    await expect(page.getByText("NO POSTER")).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Year/ })).toHaveCount(0);
    await expect(page.getByText("Enrichment", { exact: true })).toHaveCount(0);
  });

  test("Filter sheet Apply and Clear update list chrome", async ({ page }) => {
    await page.goto("/watchlist");
    await page.getByRole("button", { name: /Filter and sort/i }).click();
    await expect(page.getByRole("heading", { name: /Filter and sort/i })).toBeVisible();

    await page.getByLabel(/^Search$/i).fill("no-such-film");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await expect(page).toHaveURL(/search=no-such-film/);
    await expect(page.getByText(/No films match your filters/i)).toBeVisible();

    await page.getByRole("button", { name: /Filter and sort/i }).click();
    await page.getByRole("button", { name: /^Clear$/i }).click();
    await expect(page).not.toHaveURL(/search=/);
    await expect(page.getByTestId("watchlist-poster-grid")).toBeVisible();
  });

  test("⋯ opens Mark watched action", async ({ page }) => {
    await page.goto("/watchlist");
    await page.getByRole("button", { name: /Actions for The Wicker Man/i }).click();
    await expect(page.getByRole("menuitem", { name: /Mark watched/i })).toBeVisible();
    await page.getByRole("menuitem", { name: /Mark watched/i }).click();
  });

  test("status tabs switch datasets", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.getByText("The Wicker Man")).toBeVisible();

    await page.getByRole("tab", { name: /Watched/i }).click();
    await expect(page).toHaveURL(/tab=watched/);
    await expect(page.getByText("Blade Runner")).toBeVisible();

    await page.getByRole("tab", { name: /Archived/i }).click();
    await expect(page).toHaveURL(/tab=archived/);
    await expect(page.getByText(/No archived films/i)).toBeVisible();
  });
});
