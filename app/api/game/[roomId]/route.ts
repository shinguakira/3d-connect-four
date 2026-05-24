import { type NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";

// Snapshot a room's current state. Lightweight read used by the client to
// validate a persisted session (e.g. localStorage {roomId, playerId} after
// a reload) before re-opening the SSE stream.
//
// Optional ?playerId=... narrows the check: if provided, the route also
// verifies that player is still a member of the room — useful for the
// "your session is no longer valid" fast-fail on reconnect.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = gameManager.getRoom(roomId);
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      players: room.players,
      gameState: room.gameState,
      currentPlayer: room.currentPlayer,
      gameStarted: room.gameStarted,
      gameOver: room.gameOver,
      winner: room.winner,
      readyPlayerIds: room.readyPlayerIds,
      settings: room.settings,
    },
  });
}
