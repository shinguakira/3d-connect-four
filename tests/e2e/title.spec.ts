import { test, expect } from "@playwright/test";

test.describe("Title page", () => {
  test("renders the title and three game modes", async ({ page }) => {
    await page.goto("/");

    // Title (multiple gradient layers render the same text — match any).
    await expect(page.getByRole("heading", { name: "3D Connect Four" }).first()).toBeVisible();
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible();

    // All three game-mode buttons.
    await expect(page.getByRole("button", { name: /2プレイヤー/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /vs AI/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /オンライン/ })).toBeVisible();
  });

  test("how-to section explains the 4x4x4 rule", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("4×4×4の立方体で4つ連続を目指そう")).toBeVisible();
  });
});
