import { test, expect } from "@playwright/test";
import { gotoOnline, pressReadyOnBoth, resetServer } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("Online: Create + Join by room ID (UI)", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("host creates a room, guest joins by id, both reach the game canvas", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Host creates the room.
      const host = await gotoOnline(pageA, { kind: "create", name: "Alice" });
      await expect(pageA.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByText("プレイヤーを待機中", { exact: false }).first()).toBeVisible();

      // Guest joins using the host's room id.
      await gotoOnline(pageB, { kind: "join", name: "Bob", roomId: host.roomId });
      await expect(pageB.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });

      // Both clients see both players (the host transition is SSE-driven).
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByText("Bob")).toBeVisible();
      await expect(pageB.getByText("Alice")).toBeVisible();

      // Both players must mark ready — the game transitions only after the
      // second one. Order doesn't matter, but we ready the host first then
      // the guest so the guest's press is the one that fires "game-started".
      await pressReadyOnBoth(pageA, pageB);
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

      // Both clients show the "オンライン" mode label in the header.
      await expect(pageA.getByText("オンライン").first()).toBeVisible();
      await expect(pageB.getByText("オンライン").first()).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("guest joining a non-existent room sees the error banner without leaving the menu", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByLabel("プレイヤー名").fill("ghost");
    await page.getByRole("button", { name: "参加", exact: true }).click();
    await page.getByLabel("ルームID").fill("NOPE99");
    await page.getByRole("button", { name: "ルームに参加" }).click();

    await expect(page.getByText(/ルーム参加に失敗/)).toBeVisible({ timeout: 15_000 });
    // Still on the online menu, not transitioned away.
    await expect(page.getByText("オンライン対戦")).toBeVisible();
  });
});
