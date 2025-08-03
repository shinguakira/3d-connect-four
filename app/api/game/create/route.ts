import { type NextRequest, NextResponse } from "next/server"
import { gameManager } from "@/lib/game-manager"

export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json()

    const player = {
      id: crypto.randomUUID(),
      name: playerName || "プレイヤー1",
      color: "#ef4444",
      isHost: true,
      connected: true,
      lastSeen: new Date(),
    }

    const room = gameManager.createRoom(player)

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
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "ルーム作成に失敗しました" }, { status: 500 })
  }
}
