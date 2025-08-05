import { type NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";
import { broadcastToRoom } from "../[roomId]/events/route";

export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json();

    // 待機中のルームを検索
    const availableRoom = gameManager.findAvailableRoom();

    if (availableRoom) {
      // 既存のルームに参加
      const player = {
        id: crypto.randomUUID(),
        name: playerName || "プレイヤー2",
        color: "#3b82f6",
        isHost: false,
        connected: true,
        lastSeen: new Date(),
      };

      const room = gameManager.joinRoom(availableRoom.id, player);

      if (room) {
        // ルームの他のプレイヤーに通知
        broadcastToRoom(room.id, {
          type: "player-joined",
          room: {
            id: room.id,
            players: room.players,
            gameState: room.gameState,
            currentPlayer: room.currentPlayer,
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
          matched: true,
        });
      }
    }

    // 新しいルームを作成
    const player = {
      id: crypto.randomUUID(),
      name: playerName || "プレイヤー1",
      color: "#ef4444",
      isHost: true,
      connected: true,
      lastSeen: new Date(),
    };

    const room = gameManager.createRoom(player);

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
      matched: false, // まだマッチしていない
    });
  } catch (error) {
    console.error("Quick match error:", error);
    return NextResponse.json(
      { success: false, error: "クイックマッチに失敗しました" },
      { status: 500 }
    );
  }
}
