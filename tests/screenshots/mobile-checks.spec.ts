import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(__dirname, "../../doc/images/preview");

// iPhone 14-ish viewport on Chromium (webkit isn't installed locally).
// We force a mobile UA + touch + small viewport so use-mobile.ts picks it up.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test.describe.configure({ mode: "serial" });

test("mobile — title page", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(800); // intro animations settle
  await page.screenshot({ path: path.join(OUT, "mobile-01-title.png") });
});

test("mobile — turn banner (2 player, P1)", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-02-turn-banner-p1.png") });
});

test("mobile — turn banner (vs AI, enemy phase)", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: /vs.*AI/i }).click();
  await page.waitForTimeout(1500); // let YOUR PHASE banner finish
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.78);
  }
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-03-turn-banner-enemy.png") });
});

test("mobile — victory crackers (early)", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(200);
  await page.goto("http://localhost:3000?victory-demo=1");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, "mobile-04-victory-early.png") });
});

test("mobile — victory crackers (peak)", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(200);
  await page.goto("http://localhost:3000?victory-demo=2");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "mobile-05-victory-peak.png") });
});

test("mobile — turn banner with realistic short online name (Alice)", async ({ page }) => {
  await page.goto("http://localhost:3000?fake-name1=Alice&fake-name2=Bob");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-07-banner-name-short.png") });
});

test("mobile — turn banner with medium-length JP name", async ({ page }) => {
  await page.goto("http://localhost:3000?fake-name1=%E3%81%82%E3%81%84%E3%81%86%E3%81%88%E3%81%8A&fake-name2=Bob");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-08-banner-name-medium.png") });
});

test("mobile — turn banner with worst-case 20-char name", async ({ page }) => {
  // 20-char latin name (max allowed per the user manual): "AAAAAAAAAABBBBBBBBBB"
  await page.goto("http://localhost:3000?fake-name1=AAAAAAAAAABBBBBBBBBB&fake-name2=Bob");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-09-banner-name-latin20.png") });
});

test("mobile — turn banner with worst-case 20-char JP name", async ({ page }) => {
  // 20 fullwidth chars — the worst-case visual width
  const long = encodeURIComponent("あいうえおかきくけこさしすせそたちつてと");
  await page.goto(`http://localhost:3000?fake-name1=${long}&fake-name2=Bob`);
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "mobile-10-banner-name-jp20.png") });
});

test("mobile — in-game header (no banner)", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(1600); // wait until banner gone
  await page.screenshot({ path: path.join(OUT, "mobile-06-in-game.png") });
});
