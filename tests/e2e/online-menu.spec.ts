import { test, expect } from "@playwright/test";

test.describe("Online menu", () => {
  test("opens the online menu with three tabs", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();

    await expect(page.getByText("オンライン対戦")).toBeVisible();
    await expect(page.getByRole("button", { name: "クイック", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "作成", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "参加", exact: true })).toBeVisible();
  });

  test("join tab reveals the room id input", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByRole("button", { name: /参加/ }).click();

    await expect(page.getByLabel("ルームID")).toBeVisible();
  });

  test("submit is disabled until a name is entered", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();

    const submit = page.getByRole("button", { name: /クイックマッチ開始/ });
    await expect(submit).toBeDisabled();

    await page.getByLabel("プレイヤー名").fill("E2E");
    await expect(submit).toBeEnabled();
  });

  test("back returns to the title", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByRole("button", { name: "メニューに戻る" }).click();
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible();
  });
});
