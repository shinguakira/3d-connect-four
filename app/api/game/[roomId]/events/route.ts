import type { NextRequest } from "next/server"
import { gameManager } from "@/lib/game-manager"

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId

  // Server-Sent Events のストリームを作成
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // 初期ゲーム状態を送信
      const room = gameManager.getRoom(roomId)
      if (room) {
        const data = `data: ${JSON.stringify({
          type: "game-state",
          room: {
            id: room.id,
            players: room.players,
            gameState: room.gameState,
            currentPlayer: room.currentPlayer,
            winner: room.winner,
            gameOver: room.gameOver,
            settings: room.settings,
          },
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // 定期的にゲーム状態をチェック（実際の実装では、イベントベースにする）
      const interval = setInterval(() => {
        const currentRoom = gameManager.getRoom(roomId)
        if (!currentRoom) {
          controller.close()
          clearInterval(interval)
          return
        }

        // ここで変更があった場合のみ送信する実装が必要
        // 実際の実装では、GameManagerにイベントリスナーを追加
      }, 1000)

      // クリーンアップ
      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
