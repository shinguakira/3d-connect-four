import { type Page, type APIRequestContext, expect } from "@playwright/test"

export async function resetServer(request: APIRequestContext) {
  const res = await request.post("/api/game/debug")
  expect(res.ok(), "POST /api/game/debug must succeed").toBeTruthy()
}

export type OnlineHandle = { roomId: string; playerId: string }

/**
 * Open the title page, navigate to the online menu, and trigger one of the
 * three flows: quick-match, room create, or room join. Capture the matching
 * server response so the caller has the playerId / roomId for direct API
 * calls (driving real moves over the network).
 */
export async function gotoOnline(
  page: Page,
  opts:
    | { kind: "quick"; name: string }
    | { kind: "create"; name: string }
    | { kind: "join"; name: string; roomId: string },
): Promise<OnlineHandle> {
  await page.goto("/")
  await page.getByRole("button", { name: /オンライン/ }).first().click()
  await expect(page.getByText("オンライン対戦")).toBeVisible()
  await page.getByLabel("プレイヤー名").fill(opts.name)

  let urlPattern: RegExp
  let submitName: string

  if (opts.kind === "quick") {
    await page.getByRole("button", { name: "クイック", exact: true }).click()
    urlPattern = /\/api\/game\/quick-match$/
    submitName = "クイックマッチ開始"
  } else if (opts.kind === "create") {
    await page.getByRole("button", { name: "作成", exact: true }).click()
    urlPattern = /\/api\/game\/create$/
    submitName = "ルーム作成"
  } else {
    await page.getByRole("button", { name: "参加", exact: true }).click()
    await page.getByLabel("ルームID").fill(opts.roomId)
    urlPattern = /\/api\/game\/join\//
    submitName = "ルームに参加"
  }

  const responsePromise = page.waitForResponse(
    (r) => urlPattern.test(r.url()) && r.request().method() === "POST",
  )
  await page.getByRole("button", { name: submitName }).click()
  const response = await responsePromise
  const body = await response.json()
  if (!body.success) {
    throw new Error(`Online action failed: ${JSON.stringify(body)}`)
  }
  return { roomId: body.room.id, playerId: body.playerId }
}

export async function pressStartGame(page: Page) {
  await page.getByRole("button", { name: /ゲーム開始/ }).click()
}

export async function makeMoveAsApi(
  request: APIRequestContext,
  handle: OnlineHandle,
  x: number,
  z: number,
) {
  const res = await request.post(`/api/game/${handle.roomId}/move`, {
    data: { playerId: handle.playerId, x, z },
  })
  return { ok: res.ok(), status: res.status(), body: await res.json() }
}
