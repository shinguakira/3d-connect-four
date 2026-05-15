import { test, expect } from "@playwright/test";

test.describe("Local game launch", () => {
  test("2-player mode opens the game canvas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /2プレイヤー/ }).click();

    // Game-page header.
    await expect(page.getByText("3D Connect Four").first()).toBeVisible();
    // Mode label shown in the header.
    await expect(page.getByText("2プレイヤー", { exact: false }).first()).toBeVisible();

    // R3F renders into a <canvas>.
    await expect(page.locator("canvas").first()).toBeVisible();

    // Return-to-menu button (← icon with aria title).
    await expect(page.getByTitle("メニューに戻る")).toBeVisible();
  });

  test("vs AI mode opens the game canvas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /vs AI/ }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("vs AI").first()).toBeVisible();
  });

  test("back button returns to the title", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /2プレイヤー/ }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByTitle("メニューに戻る").click();
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible();
  });
});
