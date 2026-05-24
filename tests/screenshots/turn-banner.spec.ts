import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(__dirname, "../../doc/images/preview");

test.describe.configure({ mode: "serial" });

test("two-player mode: capture P1 and P2 turn banners mid-animation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:3000");

  // Click "2 プレイヤー"
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();

  // Banner should animate on game-start. Capture mid-animation (~450ms in).
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "turn-banner-p1-2player.png") });

  // Wait for banner to finish, then make a P1 move to flip to P2.
  await page.waitForTimeout(1200);

  // Use eval to click the center bottom panel via Three.js — fallback: click center.
  // The dropPiece is bound to mesh clicks. Easier: dispatch a synthetic click on
  // the canvas at the bottom-center which usually hits one of the drop panels.
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.78);
  }

  // Catch P2 turn banner mid-animation.
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "turn-banner-p2-2player.png") });
});

test("vs-ai mode: capture player turn + enemy turn banners", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:3000");

  await page.getByRole("button", { name: /vs.*AI/i }).click();

  // Your Phase banner
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "turn-banner-vs-ai-your.png") });

  await page.waitForTimeout(1200);

  // Drop a piece to trigger Enemy Phase
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.78);
  }

  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "turn-banner-vs-ai-enemy.png") });
});
