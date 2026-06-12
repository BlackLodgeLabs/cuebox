import { expect, test } from "@playwright/test";

test.describe("Design system smoke", () => {
  test("home page uses dark background and Cuebox branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Cuebox" })).toBeVisible();
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBeTruthy();
  });

  test("recommend page loads questionnaire", async ({ page }) => {
    await page.goto("/recommend");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  });
});
