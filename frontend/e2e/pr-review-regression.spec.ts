import { expect, test } from "@playwright/test";

test.describe("PR review regression checks", () => {
  test.skip(
    !process.env.PLAYWRIGHT_E2E_STACK,
    "Set PLAYWRIGHT_E2E_STACK=1 with docker compose stack running",
  );

  test("import page rejects non-CSV uploads with a toast", async ({ page }) => {
    await page.goto("/import");

    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a csv"),
    });

    await expect(page.getByText("Invalid file type", { exact: true })).toBeVisible();
  });

  test("home nav stays on / when review badge is visible", async ({ page }) => {
    await page.goto("/");
    const homeLink = page.getByRole("link", { name: /^home$/i });
    await expect(homeLink).toHaveAttribute("href", "/");
  });

  test("home shell has no scanline overlay", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main.main-scanlines")).toHaveCount(0);
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe("rgb(11, 11, 11)");
  });
});
