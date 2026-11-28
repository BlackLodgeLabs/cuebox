import { expect, test } from "@playwright/test";
import {
  CEREMONY_SESSION_ID,
  mockCeremonySession,
} from "./helpers/ceremony-mocks";

test.describe("Recommendation programme (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockCeremonySession(page);
  });

  test("history detail is the dated programme, not the ceremony", async ({
    page,
  }) => {
    await page.goto(`/history/${CEREMONY_SESSION_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Fri 1 Nov" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to History" })).toHaveAttribute(
      "href",
      "/history",
    );
    await expect(page.getByRole("link", { name: "New pick" })).toHaveAttribute(
      "href",
      "/recommend",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Ceremony Winner" }),
    ).toBeVisible();
    await expect(page.getByTestId("recommendation-ceremony")).toHaveCount(0);
    await expect(page.getByTestId("ceremony-replay")).toHaveCount(0);
  });

  test("recommend results show tonight's programme without the ceremony", async ({
    page,
  }) => {
    await page.goto(`/recommend/results/${CEREMONY_SESSION_ID}?stage=1`);
    await expect(
      page.getByRole("heading", { name: /tonight.s programme/i }),
    ).toBeVisible();
    await expect(page.getByTestId("recommendation-ceremony")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Recommend" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("reduced motion settles tonight's programme in place", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/recommend/results/${CEREMONY_SESSION_ID}`);
    await expect(
      page.getByRole("heading", { name: /tonight.s programme/i }),
    ).toBeVisible();
    await expect(page.locator("[data-programme] [data-travel='none']").first()).toBeVisible();
    await expect(page.getByTestId("recommendation-ceremony")).toHaveCount(0);
  });
});
