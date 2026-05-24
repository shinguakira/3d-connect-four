import type { NextRequest } from "next/server";
import { gameManager } from "@/lib/game-manager";
import {
  broadcastToRoom,
  fingerprintRoom,
  lastKnownStates,
  registerConnection,
  unregisterConnection,
} from "@/lib/sse-broadcast";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const playerId = request.nextUrl.searchParams.get("playerId");

  if (!playerId) {
    return new Response("Player ID required", { status: 400 });
  }

  gameManager.updatePlayerConnection(roomId, playerId, true);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      registerConnection(roomId, controller);

      const room = gameManager.getRoom(roomId);
      console.log(`SSE connection established for room ${roomId}, room exists:`, !!room);

      if (room) {
        lastKnownStates.set(roomId, fingerprintRoom(room));
        const data = `data: ${JSON.stringify({ type: "game-state", room })}\n\n`;
        controller.enqueue(encoder.encode(data));
        console.log(`Initial game state sent for room ${roomId}`);
      } else {
        console.log(`Room ${roomId} not found when establishing SSE connection`);
        const errorData = `data: ${JSON.stringify({
          type: "error",
          error: "Room not found",
          roomId,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
      }

      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        if (playerId) {
          gameManager.updatePlayerConnection(roomId, playerId, false);
        }
        unregisterConnection(roomId, controller);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const interval = setInterval(() => {
        if (closed) return;
        const currentRoom = gameManager.getRoom(roomId);
        if (!currentRoom) {
          cleanup();
          return;
        }

        // Re-mark connected only if WE just successfully wrote bytes to the
        // controller (the heartbeat does that every 10s). If the heartbeat
        // failed, the cleanup path has already flipped connected=false.
        if (playerId && !closed) {
          gameManager.updatePlayerConnection(roomId, playerId, true);
        }

        const fingerprint = fingerprintRoom(currentRoom);
        if (lastKnownStates.get(roomId) !== fingerprint) {
          lastKnownStates.set(roomId, fingerprint);
          broadcastToRoom(roomId, { type: "game-state", room: currentRoom });
          console.log(`Broadcasting meaningful state update for room ${roomId}`);
        }
      }, 2000);

      // SSE heartbeat: a comment line is a no-op for the client (EventSource
      // ignores lines starting with ':') but keeps proxies from idle-closing
      // the connection AND, crucially, surfaces a dead client via the throw
      // on the next enqueue. Without this, a silently-dead tab can show as
      // "connected" until the 30-min room cleanup.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          console.log(`SSE heartbeat failed for room ${roomId}, treating as disconnect`);
          cleanup();
        }
      }, 10_000);

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
