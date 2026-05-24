import { test, expect } from "@playwright/test";
import { gotoOnline, makeMoveAsApi, pressReadyOnBoth, resetServer } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("Online: server-side win is reflected on both clients", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("a 4-in-a-row driven via the move API surfaces the victory modal to both clients", async ({
    browser,
    request,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const alice = await gotoOnline(pageA, { kind: "quick", name: "Alice" });
      const bob = await gotoOnline(pageB, { kind: "quick", name: "Bob" });

      // Both should see 2/2 in the waiting room before we proceed.
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 30_000 });

      await pressReadyOnBoth(pageA, pageB);
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

      // Drive a horizontal 4-in-a-row for player 1 (Alice) via direct API
      // calls, then assert both clients see the victory modal pushed via SSE.
      const sequence: Array<{ pid: string; x: number; z: number }> = [
        { pid: alice.playerId, x: 0, z: 0 },
        { pid: bob.playerId, x: 0, z: 1 },
        { pid: alice.playerId, x: 1, z: 0 },
        { pid: bob.playerId, x: 1, z: 1 },
        { pid: alice.playerId, x: 2, z: 0 },
        { pid: bob.playerId, x: 2, z: 1 },
        { pid: alice.playerId, x: 3, z: 0 }, // winning move
      ];
      for (const m of sequence) {
        const res = await makeMoveAsApi(
          request,
          { roomId: alice.roomId, playerId: m.pid },
          m.x,
          m.z,
        );
        expect(res.ok, `move ${m.pid} (${m.x},${m.z}) → ${res.status}`).toBe(true);
      }

      // Victory modal: the online rematch button "もう一度プレイ (準備完了)"
      // appears for both clients. (Restarting is also two-approval gated.)
      await expect(pageA.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
