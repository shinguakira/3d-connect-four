// Shared SSE connection registry and broadcaster.
//
// Previously the active stream controllers and broadcastToRoom() lived inside
// app/api/game/[roomId]/events/route.ts, and three other route files imported
// broadcastToRoom from that route module. App-router treats route.ts files as
// endpoint modules, so importing arbitrary helpers across routes is fragile
// (Turbopack may regard them as separate bundles and split the connection
// map, silently breaking real-time updates). Centralising the registry in a
// regular lib/ module keeps every route handler talking to the same in-memory
// map across both webpack and turbopack.

import type { GameRoom } from "@/types/online";

type Controller = ReadableStreamDefaultController<Uint8Array>;

declare global {
  // eslint-disable-next-line no-var
  var __sseRoomConnections: Map<string, Set<Controller>> | undefined;
  // eslint-disable-next-line no-var
  var __sseLastKnownStates: Map<string, string> | undefined;
}

// Persist across dev module reloads, mirroring the GameManager singleton.
export const roomConnections: Map<string, Set<Controller>> = globalThis.__sseRoomConnections ??
(globalThis.__sseRoomConnections = new Map<string, Set<Controller>>());

export const lastKnownStates: Map<string, string> =
  globalThis.__sseLastKnownStates ?? (globalThis.__sseLastKnownStates = new Map<string, string>());

export type RoomEvent =
  | { type: "game-state"; room: GameRoom }
  | { type: "player-joined"; room: Partial<GameRoom>; player?: unknown }
  | {
      type: "game-started";
      room: GameRoom;
      message?: string;
      timestamp?: string;
      retryNumber?: number;
    }
  | { type: "error"; error: string; roomId?: string };

export function registerConnection(roomId: string, controller: Controller): void {
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  roomConnections.get(roomId)!.add(controller);
}

export function unregisterConnection(roomId: string, controller: Controller): void {
  const set = roomConnections.get(roomId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) {
    roomConnections.delete(roomId);
    lastKnownStates.delete(roomId);
  }
}

export function connectionCount(roomId: string): number {
  return roomConnections.get(roomId)?.size ?? 0;
}

export function broadcastToRoom(
  roomId: string,
  event: RoomEvent | Record<string, unknown>,
): number {
  const controllers = roomConnections.get(roomId);
  if (!controllers || controllers.size === 0) return 0;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = encoder.encode(data);

  let delivered = 0;
  for (const controller of controllers) {
    try {
      controller.enqueue(encoded);
      delivered++;
    } catch {
      // Controller already closed by the client side; drop it on next abort.
    }
  }
  return delivered;
}

// JSON form used for change detection; excludes fields that mutate per tick.
export function fingerprintRoom(room: GameRoom): string {
  return JSON.stringify({
    ...room,
    lastActivity: undefined,
    players: room.players.map((p) => ({ ...p, lastSeen: undefined })),
  });
}
