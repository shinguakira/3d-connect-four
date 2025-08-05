"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Users, Wifi, WifiOff } from "lucide-react"
import type { GameRoom } from "@/types/online"

interface OnlineWaitingProps {
  room: GameRoom | null
  playerId: string | null
  connected: boolean
  onStartGame: () => void
  onLeaveRoom: () => void
  onCopyRoomId: (roomId: string) => void
}

export function OnlineWaiting({
  room,
  playerId,
  connected,
  onStartGame,
  onLeaveRoom,
  onCopyRoomId,
}: OnlineWaitingProps) {
  const [dots, setDots] = useState("")

  // 待機中のアニメーション
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  if (!room || !playerId) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">ルーム情報を読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentPlayer = room.players.find((p) => p.id === playerId)
  const otherPlayer = room.players.find((p) => p.id !== playerId)
  const isHost = currentPlayer?.isHost || false
  const canStart = room.players.length === 2

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {connected ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
            <Badge variant={connected ? "default" : "destructive"}>{connected ? "接続中" : "切断"}</Badge>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">ルーム: {room.id}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopyRoomId(room.id)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            <Copy className="w-4 h-4 mr-1" />
            IDをコピー
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* プレイヤー一覧 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-600" />
              <span className="font-semibold">プレイヤー ({room.players.length}/2)</span>
            </div>

            {room.players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  player.id === playerId ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.color }} />
                  <div>
                    <div className="font-medium">
                      {player.name}
                      {player.id === playerId && " (あなた)"}
                    </div>
                    <div className="text-xs text-gray-500">
                      プレイヤー {index + 1}
                      {player.isHost && " • ホスト"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.connected ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-xs text-gray-500">{player.connected ? "オンライン" : "オフライン"}</span>
                </div>
              </div>
            ))}

            {/* 空きスロット */}
            {room.players.length < 2 && (
              <div className="flex items-center justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">プレイヤーを待機中{dots}</p>
                  <p className="text-xs text-gray-500 mt-1">友達にルームID「{room.id}」を共有しよう</p>
                </div>
              </div>
            )}
          </div>

          {/* ゲーム設定 */}
          {room.settings && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">ゲーム設定</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.settings.player1Color }} />
                  <span>プレイヤー1</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.settings.player2Color }} />
                  <span>プレイヤー2</span>
                </div>
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="space-y-3">
            {canStart ? (
              <Button
                onClick={onStartGame}
                size="lg"
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
              >
                🎮 ゲーム開始
              </Button>
            ) : (
              <Button disabled size="lg" className="w-full">
                {room.players.length < 2 ? `プレイヤーを待機中${dots}` : "どちらのプレイヤーでもゲームを開始できます"}
              </Button>
            )}

            <Button variant="outline" onClick={onLeaveRoom} className="w-full bg-transparent">
              ルームを退出
            </Button>
          </div>

          {/* 接続状態の説明 */}
          {!connected && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">⚠️ 接続が不安定です。ページを更新してみてください。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
