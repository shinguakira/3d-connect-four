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

describe("GameManager", () => {
  let mgr: GameManager;

  beforeEach(() => {
    mgr = new GameManager();
  });

  describe("createRoom", () => {
    it("creates a room with the host as the only player and an empty board", () => {
      const host = makePlayer({ name: "Host", isHost: true });
      const room = mgr.createRoom(host);
      expect(room.players).toEqual([host]);
      expect(room.currentPlayer).toBe(1);
      expect(room.gameStarted).toBe(false);
      expect(room.gameOver).toBe(false);
      expect(room.winner).toBeNull();
      expect(room.gameState).toHaveLength(4);
      expect(room.gameState[0][0][0]).toBeNull();
    });

    it("generates unique-looking room ids", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) ids.add(mgr.createRoom(makePlayer()).id);
      expect(ids.size).toBe(20);
    });
  });

  describe("joinRoom", () => {
    it("adds a second player when there is room", () => {
      const room = mgr.createRoom(makePlayer({ isHost: true }));
      const guest = makePlayer({ name: "Guest" });
      const joined = mgr.joinRoom(room.id, guest);
      expect(joined?.players).toHaveLength(2);
      expect(joined?.players[1]).toEqual(guest);
    });

    it("rejects a third player", () => {
      const room = mgr.createRoom(makePlayer({ isHost: true }));
      mgr.joinRoom(room.id, makePlayer());
      const denied = mgr.joinRoom(room.id, makePlayer());
      expect(denied).toBeNull();
    });

    it("returns null for an unknown room", () => {
      expect(mgr.joinRoom("NOPE", makePlayer())).toBeNull();
    });
  });

  describe("makeMove", () => {
    it("rejects moves before the game is started", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      const result = mgr.makeMove(room.id, "h", {
        playerId: "h",
        x: 0,
        z: 0,
        timestamp: new Date(),
      });
      expect(result).toBeNull();
    });

    it("rejects moves from the wrong player", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      room.gameStarted = true;
      const result = mgr.makeMove(room.id, "g", {
        playerId: "g",
        x: 0,
        z: 0,
        timestamp: new Date(),
      });
      expect(result).toBeNull();
    });

    it("places a piece, alternates turn, and updates lastActivity", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      room.gameStarted = true;
      const before = room.lastActivity.getTime();

      const after = mgr.makeMove(room.id, "h", {
        playerId: "h",
        x: 1,
        z: 2,
        timestamp: new Date(),
      });
      expect(after).not.toBeNull();
      expect(after!.gameState[1][0][2]).toBe(1);
      expect(after!.currentPlayer).toBe(2);
      expect(after!.lastActivity.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("stacks pieces by gravity in the same column", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      room.gameStarted = true;

      mgr.makeMove(room.id, "h", { playerId: "h", x: 0, z: 0, timestamp: new Date() });
      mgr.makeMove(room.id, "g", { playerId: "g", x: 0, z: 0, timestamp: new Date() });
      const final = mgr.makeMove(room.id, "h", {
        playerId: "h",
        x: 0,
        z: 0,
        timestamp: new Date(),
      });
      expect(final!.gameState[0][0][0]).toBe(1);
      expect(final!.gameState[0][1][0]).toBe(2);
      expect(final!.gameState[0][2][0]).toBe(1);
    });

    it("declares a winner and freezes the game when 4 in a row form", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      room.gameStarted = true;

      // Player 1 wins along x-axis at row y=0, z=0; player 2 fills different column.
      const moves: Array<[string, number, number]> = [
        ["h", 0, 0],
        ["g", 0, 1],
        ["h", 1, 0],
        ["g", 1, 1],
        ["h", 2, 0],
        ["g", 2, 1],
        ["h", 3, 0], // winning move
      ];
      let last;
      for (const [pid, x, z] of moves) {
        last = mgr.makeMove(room.id, pid, { playerId: pid, x, z, timestamp: new Date() });
        expect(last).not.toBeNull();
      }
      expect(last!.winner).toBe(1);
      expect(last!.gameOver).toBe(true);
      expect(last!.currentPlayer).toBe(1); // turn does NOT advance after a win

      // Further moves are rejected
      const denied = mgr.makeMove(room.id, "g", {
        playerId: "g",
        x: 3,
        z: 3,
        timestamp: new Date(),
      });
      expect(denied).toBeNull();
    });

    it("rejects a move into a full column", () => {
      const host = makePlayer({ isHost: true, id: "h" });
      const guest = makePlayer({ id: "g" });
      const room = mgr.createRoom(host);
      mgr.joinRoom(room.id, guest);
      room.gameStarted = true;
      const seq: Array<[string, number, number]> = [
        ["h", 0, 0],
        ["g", 0, 0],
        ["h", 0, 0],
        ["g", 0, 0],
      ];
      for (const [pid, x, z] of seq) {
        mgr.makeMove(room.id, pid, { playerId: pid, x, z, timestamp: new Date() });
      }
      const denied = mgr.makeMove(room.id, "h", {
        playerId: "h",
        x: 0,
        z: 0,
        timestamp: new Date(),
      });
      expect(denied).toBeNull();
    });
  });

  describe("findAvailableRoom", () => {
    it("returns a room waiting for a second player", () => {
      const host = makePlayer({ isHost: true });
      const room = mgr.createRoom(host);
      expect(mgr.findAvailableRoom()?.id).toBe(room.id);
    });

    it("skips full rooms", () => {
      const room = mgr.createRoom(makePlayer({ isHost: true }));
      mgr.joinRoom(room.id, makePlayer());
      expect(mgr.findAvailableRoom()).toBeNull();
    });

    it("skips finished rooms", () => {
      const room = mgr.createRoom(makePlayer({ isHost: true }));
      room.gameOver = true;
      expect(mgr.findAvailableRoom()).toBeNull();
    });
  });

  describe("updatePlayerConnection", () => {
    it("updates connected and lastSeen when state changes", () => {
      const host = makePlayer({ isHost: true, id: "h", connected: true });
      const room = mgr.createRoom(host);
      const original = host.lastSeen.getTime();
      const updated = mgr.updatePlayerConnection(room.id, "h", false);
      const player = updated?.players.find((p) => p.id === "h");
      expect(player?.connected).toBe(false);
      expect(player?.lastSeen.getTime()).toBeGreaterThanOrEqual(original);
    });

    it("returns null for unknown rooms", () => {
      expect(mgr.updatePlayerConnection("NOPE", "x", true)).toBeNull();
    });
  });

  describe("cleanupInactiveRooms", () => {
    it("removes rooms with lastActivity older than 30 minutes", () => {
      const stale = mgr.createRoom(makePlayer({ isHost: true }));
      const fresh = mgr.createRoom(makePlayer({ isHost: true }));
      stale.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
      mgr.cleanupInactiveRooms();
      expect(mgr.getRoom(stale.id)).toBeNull();
      expect(mgr.getRoom(fresh.id)).not.toBeNull();
    });
  });
});
