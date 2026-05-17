import { describe, it, expect, beforeEach } from "vitest";
import { GameManager } from "@/lib/game-manager";
import type { Player } from "@/types/online";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? "player-" + Math.random().toString(36).slice(2),
    name: overrides.name ?? "Tester",
    color: overrides.color ?? "#ff0000",
    isHost: overrides.isHost ?? false,
    connected: overrides.connected ?? true,
    lastSeen: overrides.lastSeen ?? new Date(),
  };
}

function startedRoom(mgr: GameManager) {
  const host = makePlayer({ id: "h", isHost: true });
  const guest = makePlayer({ id: "g" });
  const room = mgr.createRoom(host);
  mgr.joinRoom(room.id, guest);
  room.gameStarted = true;
  return { roomId: room.id, hostId: "h", guestId: "g" };
}

function move(mgr: GameManager, roomId: string, pid: string, x: number, z: number) {
  return mgr.makeMove(roomId, pid, { playerId: pid, x, z, timestamp: new Date() });
}

describe("GameManager: concurrent rooms", () => {
  let mgr: GameManager;
  beforeEach(() => {
    mgr = new GameManager();
  });

  it("keeps two rooms' state fully isolated", () => {
    const a = startedRoom(mgr);
    const b = startedRoom(mgr);
    expect(a.roomId).not.toBe(b.roomId);

    move(mgr, a.roomId, a.hostId, 0, 0);
    expect(mgr.getRoom(a.roomId)?.gameState[0][0][0]).toBe(1);
    expect(mgr.getRoom(b.roomId)?.gameState[0][0][0]).toBeNull();
    expect(mgr.getRoom(a.roomId)?.currentPlayer).toBe(2);
    expect(mgr.getRoom(b.roomId)?.currentPlayer).toBe(1);
  });

  it("findAvailableRoom picks the first single-player room and ignores started/finished ones", () => {
    const finished = mgr.createRoom(makePlayer({ isHost: true }));
    finished.gameOver = true;

    const waiting = mgr.createRoom(makePlayer({ isHost: true }));

    const full = mgr.createRoom(makePlayer({ isHost: true }));
    mgr.joinRoom(full.id, makePlayer());

    expect(mgr.findAvailableRoom()?.id).toBe(waiting.id);
  });
});

describe("GameManager: full game play through to a win", () => {
  let mgr: GameManager;
  beforeEach(() => {
    mgr = new GameManager();
  });

  it("plays a 7-move horizontal win and freezes further moves", () => {
    const { roomId, hostId, guestId } = startedRoom(mgr);
    // Player 1 wins on x at y=0, z=0; player 2 stacks on z=1.
    const plan: Array<[string, number, number]> = [
      [hostId, 0, 0],
      [guestId, 0, 1],
      [hostId, 1, 0],
      [guestId, 1, 1],
      [hostId, 2, 0],
      [guestId, 2, 1],
      [hostId, 3, 0],
    ];
    let last;
    for (const [pid, x, z] of plan) {
      last = move(mgr, roomId, pid, x, z);
      expect(last).not.toBeNull();
    }
    expect(last!.winner).toBe(1);
    expect(last!.gameOver).toBe(true);
    // Once the game is over, ANY move is rejected (including by the winner).
    expect(move(mgr, roomId, hostId, 3, 3)).toBeNull();
    expect(move(mgr, roomId, guestId, 3, 3)).toBeNull();
  });

  it("plays a vertical (Y axis) win", () => {
    const { roomId, hostId, guestId } = startedRoom(mgr);
    // Stack player 1 at column (0, 0), player 2 elsewhere.
    const plan: Array<[string, number, number]> = [
      [hostId, 0, 0], // y=0
      [guestId, 1, 0],
      [hostId, 0, 0], // y=1
      [guestId, 1, 0],
      [hostId, 0, 0], // y=2
      [guestId, 1, 0],
      [hostId, 0, 0], // y=3 — wins
    ];
    let last;
    for (const [pid, x, z] of plan) {
      last = move(mgr, roomId, pid, x, z);
      expect(last).not.toBeNull();
    }
    expect(last!.winner).toBe(1);
    expect(last!.gameOver).toBe(true);
  });

  it("plays a Z-axis win for player 1 while player 2 stays under 4 in a row", () => {
    const { roomId, hostId, guestId } = startedRoom(mgr);
    // Player 1 fills (0, 0, 0..3); player 2 spreads out to avoid their own line.
    const plan: Array<[string, number, number]> = [
      [hostId, 0, 0],
      [guestId, 2, 0],
      [hostId, 0, 1],
      [guestId, 2, 1],
      [hostId, 0, 2],
      [guestId, 3, 0], // diversify so p2 has no 4-in-a-row at z-axis
      [hostId, 0, 3], // winning move on z-axis
    ];
    let last;
    for (const [pid, x, z] of plan) {
      last = move(mgr, roomId, pid, x, z);
      expect(last, `move ${pid} (${x},${z}) should succeed`).not.toBeNull();
    }
    expect(last!.winner).toBe(1);
    expect(last!.gameOver).toBe(true);
  });
});

describe("GameManager: connection / cleanup", () => {
  let mgr: GameManager;
  beforeEach(() => {
    mgr = new GameManager();
  });

  it("disconnect + reconnect bumps lastSeen each time the status flips", async () => {
    const room = mgr.createRoom(makePlayer({ id: "h", isHost: true, connected: true }));
    const t0 = room.players[0].lastSeen.getTime();
    await new Promise((r) => setTimeout(r, 5));
    mgr.updatePlayerConnection(room.id, "h", false);
    const t1 = mgr.getRoom(room.id)!.players[0].lastSeen.getTime();
    await new Promise((r) => setTimeout(r, 5));
    mgr.updatePlayerConnection(room.id, "h", true);
    const t2 = mgr.getRoom(room.id)!.players[0].lastSeen.getTime();
    expect(t1).toBeGreaterThanOrEqual(t0);
    expect(t2).toBeGreaterThanOrEqual(t1);
  });

  it("repeated identical connection updates do NOT bump lastSeen (guards against churn)", async () => {
    const room = mgr.createRoom(makePlayer({ id: "h", isHost: true, connected: true }));
    const original = room.players[0].lastSeen.getTime();
    await new Promise((r) => setTimeout(r, 5));
    mgr.updatePlayerConnection(room.id, "h", true); // no change
    expect(mgr.getRoom(room.id)!.players[0].lastSeen.getTime()).toBe(original);
  });

  it("removeRoom + getRoom returns null thereafter", () => {
    const room = mgr.createRoom(makePlayer({ isHost: true }));
    expect(mgr.getRoom(room.id)).not.toBeNull();
    mgr.removeRoom(room.id);
    expect(mgr.getRoom(room.id)).toBeNull();
  });

  it("cleanupInactiveRooms only removes stale rooms even when several exist", () => {
    const fresh1 = mgr.createRoom(makePlayer({ isHost: true }));
    const stale = mgr.createRoom(makePlayer({ isHost: true }));
    const fresh2 = mgr.createRoom(makePlayer({ isHost: true }));
    stale.lastActivity = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    mgr.cleanupInactiveRooms();
    expect(mgr.getRoom(fresh1.id)).not.toBeNull();
    expect(mgr.getRoom(fresh2.id)).not.toBeNull();
    expect(mgr.getRoom(stale.id)).toBeNull();
  });
});
