import { test, expect, type Page } from "@playwright/test"

const ROOM_TIMEOUT = 30_000

async function gotoQuickMatch(page: Page, name: string) {
  await page.goto("/")
  await page.getByRole("button", { name: /オンライン/ }).first().click()
  await expect(page.getByText("オンライン対戦")).toBeVisible()
  await page.getByLabel("プレイヤー名").fill(name)
  // Quick tab is the default, but click to be safe.
  await page.getByRole("button", { name: "クイック", exact: true }).click()
  await page.getByRole("button", { name: "クイックマッチ開始" }).click()
}

test.describe("Online quick-match (two browsers)", () => {
  // Two contexts share the dev server's in-memory GameManager.
  // Long timeouts cover Next.js dev's on-demand route compilation.
  test.setTimeout(120_000)

  test("both players match into the same waiting room and can start the game", async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      // Player A creates the room (no waiting opponent yet).
      await gotoQuickMatch(pageA, "Alice")
      await expect(pageA.getByText(/ルーム:/)).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageA.getByText("Alice")).toBeVisible()

      // Player B joins the waiting room created by A.
      await gotoQuickMatch(pageB, "Bob")
      await expect(pageB.getByText(/ルーム:/)).toBeVisible({ timeout: ROOM_TIMEOUT })

      // Both pages now see both players (SSE-driven).
      await expect(pageA.getByText("Bob")).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageB.getByText("Alice")).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageB.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: ROOM_TIMEOUT })

      // Either player can press start; have A do it.
      await pageA.getByRole("button", { name: /ゲーム開始/ }).click()

      // Both clients transition to the game canvas.
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: ROOM_TIMEOUT })
      await expect(pageA.getByText("オンライン").first()).toBeVisible()
      await expect(pageB.getByText("オンライン").first()).toBeVisible()
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })
})
