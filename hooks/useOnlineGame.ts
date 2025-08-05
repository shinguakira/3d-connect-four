"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameRoom } from "@/types/online";

export function useOnlineGame(roomId: string | null, playerId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  // Server-Sent Events で状態を監視
  useEffect(() => {
    if (!roomId || !playerId) return;

    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;
    const maxRetries = 5;

    function connectEventSource() {
      const eventSource = new EventSource(
        `/api/game/${roomId}/events?playerId=${playerId}`
      );

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        retryCount = 0; // Reset retry counter on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "game-state" || data.type === "player-joined") {
            setRoom(data.room);
            console.log(`Online game event received: ${data.type}`, data);
          }

          // Handle game started event
          if (data.type === "game-started") {
            setRoom(data.room);
            setGameStarted(true);
            const isHost = data.room?.players?.find((p: any) => p.id === playerId)?.isHost || false;
            console.log(`Game started event received by ${isHost ? 'HOST' : 'NON-HOST'} player:`, data);
            
            // Force UI update for all clients to ensure they transition to game screen
            const startTime = new Date().toISOString();
            console.log(`Game officially started at: ${startTime}`);
          }
        } catch (err) {
          console.error("イベント解析エラー:", err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setConnected(false);

        // Implement reconnection with backoff
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * 2 ** retryCount, 30000); // Exponential backoff with 30s max
          console.log(
            `Reconnecting to game events in ${delay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          retryTimeout = setTimeout(() => {
            retryCount++;
            connectEventSource();
          }, delay);
        } else {
          setError("接続が切断されました。ページを更新してください。");
        }
      };

      return eventSource;
    }

    const eventSource = connectEventSource();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      eventSource.close();
    };
  }, [roomId, playerId]);

  const startGame = useCallback(async () => {
    if (!roomId || !playerId) return false;

    try {
      const response = await fetch(`/api/game/${roomId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId }),
      });

      const result = await response.json();
      if (result.success) {
        setGameStarted(true);
        return true;
      }
      setError(result.error || "ゲーム開始に失敗しました");
      return false;
    } catch (err) {
      console.error("Start game error:", err);
      setError("ゲーム開始に失敗しました");
      return false;
    }
  }, [roomId, playerId]);

  const makeMove = useCallback(
    async (x: number, z: number) => {
      if (!roomId || !playerId) return false;

      try {
        const response = await fetch(`/api/game/${roomId}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playerId, x, z }),
        });

        const result = await response.json();
        return result.success;
      } catch (err) {
        setError("手の送信に失敗しました");
        return false;
      }
    },
    [roomId, playerId]
  );

  const createRoom = useCallback(async (playerName: string) => {
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName }),
      });

      const result = await response.json();
      if (result.success) {
        return {
          roomId: result.room.id,
          playerId: result.playerId,
        };
      }
      throw new Error(result.error);
    } catch (err) {
      setError("ルーム作成に失敗しました");
      return null;
    }
  }, []);

  const joinRoom = useCallback(async (roomId: string, playerName: string) => {
    try {
      const response = await fetch(`/api/game/join/${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName }),
      });

      const result = await response.json();
      if (result.success) {
        return {
          roomId: result.room.id,
          playerId: result.playerId,
        };
      }
      throw new Error(result.error);
    } catch (err) {
      setError("ルーム参加に失敗しました");
      return null;
    }
  }, []);

  // クイックマッチ機能
  const quickMatch = useCallback(async (playerName: string) => {
    try {
      const response = await fetch("/api/game/quick-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerName }),
      });

      const result = await response.json();
      if (result.success) {
        return {
          roomId: result.room.id,
          playerId: result.playerId,
          matched: result.matched,
        };
      }
      throw new Error(result.error);
    } catch (err) {
      console.error("Quick match error:", err);
      setError("クイックマッチに失敗しました");
      return null;
    }
  }, []);

  return {
    room,
    connected,
    error,
    gameStarted,
    makeMove,
    startGame,
    createRoom,
    joinRoom,
    quickMatch,
  };
}
