import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(__dirname, "../../doc/images/preview");

// Uses the dev-only `?victory-demo=N` URL param in game-page.tsx to deterministically
// trigger a winner state. Captures the cracker burst at several points in the
// animation so we can see the arc.
test.describe.configure({ mode: "serial" });

async function gotoVictory(page: import("@playwright/test").Page, winner: 1 | 2) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:3000");
  // Land on two-player so GamePage mounts, then push the demo flag and reload.
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
  await page.waitForTimeout(200);
  await page.goto(`http://localhost:3000?victory-demo=${winner}`);
  // Re-enter the game from the menu — the menu state was reset by the reload.
  await page.getByRole("button", { name: /2.*プレイヤー/ }).click();
}

test("victory crackers — early burst (Player 1)", async ({ page }) => {
  await gotoVictory(page, 1);
  await page.waitForTimeout(250); // confetti just left the cracker
  await page.screenshot({ path: path.join(OUT, "victory-crackers-01-early.png") });
});

test("victory crackers — peak arc (Player 1)", async ({ page }) => {
  await gotoVictory(page, 1);
  await page.waitForTimeout(900); // mid-arc
  await page.screenshot({ path: path.join(OUT, "victory-crackers-02-peak.png") });
});

test("victory crackers — falling (Player 1)", async ({ page }) => {
  await gotoVictory(page, 1);
  await page.waitForTimeout(1800); // falling
  await page.screenshot({ path: path.join(OUT, "victory-crackers-03-falling.png") });
});

test("victory crackers — Player 2 (blue accent)", async ({ page }) => {
  await gotoVictory(page, 2);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "victory-crackers-04-p2.png") });
});
