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

test.describe("library search picker (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await stubHomePresence(page);
  });

  test("home embeds picker above recommendation/history; dual CTAs gone", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What do you want to watch?" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toBeVisible();
    await expect(
      page.getByPlaceholder("Find a film in your library or add one…"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a film" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mark watched" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View watchlist" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Review now" })).toHaveCount(0);

    const searchBox = page.getByTestId("library-search-input");
    const recommend = page.getByRole("link", { name: "Create a recommendation" });
    const history = page.getByRole("link", { name: "History" });
    await expect(recommend).toBeVisible();
    await expect(history).toBeVisible();

    const searchY = (await searchBox.boundingBox())?.y ?? 0;
    const recommendY = (await recommend.boundingBox())?.y ?? 0;
    expect(searchY).toBeLessThan(recommendY);

    const historyBox = await history.boundingBox();
    expect(historyBox).toBeTruthy();
    expect(historyBox!.height).toBeGreaterThanOrEqual(44);
  });

  test("picker row actions meet ≥44px touch targets", async ({ page }) => {
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
          data: [tmdbOnly],
          pagination: { total: 1, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    await page.goto("/");
    await page.getByTestId("library-search-input").fill("Wicker");
    await expect(page.getByText("The Wicker Man (1973)")).toBeVisible();
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();

    for (const name of ["View", "Mark watched", "Add to watchlist", "Add & mark watched"] as const) {
      const control =
        name === "View"
          ? page.getByRole("link", { name, exact: true })
          : page.getByRole("button", { name, exact: true });
      const box = await control.boundingBox();
      expect(box, name).toBeTruthy();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }
  });

  test("focusing search scrolls input into view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const scrolled = await page.evaluate(async () => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="library-search-input"]',
      );
      if (!input) return false;
      let called = false;
      const original = input.scrollIntoView.bind(input);
      input.scrollIntoView = ((...args: Parameters<Element["scrollIntoView"]>) => {
        called = true;
        return original(...args);
      }) as typeof input.scrollIntoView;
      input.focus();
      input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      return called;
    });
    expect(scrolled).toBe(true);
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

    await page.goto("/");
    await expect(
      page.getByText(/Search your library \(including watched films\) or add from TMDB/i),
    ).toBeVisible();
    await page.getByTestId("library-search-input").fill("Wicker");
    await expect(page.getByText("The Wicker Man (1973)")).toBeVisible();
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark watched", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to watchlist" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add & mark watched" })).toBeVisible();

    await page.getByRole("button", { name: "Mark watched", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review watched film" })).toBeVisible();
    expect(statusBody).toEqual({ status: "pending_watch_review" });
  });

  test("/search and /watchlist/add redirect to Home with focused picker", async ({
    page,
  }) => {
    await page.goto("/search?intent=mark-watched");
    await expect(page).toHaveURL(/\/(\?focus=search)?$/);
    await expect(page.getByTestId("library-search-input")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);

    await page.goto("/watchlist/add");
    await expect(page.getByTestId("library-search-input")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Home ?focus=search focuses input then clears param", async ({ page }) => {
    await page.goto("/?focus=search");
    await expect(page.getByTestId("library-search-input")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);
  });

  test("TMDB-only add works through Home picker", async ({ page }) => {
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
          watches: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/watchlist/add");
    await expect(page.getByTestId("library-search-input")).toBeVisible();
    await page.getByTestId("library-search-input").fill("Matrix");
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await page.getByRole("button", { name: "Add to watchlist" }).click();
    await expect(page).toHaveURL(new RegExp(`/watchlist/${addedFilmId}$`));
  });

  test("TMDB Add & mark watched opens review after enrichment", async ({ page }) => {
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
          watches: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    let statusBody: unknown = null;
    await page.route(`**/films/${addedFilmId}/status`, async (route) => {
      statusBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: addedFilmId,
          title: "The Matrix",
          year: 1999,
          letterboxd_uri: "https://letterboxd.com/film/the-matrix/",
          status: "pending_watch_review",
          enrichment_status: "ready",
          poster_url: null,
          director: null,
          runtime: null,
          genres: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    await page.goto("/");
    await page.getByTestId("library-search-input").fill("Matrix");
    await expect(page.getByText("The Matrix (1999)")).toBeVisible();
    await page.getByRole("button", { name: "Add & mark watched" }).click();
    await expect(page.getByRole("heading", { name: "Review watched film" })).toBeVisible();
    expect(statusBody).toEqual({ status: "pending_watch_review" });
  });

  test("empty watchlist Home has Import only; focus param does not crash", async ({
    page,
  }) => {
    await page.unroute(`**${API_PATH_PREFIX}/films?limit=1**`);
    await page.route(`**${API_PATH_PREFIX}/films?limit=1**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 1, offset: 0, has_more: false },
        }),
      });
    });

    await page.goto("/?focus=search");
    await expect(page.getByRole("heading", { name: "Welcome to Cuebox" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Import watchlist" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });
});
