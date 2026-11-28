import { expect, test } from "@playwright/test";
import {
  DELETE_SESSION_ID,
  KEEP_SESSION_ID,
  mockHistoryDeleteFlow,
} from "./helpers/history-delete-mocks";

test.describe("History delete (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockHistoryDeleteFlow(page);
  });

  test("remove rail stays hidden until a swipe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/history");

    const ticket = page.getByRole("button", { name: /Delete Me Film/ });
    await expect(ticket).toBeVisible();
    const rail = page.locator("[data-remove-rail]").first();
    await expect(rail).toHaveAttribute("data-revealed", "false");
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);

    const box = await ticket.boundingBox();
    expect(box).toBeTruthy();
    const startX = box!.x + box!.width - 40;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 40, y, { steps: 8 });
    await expect(rail).toHaveAttribute("data-revealed", "true");
    const revealed = await rail.boundingBox();
    expect(revealed).toBeTruthy();
    expect(revealed!.height).toBeGreaterThanOrEqual(44);
    expect(revealed!.width).toBeGreaterThanOrEqual(44);
    await page.mouse.up();
  });

  test("confirm remove deletes the night from history", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/history");

    await expect(page.getByText("Delete Me Film")).toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();

    const ticket = page.getByRole("button", { name: /Delete Me Film/ });
    const box = await ticket.boundingBox();
    expect(box).toBeTruthy();
    const y = box!.y + box!.height / 2;
    await page.mouse.move(box!.x + box!.width / 2, y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    await expect(page.getByRole("alertdialog", { name: /remove this night/i })).toBeVisible();
    await expect(
      page.getByText(
        "It will be deleted from History. This does not change the film on your watchlist.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: /^remove$/i }).click();

    await expect(page.getByText("Delete Me Film")).not.toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    await page.reload();
    await expect(page.getByText("Delete Me Film")).not.toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();
    await expect(page.getByText(DELETE_SESSION_ID)).not.toBeVisible();
    await expect(page.getByText(KEEP_SESSION_ID)).not.toBeVisible();
  });
});
