"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameRoom } from "@/types/online";

export function useOnlineGame(roomId: string | null, playerId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  // Bumped each time the server confirms a rematch — consumers (game-page)
  // use this as a useEffect dep to clear local UI state for the new round.
  const [restartedTick, setRestartedTick] = useState(0);

  // Server-Sent Events で状態を監視
  useEffect(() => {
    if (!roomId || !playerId) return;

    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;
    const maxRetries = 5;

    function connectEventSource() {
      const eventSource = new EventSource(`/api/game/${roomId}/events?playerId=${playerId}`);

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
            // Fallback: if the dedicated "game-started" burst was missed,
            // the next periodic state poll still flips gameStarted.
            if (data.room?.gameStarted) setGameStarted(true);
            console.log(`Online game event received: ${data.type}`, data);
          }

          // Handle game started event
          if (data.type === "game-started") {
            setRoom(data.room);
            setGameStarted(true);
          }

          // Rematch: server has reset the board after both players signaled
          // ready following a finished game. Push the fresh room state and
          // bump the restart counter so consumers can clear local state.
          if (data.type === "game-restarted") {
            setRoom(data.room);
            setGameStarted(true);
            setRestartedTick((n) => n + 1);
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
            `Reconnecting to game events in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`,
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

  // Signal that the local player is ready to start (or rematch). The game
  // only actually transitions when BOTH players have called this. The
  // response tells the caller which transition (if any) just fired:
  //   { started: true } — game just began (first start).
  //   { restarted: true } — board reset for a rematch.
  //   both false — opponent still needs to ready up.
  const markReady = useCallback(async () => {
    if (!roomId || !playerId) return { ok: false as const, started: false, restarted: false };

    try {
      const response = await fetch(`/api/game/${roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || "準備完了の送信に失敗しました");
        return { ok: false as const, started: false, restarted: false };
      }
      if (result.started) setGameStarted(true);
      if (result.restarted) setRestartedTick((n) => n + 1);
      return {
        ok: true as const,
        started: !!result.started,
        restarted: !!result.restarted,
      };
    } catch (err) {
      console.error("Mark ready error:", err);
      setError("準備完了の送信に失敗しました");
      return { ok: false as const, started: false, restarted: false };
    }
  }, [roomId, playerId]);

  // Back-compat alias for existing call sites. Returns just the boolean
  // success — the page-state machine only needs that.
  const startGame = useCallback(async () => {
    const r = await markReady();
    return r.ok;
  }, [markReady]);

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
      } catch {
        setError("手の送信に失敗しました");
        return false;
      }
    },
    [roomId, playerId],
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
    } catch {
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
    } catch {
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
    restartedTick,
    makeMove,
    markReady,
    startGame,
    createRoom,
    joinRoom,
    quickMatch,
  };
}
