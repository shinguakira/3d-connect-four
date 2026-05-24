"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { GamePage } from "@/components/game-page";
import { OnlineMenu } from "@/components/online-menu";
import { OnlineWaiting } from "@/components/online-waiting";
import { TitlePage } from "@/components/title-page";
import { useOnlineGame } from "@/hooks/useOnlineGame";

// Top-level orchestrator. Holds the page-state machine and the online-game
// hook; every screen (title, online menu, waiting room, in-game) is a
// separate component. Game rules and 3D rendering live in their respective
// modules (lib/game-logic.ts and components/game-page.tsx).

type GameMode = "two-player" | "vs-ai" | "online";
type GameState = "menu" | "playing" | "online-menu" | "online-waiting" | "online-playing";

// sessionStorage (not localStorage) for online-session persistence:
//   - survives a page reload within the same tab (the reconnect case);
//   - is NOT shared between tabs, so opening a second tab to start a fresh
//     game doesn't hijack the first tab's room.
// Cleared automatically when the tab closes — fine, since the server-side
// room TTL is 30 min anyway.
const STORAGE_ROOM = "3dcf:online-room";
const STORAGE_PLAYER = "3dcf:online-player";

function clearOnlineStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_ROOM);
    window.sessionStorage.removeItem(STORAGE_PLAYER);
  } catch {
    // sessionStorage may be disabled (private mode / quota / etc.) — ignore.
  }
}

export default function Component() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("two-player");

  // Online state
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [onlinePlayerId, setOnlinePlayerId] = useState<string | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  // Ref (not state) so the gate survives React 19 strict-mode's double-mount
  // without re-triggering the effect or canceling the in-flight fetch.
  const reconnectStartedRef = useRef(false);

  const {
    room: onlineRoom,
    connected,
    error: onlineGameError,
    gameStarted,
    makeMove: makeOnlineMove,
    createRoom,
    joinRoom,
    quickMatch,
    startGame,
    markReady,
  } = useOnlineGame(onlineRoomId, onlinePlayerId);

  // Persist the active online session ids so a reload can reattach.
  // Only WRITES — never clears here. Clearing happens at explicit leave
  // points (handleBackToMenu / handleLeaveRoom) so the initial render of
  // an empty state on mount doesn't wipe out the keys we're about to read
  // for reconnect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!onlineRoomId || !onlinePlayerId) return;
    try {
      window.sessionStorage.setItem(STORAGE_ROOM, onlineRoomId);
      window.sessionStorage.setItem(STORAGE_PLAYER, onlinePlayerId);
    } catch {
      // ignore storage failures
    }
  }, [onlineRoomId, onlinePlayerId]);

  // Try to reconnect to a saved session on first mount. Validates with a
  // lightweight GET — if the room is gone (server restart, 30-min TTL, etc.)
  // we silently clear and stay on the title menu.
  useEffect(() => {
    if (reconnectStartedRef.current) return;
    reconnectStartedRef.current = true;
    if (typeof window === "undefined") return;
    let savedRoom: string | null = null;
    let savedPlayer: string | null = null;
    try {
      savedRoom = window.sessionStorage.getItem(STORAGE_ROOM);
      savedPlayer = window.sessionStorage.getItem(STORAGE_PLAYER);
    } catch {
      return;
    }
    if (!savedRoom || !savedPlayer) return;

    (async () => {
      try {
        const res = await fetch(`/api/game/${savedRoom}`);
        if (!res.ok) {
          clearOnlineStorage();
          return;
        }
        const body = await res.json();
        if (!body.success || !body.room) {
          clearOnlineStorage();
          return;
        }
        const stillMember = body.room.players?.some((p: any) => p.id === savedPlayer);
        if (!stillMember) {
          clearOnlineStorage();
          return;
        }
        // Restore to the lobby; if the game is already in progress the
        // gameStarted SSE flag will bounce us to "playing" via the effect
        // further down (same code path as the initial join).
        setOnlineRoomId(savedRoom);
        setOnlinePlayerId(savedPlayer);
        setGameState("online-waiting");
      } catch {
        // Network failure on the validate call — leave storage in place; the
        // user can retry from the title menu.
      }
    })();
  }, []);

  const handleStartGame = useCallback((mode: GameMode) => {
    if (mode === "online") {
      setGameState("online-menu");
    } else {
      setGameMode(mode);
      setGameState("playing");
    }
  }, []);

  const handleBackToMenu = useCallback(() => {
    setGameState("menu");
    setOnlineRoomId(null);
    setOnlinePlayerId(null);
    setOnlineError(null);
    clearOnlineStorage();
  }, []);

  const handleCreateRoom = useCallback(
    async (playerName: string) => {
      setOnlineLoading(true);
      setOnlineError(null);

      const result = await createRoom(playerName);
      if (result) {
        setOnlineRoomId(result.roomId);
        setOnlinePlayerId(result.playerId);
        setGameState("online-waiting");
      } else {
        setOnlineError("ルーム作成に失敗しました");
      }

      setOnlineLoading(false);
    },
    [createRoom],
  );

  const handleJoinRoom = useCallback(
    async (roomId: string, playerName: string) => {
      setOnlineLoading(true);
      setOnlineError(null);

      const result = await joinRoom(roomId, playerName);
      if (result) {
        setOnlineRoomId(result.roomId);
        setOnlinePlayerId(result.playerId);
        setGameState("online-waiting");
      } else {
        setOnlineError("ルーム参加に失敗しました");
      }

      setOnlineLoading(false);
    },
    [joinRoom],
  );

  const handleQuickMatch = useCallback(
    async (playerName: string) => {
      setOnlineLoading(true);
      setOnlineError(null);

      try {
        const result = await quickMatch(playerName);
        if (result) {
          setOnlineRoomId(result.roomId);
          setOnlinePlayerId(result.playerId);
          setGameState("online-waiting");
        } else {
          setOnlineError("クイックマッチに失敗しました");
        }
      } catch {
        setOnlineError("クイックマッチに失敗しました");
      }

      setOnlineLoading(false);
    },
    [quickMatch],
  );

  // Non-host transition: when the server broadcasts game-started via SSE,
  // useOnlineGame flips `gameStarted` true. Move waiting players into the game.
  useEffect(() => {
    if (gameStarted && gameState === "online-waiting") {
      setGameMode("online");
      setGameState("playing");
    }
  }, [gameStarted, gameState]);

  // Mark the local player as ready. The actual transition into "playing"
  // is driven by the SSE `gameStarted` flag (see the effect above) so both
  // clients move in lock-step once the SECOND ready arrives.
  const handleStartOnlineGame = useCallback(async () => {
    if (onlineRoom && onlineRoom.players.length === 2) {
      try {
        const success = await startGame();
        if (!success) {
          setOnlineError("準備完了の送信に失敗しました");
        }
      } catch (error) {
        console.error("Failed to mark ready:", error);
        setOnlineError("準備完了の送信に失敗しました");
      }
    }
  }, [onlineRoom, startGame]);

  const handleLeaveRoom = useCallback(() => {
    setOnlineRoomId(null);
    setOnlinePlayerId(null);
    setOnlineError(null);
    setGameState("menu");
    clearOnlineStorage();
  }, []);

  const handleCopyRoomId = useCallback(async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch (err) {
      console.error("クリップボードへのコピーに失敗:", err);
    }
  }, []);

  if (gameState === "menu") {
    return <TitlePage onStartGame={handleStartGame} />;
  }

  if (gameState === "online-menu") {
    return (
      <OnlineMenu
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onQuickMatch={handleQuickMatch}
        onBack={handleBackToMenu}
        isLoading={onlineLoading}
        error={onlineError || onlineGameError}
      />
    );
  }

  if (gameState === "online-waiting") {
    return (
      <OnlineWaiting
        room={onlineRoom}
        playerId={onlinePlayerId}
        connected={connected}
        onStartGame={handleStartOnlineGame}
        onLeaveRoom={handleLeaveRoom}
        onCopyRoomId={handleCopyRoomId}
      />
    );
  }

  if (gameState === "playing") {
    return (
      <GamePage
        gameMode={gameMode}
        onBackToMenu={handleBackToMenu}
        onlineRoom={onlineRoom}
        onlinePlayerId={onlinePlayerId}
        makeOnlineMove={makeOnlineMove}
        markOnlineReady={markReady}
      />
    );
  }

  return null;
}
