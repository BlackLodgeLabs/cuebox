import { expect, test } from "@playwright/test";
import {
  CEREMONY_SESSION_ID,
  mockCeremonySession,
} from "./helpers/ceremony-mocks";

test.describe("Recommendation ceremony (mocked API)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockCeremonySession(page);
  });

  test("fresh results advance 1 → 2 → 3 with short then full reasons", async ({
    page,
  }) => {
    await page.goto(`/history/${CEREMONY_SESSION_ID}`);
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();

    await page.getByTestId("ceremony-replay").click();
    await expect(page).toHaveURL(new RegExp(`[?&]stage=1`));
    await expect(page.getByTestId("ceremony-stage-winner")).toBeVisible();
    await expect(page.getByTestId("ceremony-progress")).toHaveText("1 / 3");
    await expect(page.getByTestId("ceremony-sticky-chrome")).toBeVisible();
    await expect(page.getByTestId("ceremony-next")).toBeInViewport();
    await expect(page.getByText("Folk horror mood fit.")).toBeVisible();
    await expect(
      page.getByText("Folk horror atmosphere matches your mood."),
    ).toHaveCount(0);
    await expect(page.getByTestId("watch-provider-icons")).toHaveCount(0);
    await expect(page.getByText("Synopsis")).toHaveCount(0);

    await page.getByTestId("ceremony-next").click();
    await expect(page).toHaveURL(new RegExp(`[?&]stage=2`));
    await expect(page.getByTestId("ceremony-stage-runners-up")).toBeVisible();
    await expect(page.getByTestId("ceremony-next")).toBeInViewport();
    await expect(page.getByText("Overlapping vibes.")).toBeVisible();
    await expect(
      page.getByText("Close alternative with overlapping vibes."),
    ).toHaveCount(0);
    await expect(page.getByTestId("watch-provider-icons")).toHaveCount(0);

    await page.getByTestId("ceremony-next").click();
    await expect(page).toHaveURL(new RegExp(`[?&]stage=3`));
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();
    await expect(
      page.getByText("Folk horror atmosphere matches your mood."),
    ).toBeVisible();
    await expect(page.getByTestId("watch-provider-icons")).toBeVisible();
    await expect(page.getByText("Synopsis")).toBeVisible();
  });

  test("history detail lands on stage 3 with Done sole primary", async ({
    page,
  }) => {
    await page.goto(`/history/${CEREMONY_SESSION_ID}`);
    await expect(page.getByTestId("ceremony-progress")).toHaveText("3 / 3");
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();
    await expect(page.getByTestId("ceremony-replay")).toBeVisible();

    const done = page.getByTestId("ceremony-done");
    await expect(done).toBeVisible();
    await expect(done).toHaveClass(/bg-primary/);
    await expect(page.getByTestId("ceremony-replay")).not.toHaveClass(
      /bg-primary/,
    );
    await expect(page.getByTestId("ceremony-more-actions")).not.toHaveClass(
      /bg-primary/,
    );
    await expect(
      page.getByTestId("ceremony-new-recommendation"),
    ).toHaveCount(0);

    await page.getByTestId("ceremony-more-actions").click();
    await expect(page.getByTestId("ceremony-new-recommendation")).toBeVisible();
    await expect(page.getByTestId("ceremony-new-recommendation")).not.toHaveClass(
      /bg-primary/,
    );
  });

  test("replay plays 1 → 2 → 3 once per tap", async ({ page }) => {
    await page.goto(`/history/${CEREMONY_SESSION_ID}`);
    await page.getByTestId("ceremony-replay").click();
    await expect(page.getByTestId("ceremony-stage-winner")).toBeVisible();
    await page.getByTestId("ceremony-next").click();
    await expect(page.getByTestId("ceremony-stage-runners-up")).toBeVisible();
    await page.getByTestId("ceremony-next").click();
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();

    // Hard refresh while still on stage 3 stays on stage 3.
    await page.reload();
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();
  });

  test("unarmed stage=1 deep link coerces to stage 3", async ({ page }) => {
    await page.goto(
      `/recommend/results/${CEREMONY_SESSION_ID}?stage=1`,
    );
    await expect(page).toHaveURL(new RegExp(`[?&]stage=3`));
    await expect(page.getByTestId("ceremony-stage-record")).toBeVisible();
  });

  test("reduced-motion sets data attribute and ceremony class", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/history/${CEREMONY_SESSION_ID}`);
    await expect(page.getByTestId("recommendation-ceremony")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    await expect(page.locator(".ceremony-reduced-motion")).toHaveCount(1);
  });
});
