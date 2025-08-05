import { type NextRequest, NextResponse } from "next/server"
import { gameManager } from "@/lib/game-manager"

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { playerId, x, z } = await request.json()
    const { roomId } = await params

    const move = {
      playerId,
      x,
      z,
      timestamp: new Date(),
    }

    const room = gameManager.makeMove(roomId, playerId, move)

    if (!room) {
      return NextResponse.json({ success: false, error: "無効な手です" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        players: room.players,
        gameState: room.gameState,
        currentPlayer: room.currentPlayer,
        winner: room.winner,
        gameOver: room.gameOver,
        settings: room.settings,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "手の処理に失敗しました" }, { status: 500 })
  }
}
