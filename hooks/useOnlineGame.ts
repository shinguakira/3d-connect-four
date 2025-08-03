"use client"

import { useState, useEffect, useCallback } from "react"
import type { GameRoom } from "@/types/online"

export function useOnlineGame(roomId: string | null, playerId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Server-Sent Events で状態を監視
  useEffect(() => {
    if (!roomId) return

    const eventSource = new EventSource(`/api/game/${roomId}/events`)

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "game-state") {
          setRoom(data.room)
        }
      } catch (err) {
        console.error("イベント解析エラー:", err)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      setError("接続が切断されました")
    }

    return () => {
      eventSource.close()
    }
  }, [roomId])

  const makeMove = useCallback(
    async (x: number, z: number) => {
      if (!roomId || !playerId) return false

      try {
        const response = await fetch(`/api/game/${roomId}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playerId, x, z }),
        })

        const result = await response.json()
        return result.success
      } catch (err) {
        setError("手の送信に失敗しました")
        return false
      }
    },
    [roomId, playerId],
  )

  const createRoom = useCallback(async (playerName: string) => {
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName }),
      })

      const result = await response.json()
      if (result.success) {
        return {
          roomId: result.room.id,
          playerId: result.playerId,
        }
      }
      throw new Error(result.error)
    } catch (err) {
      setError("ルーム作成に失敗しました")
      return null
    }
  }, [])

  const joinRoom = useCallback(async (roomId: string, playerName: string) => {
    try {
      const response = await fetch(`/api/game/join/${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName }),
      })

      const result = await response.json()
      if (result.success) {
        return {
          roomId: result.room.id,
          playerId: result.playerId,
        }
      }
      throw new Error(result.error)
    } catch (err) {
      setError("ルーム参加に失敗しました")
      return null
    }
  }, [])

  return {
    room,
    connected,
    error,
    makeMove,
    createRoom,
    joinRoom,
  }
}
