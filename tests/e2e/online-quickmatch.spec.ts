import { test, expect } from "@playwright/test";
import { gotoOnline, resetServer } from "./helpers";

test.describe("Online: quick-match", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("first quick-match player creates the room (matched=false)", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByLabel("プレイヤー名").fill("Solo");
    await page.getByRole("button", { name: "クイック", exact: true }).click();

    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/game/quick-match") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "クイックマッチ開始" }).click();
    const body = await (await responsePromise).json();
    expect(body.success).toBe(true);
    expect(body.matched).toBe(false);
    expect(body.room.players).toHaveLength(1);
    await expect(page.getByText(/ルーム:/)).toBeVisible({ timeout: 15_000 });
  });

  test("second quick-match player joins the waiting room (matched=true)", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" });
      await expect(pageA.getByText(`ルーム: ${a.roomId}`)).toBeVisible({ timeout: 15_000 });

      const b = await gotoOnline(pageB, { kind: "quick", name: "Bob" });
      expect(b.roomId).toBe(a.roomId); // matched into Alice's room

      // Both pages converge on the 2/2 player list.
      await expect(pageA.getByText("Bob")).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByText("Alice")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("third quick-match player creates a new room (does not crash an existing pair)", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const ctxC = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const pageC = await ctxC.newPage();

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" });
      const b = await gotoOnline(pageB, { kind: "quick", name: "Bob" });
      expect(b.roomId).toBe(a.roomId);

      const c = await gotoOnline(pageC, { kind: "quick", name: "Carol" });
      expect(c.roomId).not.toBe(a.roomId);
      await expect(pageC.getByText(`ルーム: ${c.roomId}`)).toBeVisible({ timeout: 15_000 });
      await expect(pageC.getByText("プレイヤー (1/2)")).toBeVisible();

      // Pair AB still see each other; Carol does not appear in their list.
      await expect(pageA.getByText("Bob")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByText("Carol")).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
      await ctxC.close();
    }
  });

  test("game starts only after BOTH players press 準備完了 (two-approval gate)", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" });
      await gotoOnline(pageB, { kind: "quick", name: "Bob" });
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });

      // Bob alone marking ready must NOT start the game on Alice's side.
      await pageB.getByRole("button", { name: /準備完了/ }).click();
      await expect(pageB.getByText(/相手の準備を待っています/)).toBeVisible({ timeout: 5_000 });
      await expect(pageA.locator("canvas")).toHaveCount(0);

      // Alice presses her own 準備完了 — now both transition into the game.
      await pageA.getByRole("button", { name: /準備完了/ }).click();

      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await expect(pageA.getByText("オンライン").first()).toBeVisible();
      await expect(pageB.getByText("オンライン").first()).toBeVisible();

      // Header shows player 1 (Alice) is to move first.
      await expect(pageA.getByText("Alice").first()).toBeVisible();
      await expect(pageB.getByText("Alice").first()).toBeVisible();
      void a; // (handle is unused after this point but kept for clarity)
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
