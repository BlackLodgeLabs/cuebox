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

  test("confirm remove deletes card from history list", async ({ page }) => {
    await page.goto("/history");

    await expect(page.getByText("Delete Me Film")).toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();

    await page
      .locator(".hover-glow")
      .filter({ hasText: "Delete Me Film" })
      .getByRole("button", { name: /remove from history/i })
      .click();

    await expect(
      page.getByRole("dialog", { name: /remove from history/i }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Are you sure you want to remove this from your history? This cannot be undone.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: /^remove$/i }).click();

    await expect(page.getByText("Delete Me Film")).not.toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.reload();
    await expect(page.getByText("Delete Me Film")).not.toBeVisible();
    await expect(page.getByText("Keep Me Film")).toBeVisible();
    await expect(page.getByText(DELETE_SESSION_ID)).not.toBeVisible();
    await expect(page.getByText(KEEP_SESSION_ID)).not.toBeVisible();
  });
});
