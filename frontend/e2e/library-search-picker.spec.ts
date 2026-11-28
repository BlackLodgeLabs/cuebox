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
  backdrop_url: null,
  latest_score: null,
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

const catalogueFilm = {
  tmdb_id: 603,
  title: "The Matrix",
  year: 1999,
  overview: "A computer hacker learns about the true nature of reality.",
  backdrop_url: null,
  poster_url: null,
  genres: ["Science Fiction"],
  runtime: 136,
  director: "Lana Wachowski",
  tmdb_rating: 8.2,
  trailer_url: null,
  film_id: null,
  status: null,
};

const addedFilmId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function stubHomePresence(page: import("@playwright/test").Page) {
  await page.route(`**${API_PATH_PREFIX}/films?status=active**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [localActive],
        pagination: { total: 1, limit: 100, offset: 0, has_more: false },
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

async function stubSearch(
  page: import("@playwright/test").Page,
  library: unknown[],
  tmdb: unknown[],
) {
  await page.route(`**${API_PATH_PREFIX}/films?statuses=**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: library,
        pagination: { total: library.length, limit: 20, offset: 0, has_more: false },
      }),
    });
  });

  await page.route(`**${API_PATH_PREFIX}/films/tmdb-search**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: tmdb,
        pagination: { total: tmdb.length, limit: 20, offset: 0, has_more: false },
      }),
    });
  });
}

test.describe("search card (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubHomePresence(page);
  });

  test("home no longer embeds the inline picker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Today's feature · from your watchlist")).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Wicker Man" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get a pick for tonight" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "What do you want to watch?" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create a recommendation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "History" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add a film" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mark watched" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View watchlist" })).toHaveCount(0);
  });

  test("header on Home and Watchlist opens the card over the current page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search films" })).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Search films" })).toHaveCount(0);

    await page.goto("/watchlist");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await expect(page).toHaveURL(/\/watchlist/);
  });

  test("groups watchlist hits above catalogue hits; eye opens detail", async ({
    page,
  }) => {
    await stubSearch(
      page,
      [localActive],
      [
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
    );

    await page.goto("/");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await page.getByRole("combobox", { name: "Search films" }).fill("Wicker");

    await expect(page.getByText("On your watchlist", { exact: true })).toBeVisible();
    await expect(page.getByText("Not on your watchlist", { exact: true })).toBeVisible();
    await expect(page.getByText("1973 · 88m")).toBeVisible();
    await expect(page.getByRole("option", { name: /The Matrix/ })).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Add & mark watched" })).toHaveCount(0);

    const eye = page.getByRole("button", { name: "Open The Wicker Man" });
    const box = await eye.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await eye.click();
    await expect(page).toHaveURL(new RegExp(`/watchlist/${localActive.id}$`));
  });

  test("plus adds a catalogue film and shows Added to watchlist", async ({ page }) => {
    await stubSearch(page, [], [tmdbOnly]);
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

    await page.goto("/");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await page.getByRole("combobox", { name: "Search films" }).fill("Matrix");
    await page.getByRole("button", { name: "Add The Matrix to watchlist" }).click();

    await expect(page.getByText("Added to watchlist")).toBeVisible();
    await expect(page.getByText("The Matrix").last()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
  });

  test("a catalogue hit opens the lighter page and hides a missing trailer", async ({
    page,
  }) => {
    await stubSearch(page, [], [tmdbOnly]);
    await page.route(`**${API_PATH_PREFIX}/films/tmdb/603`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogueFilm),
      });
    });

    await page.goto("/");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await page.getByRole("combobox", { name: "Search films" }).fill("Matrix");
    await page.getByRole("option", { name: /The Matrix/ }).click();

    await expect(page).toHaveURL(/\/films\/tmdb\/603$/);
    const film = page.getByRole("article");
    await expect(film.getByRole("heading", { name: "The Matrix" })).toBeVisible();
    await expect(film.getByText("82%")).toBeVisible();
    await expect(film.getByRole("link", { name: "Trailer" })).toHaveCount(0);
    await expect(film.getByRole("button", { name: "Add to watchlist" })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("/search and /watchlist/add open the card on Home", async ({ page }) => {
    await page.goto("/search?intent=mark-watched");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search films" })).toBeFocused();

    await page.goto("/watchlist/add");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
  });

  test("Home ?focus=search opens the card then clears the param", async ({ page }) => {
    await page.goto("/?focus=search");
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page).not.toHaveURL(/focus=search/);
  });

  test("empty watchlist still opens the card from ?focus=search", async ({ page }) => {
    await page.unroute(`**${API_PATH_PREFIX}/films?status=active**`);
    await page.route(`**${API_PATH_PREFIX}/films?status=active**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, limit: 100, offset: 0, has_more: false },
        }),
      });
    });

    await page.goto("/?focus=search");
    await expect(page.getByRole("heading", { name: "Nothing on your watchlist yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Import watchlist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Cuebox" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Search films" })).toBeVisible();
    await expect(page.getByTestId("library-search-input")).toHaveCount(0);
    await expect(page).not.toHaveURL(/focus=search/);
  });

  test("no match has an empty state", async ({ page }) => {
    await stubSearch(page, [], []);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Search films" }).click();
    await page.getByRole("combobox", { name: "Search films" }).fill("zzzz-no-film");
    await expect(page.getByText('No films match "zzzz-no-film".')).toBeVisible();
  });
});
