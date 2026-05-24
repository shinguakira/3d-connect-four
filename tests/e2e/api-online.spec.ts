import { test, expect, type APIRequestContext } from "@playwright/test";
import { resetServer } from "./helpers";

// Pure HTTP-level tests against the dev server. No browser, no mocks.
// These exercise the real route handlers and the GameManager singleton so a
// migration (e.g. Turbopack) that broke route-to-route state sharing would
// fail loudly here.

test.describe.configure({ mode: "serial" });

async function createRoom(request: APIRequestContext, name: string) {
  const res = await request.post("/api/game/create", { data: { playerName: name } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return { roomId: body.room.id as string, playerId: body.playerId as string };
}

async function joinRoom(request: APIRequestContext, roomId: string, name: string) {
  const res = await request.post(`/api/game/join/${roomId}`, { data: { playerName: name } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return { roomId: body.room.id as string, playerId: body.playerId as string };
}

async function quickMatch(request: APIRequestContext, name: string) {
  const res = await request.post("/api/game/quick-match", { data: { playerName: name } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return {
    roomId: body.room.id as string,
    playerId: body.playerId as string,
    matched: body.matched as boolean,
  };
}

async function startGame(request: APIRequestContext, roomId: string, playerId: string) {
  return request.post(`/api/game/${roomId}/start`, { data: { playerId } });
}

// Bring a 2-player room from "both joined" to "actually playing" by marking
// both players ready in sequence. Use this anywhere a test previously
// assumed startGame(host) was enough.
async function readyBothAndStart(
  request: APIRequestContext,
  roomId: string,
  hostId: string,
  guestId: string,
) {
  await startGame(request, roomId, hostId);
  return startGame(request, roomId, guestId);
}

async function move(
  request: APIRequestContext,
  roomId: string,
  playerId: string,
  x: number,
  z: number,
) {
  return request.post(`/api/game/${roomId}/move`, { data: { playerId, x, z } });
}

test.describe("API: room creation", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("create returns a 6-char roomId and a playerId", async ({ request }) => {
    const { roomId, playerId } = await createRoom(request, "Host");
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(playerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("debug GET reflects newly created rooms", async ({ request }) => {
    await createRoom(request, "Host");
    const debug = await request.get("/api/game/debug");
    const body = await debug.json();
    expect(body.totalRooms).toBe(1);
    expect(body.rooms[0].players).toHaveLength(1);
  });
});

test.describe("API: join flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("a guest can join an existing room", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    expect(guest.roomId).toBe(host.roomId);
    expect(guest.playerId).not.toBe(host.playerId);
  });

  test("joining a non-existent room returns 404", async ({ request }) => {
    const res = await request.post(`/api/game/join/NOPE99`, { data: { playerName: "x" } });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("a third player is rejected with 404", async ({ request }) => {
    const host = await createRoom(request, "Host");
    await joinRoom(request, host.roomId, "Guest");
    const res = await request.post(`/api/game/join/${host.roomId}`, {
      data: { playerName: "Third" },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("API: quick-match flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("first quick-match creates a waiting room; second joins it", async ({ request }) => {
    const a = await quickMatch(request, "Alice");
    expect(a.matched).toBe(false);

    const b = await quickMatch(request, "Bob");
    expect(b.matched).toBe(true);
    expect(b.roomId).toBe(a.roomId);
    expect(b.playerId).not.toBe(a.playerId);

    const debug = await request.get("/api/game/debug");
    const body = await debug.json();
    expect(body.totalRooms).toBe(1);
    expect(body.rooms[0].players).toHaveLength(2);
  });

  test("third quick-match creates a new waiting room (does not over-fill)", async ({ request }) => {
    const a = await quickMatch(request, "A");
    const b = await quickMatch(request, "B");
    const c = await quickMatch(request, "C");
    expect(c.roomId).not.toBe(a.roomId);
    expect(c.roomId).not.toBe(b.roomId);
    expect(c.matched).toBe(false);
    const debug = await request.get("/api/game/debug");
    const body = await debug.json();
    expect(body.totalRooms).toBe(2);
  });
});

test.describe("API: ready / start gating (both players must approve)", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("cannot ready up with only one player", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const res = await startGame(request, host.roomId, host.playerId);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Need exactly 2 players/);
  });

  test("ready by an unknown player returns 404", async ({ request }) => {
    const host = await createRoom(request, "Host");
    await joinRoom(request, host.roomId, "Guest");
    const res = await startGame(request, host.roomId, "no-such-player");
    expect(res.status()).toBe(404);
  });

  test("a single player's ready does NOT start the game", async ({ request }) => {
    const host = await createRoom(request, "Host");
    await joinRoom(request, host.roomId, "Guest");

    const res = await startGame(request, host.roomId, host.playerId);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.started).toBe(false);
    expect(body.restarted).toBe(false);
    expect(body.room.readyPlayerIds).toContain(host.playerId);
    expect(body.room.gameStarted).toBe(false);

    const debug = await request.get("/api/game/debug");
    const debugBody = await debug.json();
    expect(debugBody.rooms[0].gameStarted).toBe(false);
  });

  test("ready is idempotent: the same player twice still doesn't start", async ({ request }) => {
    const host = await createRoom(request, "Host");
    await joinRoom(request, host.roomId, "Guest");
    await startGame(request, host.roomId, host.playerId);
    const dup = await startGame(request, host.roomId, host.playerId);
    const body = await dup.json();
    expect(body.started).toBe(false);
    expect(body.room.gameStarted).toBe(false);
    expect(body.room.readyPlayerIds).toEqual([host.playerId]);
  });

  test("the second player's ready flips gameStarted and clears the ready set", async ({
    request,
  }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");

    await startGame(request, host.roomId, host.playerId);
    const second = await startGame(request, host.roomId, guest.playerId);
    expect(second.ok()).toBeTruthy();
    const body = await second.json();
    expect(body.started).toBe(true);
    expect(body.restarted).toBe(false);
    expect(body.room.gameStarted).toBe(true);
    expect(body.room.readyPlayerIds).toEqual([]);
  });

  test("moves are still blocked while only one side is ready", async ({ request }) => {
    const host = await createRoom(request, "Host");
    await joinRoom(request, host.roomId, "Guest");
    await startGame(request, host.roomId, host.playerId);

    const res = await move(request, host.roomId, host.playerId, 0, 0);
    expect(res.status()).toBe(400);
  });
});

test.describe("API: rematch gating (after a finished game)", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  async function playToWin(request: APIRequestContext) {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    await startGame(request, host.roomId, host.playerId);
    await startGame(request, host.roomId, guest.playerId);
    const plan: Array<[string, number, number]> = [
      [host.playerId, 0, 0],
      [guest.playerId, 0, 1],
      [host.playerId, 1, 0],
      [guest.playerId, 1, 1],
      [host.playerId, 2, 0],
      [guest.playerId, 2, 1],
      [host.playerId, 3, 0], // host wins along x
    ];
    for (const [pid, x, z] of plan) {
      await move(request, host.roomId, pid, x, z);
    }
    return { host, guest };
  }

  test("one-sided rematch ready does NOT reset the board", async ({ request }) => {
    const { host } = await playToWin(request);
    const res = await startGame(request, host.roomId, host.playerId);
    const body = await res.json();
    expect(body.restarted).toBe(false);
    expect(body.room.gameOver).toBe(true);
    expect(body.room.gameState[0][0][0]).toBe(1); // pieces still there
  });

  test("both players ready triggers rematch: board cleared, currentPlayer=1, gameStarted stays true", async ({
    request,
  }) => {
    const { host, guest } = await playToWin(request);
    await startGame(request, host.roomId, host.playerId);
    const res = await startGame(request, host.roomId, guest.playerId);
    const body = await res.json();
    expect(body.restarted).toBe(true);
    expect(body.started).toBe(false);
    expect(body.room.gameOver).toBe(false);
    expect(body.room.winner).toBeNull();
    expect(body.room.currentPlayer).toBe(1);
    expect(body.room.gameStarted).toBe(true);
    expect(body.room.readyPlayerIds).toEqual([]);
    // Fresh board.
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        for (let z = 0; z < 4; z++) {
          expect(body.room.gameState[x][y][z]).toBeNull();
        }
      }
    }
  });

  test("after rematch, moves are processed normally", async ({ request }) => {
    const { host, guest } = await playToWin(request);
    await startGame(request, host.roomId, host.playerId);
    await startGame(request, host.roomId, guest.playerId);

    const m = await move(request, host.roomId, host.playerId, 2, 2);
    expect(m.ok()).toBeTruthy();
    const after = await m.json();
    expect(after.room.gameState[2][0][2]).toBe(1);
    expect(after.room.currentPlayer).toBe(2);
  });
});

test.describe("API: move processing", () => {
  test.beforeEach(async ({ request }) => {
    await resetServer(request);
  });

  test("moves before start are rejected with 400", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    const res = await move(request, host.roomId, host.playerId, 0, 0);
    expect(res.status()).toBe(400);
    // sanity: also reject the other player
    const res2 = await move(request, host.roomId, guest.playerId, 0, 0);
    expect(res2.status()).toBe(400);
  });

  test("only the player whose turn it is can move", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    await readyBothAndStart(request, host.roomId, host.playerId, guest.playerId);

    // Guest cannot move first.
    const res1 = await move(request, host.roomId, guest.playerId, 0, 0);
    expect(res1.status()).toBe(400);

    // Host moves first.
    const res2 = await move(request, host.roomId, host.playerId, 0, 0);
    expect(res2.ok()).toBeTruthy();

    // Host cannot move again.
    const res3 = await move(request, host.roomId, host.playerId, 1, 0);
    expect(res3.status()).toBe(400);
  });

  test("a player cannot drop into a full column", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    await readyBothAndStart(request, host.roomId, host.playerId, guest.playerId);

    // Fill (0, 0) by alternating.
    for (let i = 0; i < 4; i++) {
      const pid = i % 2 === 0 ? host.playerId : guest.playerId;
      const res = await move(request, host.roomId, pid, 0, 0);
      expect(res.ok(), `move ${i} should succeed`).toBeTruthy();
    }
    // 5th move into the same column must fail.
    const nextPid = host.playerId; // currentPlayer is back to 1 after 4 moves
    const overflow = await move(request, host.roomId, nextPid, 0, 0);
    expect(overflow.status()).toBe(400);
  });

  test("server reports the winner and blocks further moves", async ({ request }) => {
    const host = await createRoom(request, "Host");
    const guest = await joinRoom(request, host.roomId, "Guest");
    await readyBothAndStart(request, host.roomId, host.playerId, guest.playerId);

    // Host wins along x at y=0, z=0.
    const plan: Array<[string, number, number]> = [
      [host.playerId, 0, 0],
      [guest.playerId, 0, 1],
      [host.playerId, 1, 0],
      [guest.playerId, 1, 1],
      [host.playerId, 2, 0],
      [guest.playerId, 2, 1],
      [host.playerId, 3, 0], // winning move
    ];

    let last;
    for (const [pid, x, z] of plan) {
      const res = await move(request, host.roomId, pid, x, z);
      expect(res.ok()).toBeTruthy();
      last = await res.json();
    }
    expect(last.room.winner).toBe(1);
    expect(last.room.gameOver).toBe(true);

    // Any further move is rejected.
    const dead = await move(request, host.roomId, guest.playerId, 3, 3);
    expect(dead.status()).toBe(400);
  });
});
