"use client";

import { useCallback, useEffect, useState } from "react";

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

export default function Component() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("two-player");

  // Online state
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [onlinePlayerId, setOnlinePlayerId] = useState<string | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

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
  } = useOnlineGame(onlineRoomId, onlinePlayerId);

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

  const handleStartOnlineGame = useCallback(async () => {
    if (onlineRoom && onlineRoom.players.length === 2) {
      try {
        const success = await startGame();
        if (success) {
          setGameMode("online");
          setGameState("playing");
        } else {
          setOnlineError("ゲーム開始に失敗しました");
        }
      } catch (error) {
        console.error("Failed to start game:", error);
        setOnlineError("ゲーム開始に失敗しました");
      }
    }
  }, [onlineRoom, startGame]);

  const handleLeaveRoom = useCallback(() => {
    setOnlineRoomId(null);
    setOnlinePlayerId(null);
    setOnlineError(null);
    setGameState("menu");
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
      />
    );
  }

  return null;
}
