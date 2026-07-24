import { expect, test } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

const localActive = {
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

const tmdbOnly = {
  tmdb_id: 603,
  title: "The Matrix",
  original_title: "The Matrix",
  year: 1999,
  overview: "A computer hacker learns about the true nature of reality.",
  poster_url: null,
};

const addedFilmId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function stubHomePresence(page: import("@playwright/test").Page) {
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
}

test.describe("library search picker (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await stubHomePresence(page);
  });

  test("home shows Add and Mark watched entries into picker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What do you want to watch?" })).toBeVisible();
    await expect(page.getByText("Your watchlist", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a film" })).toHaveAttribute(
      "href",
      "/search?intent=add",
    );
    await expect(page.getByRole("link", { name: "Mark watched" })).toHaveAttribute(
      "href",
      "/search?intent=mark-watched",
    );
  });

  test("search merges local and TMDB; mark watched posts status", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films?statuses=**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [localActive],
          pagination: { total: 1, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/tmdb-search**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              tmdb_id: 11453,
              title: "The Wicker Man",
              original_title: "The Wicker Man",
              year: 1973,
              overview: "Duplicate of local",
              poster_url: null,
            },
            tmdbOnly,
          ],
          pagination: { total: 2, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    let statusBody: unknown = null;
    await page.route(`**/films/${localActive.id}/status`, async (route) => {
      statusBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...localActive,
          status: "pending_watch_review",
          watch_review_incomplete: true,
        }),
      });
    });

    await page.goto("/search?intent=mark-watched");
    await expect(
      page.getByText(/Searches your library \(including watched films\) and TMDB/i),
    ).toBeVisible();
    await page.getByLabel("Library and TMDB search").fill("Wicker");
    await expect(page.getByText("The Wicker Man (1973)")).toBeVisible();
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark watched" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to watchlist" })).toBeVisible();

    await page.getByRole("button", { name: "Mark watched" }).click();
    await expect(page.getByRole("heading", { name: "Review watched film" })).toBeVisible();
    expect(statusBody).toEqual({ status: "pending_watch_review" });
  });

  test("TMDB-only add works and /watchlist/add redirects", async ({ page }) => {
    await page.route(`**${API_PATH_PREFIX}/films?statuses=**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/films/tmdb-search**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [tmdbOnly],
          pagination: { total: 1, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.route(`**${API_PATH_PREFIX}/watchlist/films`, async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          film_id: addedFilmId,
          enrichment_status: "enriching",
        }),
      });
    });

    let filmPolls = 0;
    await page.route(`**${API_PATH_PREFIX}/films/${addedFilmId}`, async (route) => {
      filmPolls += 1;
      const status = filmPolls >= 2 ? "ready" : "enriching";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: addedFilmId,
          title: "The Matrix",
          year: 1999,
          letterboxd_uri: "https://letterboxd.com/film/the-matrix/",
          status: "active",
          enrichment_status: status,
          metadata: null,
          semantic_profile: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/watchlist/add");
    await expect(page).toHaveURL(/\/search\?intent=add/);
    await page.getByLabel("Library and TMDB search").fill("Matrix");
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await page.getByRole("button", { name: "Add to watchlist" }).click();
    await expect(page).toHaveURL(new RegExp(`/watchlist/${addedFilmId}$`));
  });
});
