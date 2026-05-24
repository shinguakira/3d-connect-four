import { test, expect } from "@playwright/test";
import { gotoOnline, makeMoveAsApi, pressReadyOnBoth, resetServer } from "./helpers";

// Online result must be PER-PERSPECTIVE: the winner sees a victory message,
// the loser sees a defeat message. Previously both clients showed the same
// "プレイヤーNの勝利!" text, which is just "who won, factually" but doesn't
// surface the result to each player from their own POV.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test.describe("Online: result is rendered from each player's perspective", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("winner sees victory copy; loser sees defeat copy (P1 = Alice wins)", async ({
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

      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 30_000 });
      await pressReadyOnBoth(pageA, pageB);
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

      // Drive Alice (= player 1, quick-match host) to a horizontal 4-in-a-row.
      const plan: Array<{ pid: string; x: number; z: number }> = [
        { pid: alice.playerId, x: 0, z: 0 },
        { pid: bob.playerId, x: 0, z: 1 },
        { pid: alice.playerId, x: 1, z: 0 },
        { pid: bob.playerId, x: 1, z: 1 },
        { pid: alice.playerId, x: 2, z: 0 },
        { pid: bob.playerId, x: 2, z: 1 },
        { pid: alice.playerId, x: 3, z: 0 }, // winning move
      ];
      for (const m of plan) {
        const res = await makeMoveAsApi(
          request,
          { roomId: alice.roomId, playerId: m.pid },
          m.x,
          m.z,
        );
        expect(res.ok, `move ${JSON.stringify(m)} → ${res.status}`).toBe(true);
      }

      // Winner (Alice on pageA) sees victory copy.
      const aliceModal = pageA.getByRole("dialog").or(pageA.locator(":has(> .text-2xl)"));
      void aliceModal; // (kept for future use; we assert by text below)
      await expect(pageA.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageA.getByText("勝利！", { exact: false }).first()).toBeVisible();
      await expect(pageA.getByText("おめでとうございます！", { exact: false })).toBeVisible();
      // Loser-side copy must NOT appear for Alice.
      await expect(pageA.getByText(/敗北/)).toHaveCount(0);
      await expect(pageA.getByText(/あなたの負け/)).toHaveCount(0);

      // Loser (Bob on pageB) sees defeat copy.
      await expect(pageB.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.getByText("敗北", { exact: false }).first()).toBeVisible();
      // Subtitle mentions opponent (Alice) by name.
      await expect(pageB.getByText(/Aliceの勝利です/)).toBeVisible();
      await expect(pageB.getByText(/あなたの負け/)).toBeVisible();
      // Winner-only copy must NOT appear for Bob.
      await expect(pageB.getByText("おめでとうございます！")).toHaveCount(0);
      await expect(pageB.getByText("あなたの勝利！")).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("perspective flips when P2 = Bob wins", async ({ browser, request }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const alice = await gotoOnline(pageA, { kind: "quick", name: "Alice" });
      const bob = await gotoOnline(pageB, { kind: "quick", name: "Bob" });

      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 30_000 });
      await pressReadyOnBoth(pageA, pageB);
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

      // Alice plays harmlessly off to the side; Bob (P2) wins horizontally at z=1.
      const plan: Array<{ pid: string; x: number; z: number }> = [
        { pid: alice.playerId, x: 0, z: 2 },
        { pid: bob.playerId, x: 0, z: 1 },
        { pid: alice.playerId, x: 1, z: 2 },
        { pid: bob.playerId, x: 1, z: 1 },
        { pid: alice.playerId, x: 2, z: 2 },
        { pid: bob.playerId, x: 2, z: 1 },
        { pid: alice.playerId, x: 0, z: 3 },
        { pid: bob.playerId, x: 3, z: 1 }, // winning move
      ];
      for (const m of plan) {
        const res = await makeMoveAsApi(
          request,
          { roomId: alice.roomId, playerId: m.pid },
          m.x,
          m.z,
        );
        expect(res.ok, `move ${JSON.stringify(m)} → ${res.status}`).toBe(true);
      }

      // Now Bob is the winner. Roles invert: Bob sees victory, Alice sees defeat.
      await expect(pageB.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.getByText("勝利！", { exact: false }).first()).toBeVisible();
      await expect(pageB.getByText("おめでとうございます！")).toBeVisible();
      await expect(pageB.getByText(/敗北/)).toHaveCount(0);

      await expect(pageA.getByRole("button", { name: /もう一度プレイ/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageA.getByText("敗北", { exact: false }).first()).toBeVisible();
      await expect(pageA.getByText(/Bobの勝利です/)).toBeVisible();
      await expect(pageA.getByText("おめでとうございます！")).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
