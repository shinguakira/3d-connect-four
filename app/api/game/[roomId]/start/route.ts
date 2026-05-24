import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";
import { broadcastToRoom } from "@/lib/sse-broadcast";

// "Start" is now a two-step ready-check: each player must POST here before the
// game (or a rematch) actually begins. The endpoint is idempotent — the same
// player POSTing twice does not double-count.
//
// Response shape:
//   { success: true, room, started: boolean, restarted: boolean }
// `started` is true only on the call that flipped gameStarted from false →
// true. `restarted` is true on the call that completed a rematch (gameOver
// → board reset). Both are false for an "I'm ready, waiting for opponent"
// call.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { playerId } = body;

    const room = gameManager.getRoom(roomId);
    if (!room) {
      gameManager.cleanupInactiveRooms();
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 },
      );
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return NextResponse.json(
        { success: false, error: "Player not found in room" },
        { status: 404 },
      );
    }

    if (room.players.length !== 2) {
      return NextResponse.json(
        { success: false, error: "Need exactly 2 players to start" },
        { status: 400 },
      );
    }

    const result = gameManager.markReady(roomId, playerId);
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Failed to mark ready" },
        { status: 500 },
      );
    }

    // Always push a fresh room snapshot so the opponent's UI updates the
    // readiness indicator.
    broadcastToRoom(roomId, {
      type: "game-state",
      room: result.room,
      timestamp: new Date().toISOString(),
    });

    if (result.started) {
      // First-time start. Triple-broadcast (immediate + 200ms + 500ms) to
      // mirror the original retry behavior — guards against SSE buffering.
      const payload = {
        type: "game-started" as const,
        room: result.room,
        message: "Game has started!",
      };
      broadcastToRoom(roomId, { ...payload, timestamp: new Date().toISOString() });
      setTimeout(
        () => broadcastToRoom(roomId, { ...payload, timestamp: new Date().toISOString(), retryNumber: 1 }),
        200,
      );
      setTimeout(
        () => broadcastToRoom(roomId, { ...payload, timestamp: new Date().toISOString(), retryNumber: 2 }),
        500,
      );
    }

    if (result.restarted) {
      const payload = {
        type: "game-restarted" as const,
        room: result.room,
        message: "Rematch started!",
      };
      broadcastToRoom(roomId, { ...payload, timestamp: new Date().toISOString() });
      setTimeout(
        () => broadcastToRoom(roomId, { ...payload, timestamp: new Date().toISOString(), retryNumber: 1 }),
        200,
      );
    }

    return NextResponse.json({
      success: true,
      room: result.room,
      started: result.started,
      restarted: result.restarted,
    });
  } catch (error) {
    console.error("Error in start (ready) route:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
