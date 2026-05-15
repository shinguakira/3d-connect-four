import { test, expect } from "@playwright/test";
import { gotoOnline, resetServer } from "./helpers";

test.describe("Online: room creation flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("host creates a room and lands in the waiting screen", async ({ page }) => {
    const handle = await gotoOnline(page, { kind: "create", name: "HostA" });

    // Waiting screen shows the new room id, the host's name, and the 1/2 counter.
    await expect(page.getByText(`ルーム: ${handle.roomId}`)).toBeVisible();
    await expect(page.getByText("HostA")).toBeVisible();
    await expect(page.getByText("ホスト")).toBeVisible();
    await expect(page.getByText("プレイヤー (1/2)")).toBeVisible();

    // Empty slot prompt (the paragraph variant — there is also a button
    // with the same text) and the shareable-id hint.
    await expect(page.getByText(/プレイヤーを待機中/).first()).toBeVisible();
    await expect(page.getByText(/友達にルームID/)).toBeVisible();

    // Start button is disabled until the second player arrives. The button
    // is rendered as a single disabled control labelled "プレイヤーを待機中".
    await expect(page.getByRole("button", { name: /ゲーム開始/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /プレイヤーを待機中/ })).toBeDisabled();
  });

  test("creating yields a fresh six-character room id each time", async ({ page, context }) => {
    const handle1 = await gotoOnline(page, { kind: "create", name: "P1" });
    expect(handle1.roomId).toMatch(/^[A-Z0-9]{6}$/);

    const page2 = await context.newPage();
    const handle2 = await gotoOnline(page2, { kind: "create", name: "P2" });
    expect(handle2.roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(handle2.roomId).not.toBe(handle1.roomId);
  });

  test("leave room returns the host to the title", async ({ page }) => {
    await gotoOnline(page, { kind: "create", name: "Quitter" });
    await page.getByRole("button", { name: "ルームを退出" }).click();
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible();
  });
});
