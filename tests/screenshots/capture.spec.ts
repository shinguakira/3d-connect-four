import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const OUT_DIR = path.resolve(__dirname, "../../doc/images");

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    fullPage: false,
    animations: "disabled",
  });
}

async function resetServer(page: Page) {
  const res = await page.request.post("/api/game/debug");
  expect(res.ok(), "POST /api/game/debug must succeed").toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test.describe("capture user-manual screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await resetServer(page);
  });

  test("01 title page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible();
    // Wait one tick so the gradient title and mode buttons settle.
    await page.waitForTimeout(400);
    await shot(page, "01-title.png");
  });

  test("02 two-player game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /2プレイヤー/ }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.waitForTimeout(800); // give Three.js time to render
    await shot(page, "02-game-2player.png");
  });

  test("03 vs AI game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /vs AI/ }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "03-game-vs-ai.png");
  });

  test("04 online menu (quick tab)", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await expect(page.getByText("オンライン対戦")).toBeVisible();
    await page.getByLabel("プレイヤー名").fill("あなた");
    await page.waitForTimeout(200);
    await shot(page, "04-online-menu-quick.png");
  });

  test("05 online menu (join tab)", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByLabel("プレイヤー名").fill("あなた");
    await page.getByRole("button", { name: "参加", exact: true }).click();
    await page.getByLabel("ルームID").fill("ABC123");
    await page.waitForTimeout(200);
    await shot(page, "05-online-menu-join.png");
  });

  test("06 + 07 + 08 online flow (waiting 1/2, 2/2, in-game)", async ({ browser }) => {
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // ---- Host creates the room (1/2 state) ----
      await pageA.goto("/");
      await pageA
        .getByRole("button", { name: /オンライン/ })
        .first()
        .click();
      await pageA.getByLabel("プレイヤー名").fill("Alice");
      await pageA.getByRole("button", { name: "作成", exact: true }).click();

      const createResponsePromise = pageA.waitForResponse(
        (r) => r.url().endsWith("/api/game/create") && r.request().method() === "POST",
      );
      await pageA.getByRole("button", { name: "ルーム作成" }).click();
      const createBody = await (await createResponsePromise).json();
      const roomId: string = createBody.room.id;
      await expect(pageA.getByText(`ルーム: ${roomId}`)).toBeVisible({ timeout: 15_000 });
      await pageA.waitForTimeout(400);
      await shot(pageA, "06-online-waiting-1of2.png");

      // ---- Guest joins by id (2/2 state) ----
      await pageB.goto("/");
      await pageB
        .getByRole("button", { name: /オンライン/ })
        .first()
        .click();
      await pageB.getByLabel("プレイヤー名").fill("Bob");
      await pageB.getByRole("button", { name: "参加", exact: true }).click();
      await pageB.getByLabel("ルームID").fill(roomId);
      await pageB.getByRole("button", { name: "ルームに参加" }).click();

      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByText("Bob")).toBeVisible({ timeout: 15_000 });
      await pageA.waitForTimeout(400);
      await shot(pageA, "07-online-waiting-2of2.png");

      // ---- Start the game and capture the canvas ----
      await pageA.getByRole("button", { name: /ゲーム開始/ }).click();
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      await pageA.waitForTimeout(1000);
      await shot(pageA, "08-online-in-game.png");
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("09 victory overlay", async ({ browser, request }) => {
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Quick-match Alice + Bob and start.
      const aResp = pageA.waitForResponse(
        (r) => r.url().endsWith("/api/game/quick-match") && r.request().method() === "POST",
      );
      await pageA.goto("/");
      await pageA
        .getByRole("button", { name: /オンライン/ })
        .first()
        .click();
      await pageA.getByLabel("プレイヤー名").fill("Alice");
      await pageA.getByRole("button", { name: "クイック", exact: true }).click();
      await pageA.getByRole("button", { name: "クイックマッチ開始" }).click();
      const a = await (await aResp).json();

      const bResp = pageB.waitForResponse(
        (r) => r.url().endsWith("/api/game/quick-match") && r.request().method() === "POST",
      );
      await pageB.goto("/");
      await pageB
        .getByRole("button", { name: /オンライン/ })
        .first()
        .click();
      await pageB.getByLabel("プレイヤー名").fill("Bob");
      await pageB.getByRole("button", { name: "クイック", exact: true }).click();
      await pageB.getByRole("button", { name: "クイックマッチ開始" }).click();
      const b = await (await bResp).json();

      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await pageA.getByRole("button", { name: /ゲーム開始/ }).click();
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

      // Drive Alice to a 4-in-a-row along x at z=0, y=0 via real API calls.
      const moves = [
        { pid: a.playerId, x: 0, z: 0 },
        { pid: b.playerId, x: 0, z: 1 },
        { pid: a.playerId, x: 1, z: 0 },
        { pid: b.playerId, x: 1, z: 1 },
        { pid: a.playerId, x: 2, z: 0 },
        { pid: b.playerId, x: 2, z: 1 },
        { pid: a.playerId, x: 3, z: 0 }, // winning move
      ];
      for (const m of moves) {
        const res = await request.post(`/api/game/${a.room.id}/move`, {
          data: { playerId: m.pid, x: m.x, z: m.z },
        });
        expect(res.ok()).toBe(true);
      }

      await expect(pageA.getByRole("button", { name: /新しいゲーム/ })).toBeVisible({
        timeout: 15_000,
      });
      await pageA.waitForTimeout(800);
      await shot(pageA, "09-victory.png");
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
