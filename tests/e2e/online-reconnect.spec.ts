import { test, expect } from "@playwright/test";
import { gotoOnline, resetServer } from "./helpers";

// Verifies the sessionStorage-driven reconnect path: after a tab reload,
// the client should silently re-attach to its previous online session
// (room + playerId) without bouncing the user back to the title menu.

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("Online: sessionStorage reconnect after page reload", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("the lobby re-attaches to the same room after a reload", async ({ page }) => {
    const host = await gotoOnline(page, { kind: "create", name: "Alice" });

    // The waiting room renders the room id.
    await expect(page.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });

    // After the join lands, the session id pair must be persisted.
    const stored = await page.evaluate(() => ({
      room: sessionStorage.getItem("3dcf:online-room"),
      player: sessionStorage.getItem("3dcf:online-player"),
    }));
    expect(stored.room).toBe(host.roomId);
    expect(stored.player).toBe(host.playerId);

    // Reload — should NOT bounce to the title; should land back in the
    // same waiting lobby with the same room id.
    await page.reload();
    await expect(page.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("ゲームモードを選択")).toHaveCount(0);
  });

  test("stale sessionStorage for a missing room is silently cleared", async ({ page }) => {
    // Hand-craft a "session" for a room that never existed.
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.setItem("3dcf:online-room", "DEAD99");
      sessionStorage.setItem("3dcf:online-player", "00000000-0000-0000-0000-000000000000");
    });

    await page.reload();
    // The title menu shows again.
    await expect(page.getByText("ゲームモードを選択")).toBeVisible({ timeout: 15_000 });

    // ...and the stale keys are swept away once the async validation GET
    // resolves. Poll instead of asserting immediately — the title menu
    // renders synchronously from the default state machine, but the
    // sessionStorage clear waits on /api/game/lookup/DEAD99 returning 404
    // which can take a moment on first compile of the dynamic route.
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("3dcf:online-room")), {
        timeout: 15_000,
      })
      .toBeNull();
    const after = await page.evaluate(() => ({
      room: sessionStorage.getItem("3dcf:online-room"),
      player: sessionStorage.getItem("3dcf:online-player"),
    }));
    expect(after.room).toBeNull();
    expect(after.player).toBeNull();
  });

  test("leaving the room clears the saved session", async ({ page }) => {
    const host = await gotoOnline(page, { kind: "create", name: "Alice" });
    await expect(page.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "ルームを退出" }).click();
    await expect(page.getByText("ゲームモードを選択")).toBeVisible({ timeout: 15_000 });

    const after = await page.evaluate(() => ({
      room: sessionStorage.getItem("3dcf:online-room"),
      player: sessionStorage.getItem("3dcf:online-player"),
    }));
    expect(after.room).toBeNull();
    expect(after.player).toBeNull();
  });
});
