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

      const interval = setInterval(() => {
        const currentRoom = gameManager.getRoom(roomId);
        if (!currentRoom) {
          controller.close();
          clearInterval(interval);
          return;
        }

        if (playerId) {
          gameManager.updatePlayerConnection(roomId, playerId, true);
        }

        const fingerprint = fingerprintRoom(currentRoom);
        if (lastKnownStates.get(roomId) !== fingerprint) {
          lastKnownStates.set(roomId, fingerprint);
          broadcastToRoom(roomId, { type: "game-state", room: currentRoom });
          console.log(`Broadcasting meaningful state update for room ${roomId}`);
        }
      }, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        if (playerId) {
          gameManager.updatePlayerConnection(roomId, playerId, false);
        }
        unregisterConnection(roomId, controller);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
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
