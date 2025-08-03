"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Users, Gamepad2, Hash } from "lucide-react"

interface OnlineMenuProps {
  onCreateRoom: (playerName: string) => void
  onJoinRoom: (roomId: string, playerName: string) => void
  onQuickMatch: (playerName: string) => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function OnlineMenu({ onCreateRoom, onJoinRoom, onQuickMatch, onBack, isLoading, error }: OnlineMenuProps) {
  const [playerName, setPlayerName] = useState("")
  const [roomId, setRoomId] = useState("")
  const [activeTab, setActiveTab] = useState<"create" | "join" | "quick">("quick")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim()) return

    switch (activeTab) {
      case "create":
        onCreateRoom(playerName.trim())
        break
      case "join":
        if (roomId.trim()) {
          onJoinRoom(roomId.trim().toUpperCase(), playerName.trim())
        }
        break
      case "quick":
        onQuickMatch(playerName.trim())
        break
    }
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">オンライン対戦</CardTitle>
          <p className="text-gray-600">世界中のプレイヤーと対戦しよう</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* プレイヤー名入力 */}
          <div className="space-y-2">
            <Label htmlFor="playerName">プレイヤー名</Label>
            <Input
              id="playerName"
              type="text"
              placeholder="あなたの名前を入力"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          {/* タブ選択 */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={activeTab === "quick" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("quick")}
              disabled={isLoading}
              className="flex flex-col gap-1 h-auto py-3"
            >
              <Users className="w-4 h-4" />
              <span className="text-xs">クイック</span>
            </Button>
            <Button
              variant={activeTab === "create" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("create")}
              disabled={isLoading}
              className="flex flex-col gap-1 h-auto py-3"
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="text-xs">作成</span>
            </Button>
            <Button
              variant={activeTab === "join" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("join")}
              disabled={isLoading}
              className="flex flex-col gap-1 h-auto py-3"
            >
              <Hash className="w-4 h-4" />
              <span className="text-xs">参加</span>
            </Button>
          </div>

          {/* コンテンツエリア */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === "quick" && (
              <div className="text-center space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">クイックマッチ</h3>
                  <p className="text-sm text-blue-600">自動で相手を見つけて対戦開始</p>
                </div>
              </div>
            )}

            {activeTab === "create" && (
              <div className="text-center space-y-3">
                <div className="p-4 bg-green-50 rounded-lg">
                  <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold text-green-800">ルーム作成</h3>
                  <p className="text-sm text-green-600">新しいルームを作成して友達を招待</p>
                </div>
              </div>
            )}

            {activeTab === "join" && (
              <div className="space-y-3">
                <div className="p-4 bg-purple-50 rounded-lg text-center">
                  <Hash className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold text-purple-800">ルーム参加</h3>
                  <p className="text-sm text-purple-600">ルームIDを入力して参加</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roomId">ルームID</Label>
                  <Input
                    id="roomId"
                    type="text"
                    placeholder="例: ABC123"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    maxLength={6}
                    disabled={isLoading}
                    className="text-center font-mono text-lg"
                  />
                </div>
              </div>
            )}

            {/* エラー表示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* アクションボタン */}
            <div className="space-y-3">
              <Button
                type="submit"
                size="lg"
                disabled={isLoading || !playerName.trim() || (activeTab === "join" && !roomId.trim())}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {activeTab === "quick" ? "マッチング中..." : "接続中..."}
                  </>
                ) : (
                  <>
                    {activeTab === "quick" && "クイックマッチ開始"}
                    {activeTab === "create" && "ルーム作成"}
                    {activeTab === "join" && "ルームに参加"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isLoading}
                className="w-full bg-transparent"
              >
                メニューに戻る
              </Button>
            </div>
          </form>

          {/* 説明 */}
          <div className="pt-4 border-t text-center">
            <div className="text-xs text-gray-500 space-y-1">
              <p>• クイック: 自動でマッチング</p>
              <p>• 作成: 友達と対戦用のルーム作成</p>
              <p>• 参加: ルームIDで特定のルームに参加</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
