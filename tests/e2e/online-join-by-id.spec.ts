import { test, expect } from "@playwright/test";
import { gotoOnline, resetServer } from "./helpers";

test.describe("Online: join by room id", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("guest joining the host's room id puts both clients in the same room", async ({
    browser,
  }) => {
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const pageGuest = await ctxGuest.newPage();

    try {
      const host = await gotoOnline(pageHost, { kind: "create", name: "Host" });
      await expect(pageHost.getByText(`ルーム: ${host.roomId}`)).toBeVisible();

      const guest = await gotoOnline(pageGuest, {
        kind: "join",
        name: "Guest",
        roomId: host.roomId,
      });
      expect(guest.roomId).toBe(host.roomId);

      // Both pages converge on the 2/2 waiting state via SSE.
      await expect(pageGuest.getByText(`ルーム: ${host.roomId}`)).toBeVisible({ timeout: 15_000 });
      await expect(pageHost.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageGuest.getByText("プレイヤー (2/2)")).toBeVisible({ timeout: 15_000 });
      await expect(pageHost.getByText("Guest")).toBeVisible({ timeout: 15_000 });
      await expect(pageGuest.getByText("Host")).toBeVisible({ timeout: 15_000 });

      // Host is labelled host on both clients; guest is not.
      await expect(pageHost.getByText("ホスト")).toBeVisible();
      await expect(pageGuest.getByText("ホスト")).toBeVisible();
    } finally {
      await ctxHost.close();
      await ctxGuest.close();
    }
  });

  test("rejects joining a non-existent room with a visible error", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /オンライン/ })
      .first()
      .click();
    await page.getByLabel("プレイヤー名").fill("LostPlayer");
    await page.getByRole("button", { name: "参加", exact: true }).click();
    await page.getByLabel("ルームID").fill("ZZZZZZ");
    await page.getByRole("button", { name: "ルームに参加" }).click();

    await expect(page.getByText(/ルーム参加に失敗しました|ルームが見つからない/)).toBeVisible({
      timeout: 10_000,
    });
    // Stays on the menu rather than transitioning to a waiting screen.
    await expect(page.getByText("オンライン対戦")).toBeVisible();
  });

  test("rejects joining a full room", async ({ browser, request }) => {
    const ctxHost = await browser.newContext();
    const ctxGuest1 = await browser.newContext();
    const ctxGuest2 = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const pageGuest1 = await ctxGuest1.newPage();
    const pageGuest2 = await ctxGuest2.newPage();

    try {
      const host = await gotoOnline(pageHost, { kind: "create", name: "Host" });
      await gotoOnline(pageGuest1, { kind: "join", name: "G1", roomId: host.roomId });

      // Third API call to /join/{roomId} should be rejected (404).
      const res = await request.post(`/api/game/join/${host.roomId}`, {
        data: { playerName: "G2-Late" },
      });
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);

      // And the same is reflected through the UI flow.
      await pageGuest2.goto("/");
      await pageGuest2
        .getByRole("button", { name: /オンライン/ })
        .first()
        .click();
      await pageGuest2.getByLabel("プレイヤー名").fill("G2");
      await pageGuest2.getByRole("button", { name: "参加", exact: true }).click();
      await pageGuest2.getByLabel("ルームID").fill(host.roomId);
      await pageGuest2.getByRole("button", { name: "ルームに参加" }).click();
      await expect(
        pageGuest2.getByText(/ルーム参加に失敗しました|ルームが見つからない/),
      ).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await ctxHost.close();
      await ctxGuest1.close();
      await ctxGuest2.close();
    }
  });
});
