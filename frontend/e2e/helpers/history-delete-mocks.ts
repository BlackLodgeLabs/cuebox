import type { Page } from "@playwright/test";

const API_PATH_PREFIX = "/api/v1";

export const DELETE_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const KEEP_SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const historyList = {
  data: [
    {
      session_id: DELETE_SESSION_ID,
      winner_film_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      winner_title: "Delete Me Film",
      winner_year: 1973,
      winner_poster_url: null,
      winner_watch_status: "active",
      preference_summary: "Atmospheric folk horror for removal.",
      created_at: "2024-11-02T12:00:00Z",
    },
    {
      session_id: KEEP_SESSION_ID,
      winner_film_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      winner_title: "Keep Me Film",
      winner_year: 1980,
      winner_poster_url: null,
      winner_watch_status: "active",
      preference_summary: "Should remain after delete.",
      created_at: "2024-11-01T12:00:00Z",
    },
  ],
  pagination: {
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
  },
};

export async function mockHistoryDeleteFlow(page: Page): Promise<void> {
  let deleted = false;

  await page.route(`${API_PATH_PREFIX}/recommendations**`, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(API_PATH_PREFIX, "");

    if (route.request().method() === "GET" && pathname === "/recommendations") {
      const response = {
        ...historyList,
        data: deleted
          ? historyList.data.filter((item) => item.session_id !== DELETE_SESSION_ID)
          : historyList.data,
        pagination: {
          ...historyList.pagination,
          total: deleted ? 1 : 2,
        },
      };
      await route.fulfill({ status: 200, json: response });
      return;
    }

    if (
      route.request().method() === "DELETE" &&
      pathname === `/recommendations/${DELETE_SESSION_ID}`
    ) {
      deleted = true;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}
