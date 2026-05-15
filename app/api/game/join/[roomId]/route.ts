import { type NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";
import { broadcastToRoom } from "../../[roomId]/events/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { playerName } = await request.json();
    const { roomId } = await params;

    const player = {
      id: crypto.randomUUID(),
      name: playerName || "プレイヤー2",
      color: "#3b82f6",
      isHost: false,
      connected: true,
      lastSeen: new Date(),
    };

    const room = gameManager.joinRoom(roomId, player);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "ルームが見つからないか満員です" },
        { status: 404 },
      );
    }

    // Notify the host (and any other listeners) immediately, instead of
    // waiting up to 2s for the periodic SSE state poll.
    broadcastToRoom(roomId, {
      type: "player-joined",
      room: {
        id: room.id,
        players: room.players,
        gameState: room.gameState,
        currentPlayer: room.currentPlayer,
        gameStarted: room.gameStarted,
        gameOver: room.gameOver,
        winner: room.winner,
        settings: room.settings,
      },
      player,
    });

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        players: room.players,
        gameState: room.gameState,
        currentPlayer: room.currentPlayer,
        settings: room.settings,
      },
      playerId: player.id,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "ルーム参加に失敗しました" },
      { status: 500 },
    );
  }
}
