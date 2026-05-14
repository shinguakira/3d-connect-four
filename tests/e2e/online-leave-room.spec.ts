import { test, expect } from "@playwright/test"
import { gotoOnline, resetServer } from "./helpers"

test.describe("Online: leaving / disconnecting", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request)
  })

  test("leave button takes a waiting player back to the title", async ({ page }) => {
    await gotoOnline(page, { kind: "create", name: "Solo" })
    await page.getByRole("button", { name: "ルームを退出" }).click()
    await expect(page.getByText("3D4目並べゲーム")).toBeVisible()
  })

  test("when one player closes their tab the other sees them go offline", async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      const host = await gotoOnline(pageA, { kind: "create", name: "Host" })
      await gotoOnline(pageB, { kind: "join", name: "Guest", roomId: host.roomId })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 })
      // Guest currently appears online on the host's screen.
      await expect(pageA.getByText("オンライン", { exact: true }).first()).toBeVisible()

      // Guest disconnects.
      await ctxB.close()

      // Host eventually sees the guest's connection flip to offline (within
      // a couple of the 2-second SSE poll cycles).
      await expect(pageA.getByText("オフライン")).toBeVisible({ timeout: 30_000 })
    } finally {
      await ctxA.close()
      try {
        await ctxB.close()
      } catch {
        /* may already be closed */
      }
    }
  })
})
