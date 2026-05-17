import { describe, it, expect, beforeEach } from "vitest";
import {
  broadcastToRoom,
  connectionCount,
  fingerprintRoom,
  lastKnownStates,
  registerConnection,
  roomConnections,
  unregisterConnection,
} from "@/lib/sse-broadcast";
import type { GameRoom } from "@/types/online";

type Controller = ReadableStreamDefaultController<Uint8Array>;

function fakeController() {
  const enqueued: Uint8Array[] = [];
  let throws = false;
  const c = {
    enqueue(chunk: Uint8Array) {
      if (throws) throw new Error("controller closed");
      enqueued.push(chunk);
    },
    close: () => {},
    error: () => {},
    desiredSize: 1,
  } as unknown as Controller;
  return {
    controller: c,
    chunks: enqueued,
    decode: () => enqueued.map((u) => new TextDecoder().decode(u)).join(""),
    fail() {
      throws = true;
    },
  };
}

function emptyRoom(id: string): GameRoom {
  return {
    id,
    players: [],
    gameState: [],
    currentPlayer: 1,
    winner: null,
    gameOver: false,
    gameStarted: false,
    createdAt: new Date(0),
    lastActivity: new Date(0),
    settings: {
      player1Color: "#a",
      player2Color: "#b",
      showVerticalGrid: true,
      showHorizontalGrid: false,
    },
  } as GameRoom;
}

describe("sse-broadcast: registry lifecycle", () => {
  beforeEach(() => {
    // The maps are globalThis singletons; isolate each test.
    roomConnections.clear();
    lastKnownStates.clear();
  });

  it("registerConnection / connectionCount / unregisterConnection roundtrip", () => {
    const a = fakeController();
    const b = fakeController();

    expect(connectionCount("R1")).toBe(0);

    registerConnection("R1", a.controller);
    expect(connectionCount("R1")).toBe(1);

    registerConnection("R1", b.controller);
    expect(connectionCount("R1")).toBe(2);

    unregisterConnection("R1", a.controller);
    expect(connectionCount("R1")).toBe(1);

    unregisterConnection("R1", b.controller);
    expect(connectionCount("R1")).toBe(0);
    // last unregister should also drop the room key entirely.
    expect(roomConnections.has("R1")).toBe(false);
  });

  it("unregisterConnection on an unknown room is a no-op", () => {
    const a = fakeController();
    expect(() => unregisterConnection("nope", a.controller)).not.toThrow();
  });

  it("unregistering a controller cleans up lastKnownStates for that room", () => {
    const a = fakeController();
    registerConnection("R2", a.controller);
    lastKnownStates.set("R2", "any-fp");
    unregisterConnection("R2", a.controller);
    expect(lastKnownStates.has("R2")).toBe(false);
  });
});

describe("sse-broadcast: broadcastToRoom", () => {
  beforeEach(() => {
    roomConnections.clear();
    lastKnownStates.clear();
  });

  it("delivers the event to every registered controller as SSE-framed JSON", () => {
    const a = fakeController();
    const b = fakeController();
    registerConnection("R1", a.controller);
    registerConnection("R1", b.controller);

    const delivered = broadcastToRoom("R1", { type: "ping" } as never);
    expect(delivered).toBe(2);

    for (const fc of [a, b]) {
      const text = fc.decode();
      expect(text.startsWith("data: ")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(true);
      const json = JSON.parse(text.slice("data: ".length).trimEnd());
      expect(json).toEqual({ type: "ping" });
    }
  });

  it("returns 0 and does not throw when no clients are connected", () => {
    expect(broadcastToRoom("ghost", { type: "ping" } as never)).toBe(0);
  });

  it("a failing controller does not prevent delivery to other clients", () => {
    const a = fakeController();
    const b = fakeController();
    a.fail();
    registerConnection("R1", a.controller);
    registerConnection("R1", b.controller);

    const delivered = broadcastToRoom("R1", { type: "ok" } as never);
    expect(delivered).toBe(1);
    expect(b.chunks).toHaveLength(1);
    expect(a.chunks).toHaveLength(0);
  });

  it("only broadcasts to controllers in the targeted room", () => {
    const a = fakeController();
    const b = fakeController();
    registerConnection("R1", a.controller);
    registerConnection("R2", b.controller);
    broadcastToRoom("R1", { type: "only-r1" } as never);
    expect(a.chunks).toHaveLength(1);
    expect(b.chunks).toHaveLength(0);
  });
});

describe("sse-broadcast: fingerprintRoom", () => {
  it("ignores lastActivity and per-player lastSeen so periodic timestamps do not trigger churn", () => {
    const t0 = new Date(0);
    const t1 = new Date(60_000);
    const a = emptyRoom("X");
    a.players = [
      {
        id: "p1",
        name: "p1",
        color: "#a",
        isHost: true,
        connected: true,
        lastSeen: t0,
      },
    ];
    a.lastActivity = t0;

    const b = emptyRoom("X");
    b.players = [
      {
        id: "p1",
        name: "p1",
        color: "#a",
        isHost: true,
        connected: true,
        lastSeen: t1, // changed
      },
    ];
    b.lastActivity = t1; // changed

    expect(fingerprintRoom(a)).toBe(fingerprintRoom(b));
  });

  it("DOES change when a meaningful field (currentPlayer) changes", () => {
    const a = emptyRoom("X");
    const b = emptyRoom("X");
    b.currentPlayer = 2;
    expect(fingerprintRoom(a)).not.toBe(fingerprintRoom(b));
  });

  it("DOES change when a player connects / disconnects", () => {
    const a = emptyRoom("X");
    a.players = [
      { id: "p1", name: "p1", color: "#a", isHost: true, connected: true, lastSeen: new Date(0) },
    ];
    const b = emptyRoom("X");
    b.players = [
      { id: "p1", name: "p1", color: "#a", isHost: true, connected: false, lastSeen: new Date(0) },
    ];
    expect(fingerprintRoom(a)).not.toBe(fingerprintRoom(b));
  });
});
