import { expect, test } from "@playwright/test";

test.describe("Design system smoke", () => {
  test("home page uses the Cuebox background and wordmark", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Cuebox" })).toBeVisible();
    const header = page.locator("[data-shell-header]");
    await expect(header.getByText("Cue", { exact: true })).toBeVisible();
    await expect(header.getByText("box.", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search films" })).toBeVisible();
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe("rgb(11, 11, 11)");
    const cue = await header.getByText("Cue", { exact: true }).evaluate((el) =>
      getComputedStyle(el).color,
    );
    const box = await header.getByText("box.", { exact: true }).evaluate((el) =>
      getComputedStyle(el).color,
    );
    expect(cue).toBe("rgb(224, 122, 40)");
    expect(box).toBe("rgb(42, 154, 148)");
  });

  test("recommend page loads questionnaire", async ({ page }) => {
    await page.goto("/recommend");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  });
});
