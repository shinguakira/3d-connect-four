import { type NextRequest, NextResponse } from "next/server"
import { gameManager } from "@/lib/game-manager"

export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const { playerName } = await request.json()
    const roomId = params.roomId

    const player = {
      id: crypto.randomUUID(),
      name: playerName || "プレイヤー2",
      color: "#3b82f6",
      isHost: false,
      connected: true,
      lastSeen: new Date(),
    }

    const room = gameManager.joinRoom(roomId, player)

    if (!room) {
      return NextResponse.json({ success: false, error: "ルームが見つからないか満員です" }, { status: 404 })
    }

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
    return NextResponse.json({ success: false, error: "ルーム参加に失敗しました" }, { status: 500 })
  }
}
