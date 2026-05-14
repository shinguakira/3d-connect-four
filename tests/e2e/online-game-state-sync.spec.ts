import { test, expect } from "@playwright/test"
import { gotoOnline, makeMoveAsApi, pressStartGame, resetServer } from "./helpers"

test.describe("Online: in-game state propagation", () => {
  test.setTimeout(180_000)

  test.beforeEach(async ({ request }) => {
    await resetServer(request)
  })

  test("a move from one player updates the turn indicator on both clients", async ({ browser, request }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" })
      const b = await gotoOnline(pageB, { kind: "quick", name: "Bob" })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 })
      await pressStartGame(pageA)
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 })
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 })

      // Initially, Alice is on the move; both headers show "Alice".
      await expect(pageA.getByText("Alice").first()).toBeVisible({ timeout: 10_000 })
      await expect(pageB.getByText("Alice").first()).toBeVisible({ timeout: 10_000 })

      // Bob tries to move out of turn — server must reject (400).
      const wrongTurn = await makeMoveAsApi(request, b, 0, 0)
      expect(wrongTurn.status).toBe(400)
      expect(wrongTurn.body.success).toBe(false)

      // Alice plays. Both clients should swing to "Bob".
      const ok = await makeMoveAsApi(request, a, 0, 0)
      expect(ok.ok).toBe(true)
      expect(ok.body.success).toBe(true)

      await expect(pageA.getByText("Bob").first()).toBeVisible({ timeout: 15_000 })
      await expect(pageB.getByText("Bob").first()).toBeVisible({ timeout: 15_000 })

      // Bob plays. Both flip back to "Alice".
      const ok2 = await makeMoveAsApi(request, b, 1, 0)
      expect(ok2.ok).toBe(true)
      await expect(pageA.getByText("Alice").first()).toBeVisible({ timeout: 15_000 })
      await expect(pageB.getByText("Alice").first()).toBeVisible({ timeout: 15_000 })
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test("server-side win detection ends the game and shows the victory overlay on both clients", async ({
    browser,
    request,
  }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" })
      const b = await gotoOnline(pageB, { kind: "quick", name: "Bob" })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 })
      await pressStartGame(pageA)
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 })
      await expect(pageB.locator("canvas").first()).toBeVisible({ timeout: 30_000 })

      // Drive Alice to a 4-in-a-row along x at z=0, y=0; Bob plays at z=1.
      const moves: Array<{ pid: typeof a; x: number; z: number }> = [
        { pid: a, x: 0, z: 0 },
        { pid: b, x: 0, z: 1 },
        { pid: a, x: 1, z: 0 },
        { pid: b, x: 1, z: 1 },
        { pid: a, x: 2, z: 0 },
        { pid: b, x: 2, z: 1 },
        { pid: a, x: 3, z: 0 }, // winning move
      ]
      for (const m of moves) {
        const r = await makeMoveAsApi(request, m.pid, m.x, m.z)
        expect(r.ok, `move ${JSON.stringify(m)} should succeed`).toBe(true)
        expect(r.body.success).toBe(true)
      }

      // Both clients render the victory modal with Alice as the winner.
      // (The modal heading is rendered by GamePage when room.winner is set.)
      await expect(pageA.getByRole("button", { name: /新しいゲーム/ })).toBeVisible({ timeout: 15_000 })
      await expect(pageB.getByRole("button", { name: /新しいゲーム/ })).toBeVisible({ timeout: 15_000 })

      // Further moves are rejected by the server.
      const denied = await makeMoveAsApi(request, b, 3, 1)
      expect(denied.ok).toBe(false)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test("gravity is enforced server-side: pieces stack vertically in the same column", async ({
    browser,
    request,
  }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" })
      const b = await gotoOnline(pageB, { kind: "quick", name: "Bob" })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 })
      await pressStartGame(pageA)
      await expect(pageA.locator("canvas").first()).toBeVisible({ timeout: 30_000 })

      // Both players keep dropping into the same column (0,0). After 4 drops the column is full.
      for (const m of [a, b, a, b]) {
        const r = await makeMoveAsApi(request, m, 0, 0)
        expect(r.ok).toBe(true)
        expect(r.body.success).toBe(true)
      }
      // Fifth drop into the same column must be rejected.
      const denied = await makeMoveAsApi(request, a, 0, 0)
      expect(denied.ok).toBe(false)
      expect(denied.body.success).toBe(false)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test("moves before the host presses start are rejected", async ({ browser, request }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      const a = await gotoOnline(pageA, { kind: "quick", name: "Alice" })
      await gotoOnline(pageB, { kind: "quick", name: "Bob" })
      await expect(pageA.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 })

      // Start has not been pressed yet — the server must reject.
      const r = await makeMoveAsApi(request, a, 0, 0)
      expect(r.ok).toBe(false)
      expect(r.body.success).toBe(false)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })
})
