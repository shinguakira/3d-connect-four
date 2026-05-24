import { type NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";

// Snapshot a room's current state. Lightweight read used by the client to
// validate a persisted session (sessionStorage {roomId, playerId} after a
// reload) before re-opening the SSE stream.
//
// **Path note**: this used to live at `app/api/game/[roomId]/route.ts`,
// which collided with the sibling literal routes `create/`, `join/`,
// `quick-match/` under Next 15.5.x routing — POST /api/game/create
// started dispatching to this dynamic file (which only exports GET),
// returning a 405 HTML page and breaking the client. See
// `INCIDENT-NEXT-ROUTE-CONFLICT.md` in the repo root.
//
// Keep this under `lookup/` (or some other dedicated namespace) so the
// path tree has no literal siblings at the [roomId] level.
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
