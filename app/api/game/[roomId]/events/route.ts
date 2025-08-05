import type { NextRequest } from "next/server";
import { gameManager } from "@/lib/game-manager";

// Store active SSE connections per room
const roomConnections = new Map<string, Set<ReadableStreamDefaultController>>();
// Store last known state per room for change detection
const lastKnownStates = new Map<string, string>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = request.nextUrl.searchParams.get("playerId");

  if (!playerId) {
    return new Response("Player ID required", { status: 400 });
  }

  // Update player connection status
  gameManager.updatePlayerConnection(roomId, playerId, true);

  // Server-Sent Events のストリームを作成
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Add this controller to room connections
      if (!roomConnections.has(roomId)) {
        roomConnections.set(roomId, new Set());
      }
      roomConnections.get(roomId)?.add(controller);

      // 初期ゲーム状態を送信
      const room = gameManager.getRoom(roomId);
      if (room) {
        const roomState = JSON.stringify(room);
        lastKnownStates.set(roomId, roomState);

        const data = `data: ${JSON.stringify({
          type: "game-state",
          room,
        })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      // 定期的にゲーム状態をチェック
      const interval = setInterval(() => {
        const currentRoom = gameManager.getRoom(roomId);
        if (!currentRoom) {
          controller.close();
          clearInterval(interval);
          return;
        }

        // Update player connection status periodically
        if (playerId) {
          gameManager.updatePlayerConnection(roomId, playerId, true);
        }

        // Check if game state has changed
        const currentRoomState = JSON.stringify(currentRoom);
        const previousState = lastKnownStates.get(roomId);

        if (previousState !== currentRoomState) {
          // State has changed, send update to all clients
          lastKnownStates.set(roomId, currentRoomState);

          // Use broadcast function to notify all clients
          broadcastToRoom(roomId, {
            type: "game-state",
            room: currentRoom,
          });

          console.log(`Broadcasting state update for room ${roomId}`);
        }
      }, 2000); // 2秒ごとに状態チェック

      // クリーンアップ
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        if (playerId) {
          gameManager.updatePlayerConnection(roomId, playerId, false);
        }
        roomConnections.get(roomId)?.delete(controller);
        if (roomConnections.get(roomId)?.size === 0) {
          roomConnections.delete(roomId);
        }
        controller.close();
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

// Helper function to broadcast updates to all clients in a room
export function broadcastToRoom(roomId: string, event: any) {
  const controllers = roomConnections.get(roomId);
  if (!controllers) return;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = encoder.encode(data);

  controllers.forEach((controller) => {
    try {
      controller.enqueue(encoded);
      console.log(`Event sent to client in room ${roomId}: ${event.type}`);
    } catch (err) {
      console.error("Failed to send event to client", err);
    }
  });
}
