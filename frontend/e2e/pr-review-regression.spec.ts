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

    await expect(page.getByText("Invalid file type")).toBeVisible();
  });

  test("home nav stays on / when review badge is visible", async ({ page }) => {
    await page.goto("/");
    const homeLink = page.getByRole("link", { name: /^home$/i });
    await expect(homeLink).toHaveAttribute("href", "/");
  });

  test("scanlines overlay is scoped to main content", async ({ page }) => {
    await page.goto("/");
    const position = await page.locator("main.main-scanlines").evaluate((main) =>
      getComputedStyle(main, "::after").position,
    );
    expect(position).toBe("absolute");
  });
});
