"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as THREE from "three";
import {
  ArrowLeft,
  Check,
  Circle,
  Frown,
  Gamepad2,
  Hand,
  Home,
  RotateCw,
  Settings,
  Trophy,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import {
  findReachLines,
  visibleReachPlayers,
  type ReachLine,
} from "@/lib/game-logic";
import { TurnBanner } from "@/components/turn-banner";
import { VictoryCrackers } from "@/components/victory-crackers";

type Player = 1 | 2 | null;
type GameBoard = Player[][][];
type GameMode = "two-player" | "vs-ai" | "online";
type AIDifficulty = "easy" | "normal" | "hard";
type PieceShape =
  | "sphere"
  | "cube"
  | "cylinder"
  | "cone"
  | "octahedron"
  | "dodecahedron"
  | "torus"
  | "diamond";

interface GamePageProps {
  gameMode: GameMode;
  onBackToMenu: () => void;
  onlineRoom?: any;
  onlinePlayerId?: string | null;
  makeOnlineMove?: (x: number, z: number) => Promise<boolean>;
}

const GRID_SIZE = 4;

const COLOR_PRESETS = [
  { name: "赤", value: "#ef4444" },
  { name: "青", value: "#3b82f6" },
  { name: "緑", value: "#22c55e" },
  { name: "紫", value: "#a855f7" },
  { name: "オレンジ", value: "#f97316" },
  { name: "ピンク", value: "#ec4899" },
  { name: "黄", value: "#eab308" },
  { name: "シアン", value: "#06b6d4" },
];

const AI_DIFFICULTIES = [
  { id: "easy" as AIDifficulty, name: "簡単", description: "初心者向け", color: "#22c55e" },
  { id: "normal" as AIDifficulty, name: "普通", description: "バランス良く", color: "#f59e0b" },
  { id: "hard" as AIDifficulty, name: "難しい", description: "上級者向け", color: "#ef4444" },
];

// AI思考用のヘルパー関数
function getValidMoves(board: GameBoard): Array<{ x: number; z: number; y: number }> {
  const moves: Array<{ x: number; z: number; y: number }> = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!board[x][y][z]) {
          moves.push({ x, z, y });
          break; // 重力により、この列の最下段のみ有効
        }
      }
    }
  }

  return moves;
}

function simulateMove(board: GameBoard, x: number, z: number, player: Player): GameBoard {
  const newBoard = board.map((layer) => layer.map((row) => [...row]));

  for (let y = 0; y < GRID_SIZE; y++) {
    if (!newBoard[x][y][z]) {
      newBoard[x][y][z] = player;
      break;
    }
  }

  return newBoard;
}

function evaluatePosition(board: GameBoard, player: Player, difficulty: AIDifficulty): number {
  let score = 0;

  // 中央付近のポジションにボーナス
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (board[x][y][z] === player) {
          const centerDistance = Math.abs(x - 1.5) + Math.abs(y - 1.5) + Math.abs(z - 1.5);
          const centerBonus = (6 - centerDistance) * 2;

          // 難易度に応じて戦略的評価を調整
          switch (difficulty) {
            case "easy":
              score += centerBonus * 0.5; // 戦略性を下げる
              break;
            case "normal":
              score += centerBonus;
              break;
            case "hard":
              score += centerBonus * 1.5; // より戦略的に
              // 追加の戦略的評価
              score += evaluateLines(board, x, y, z, player) * 3;
              break;
          }
        }
      }
    }
  }

  return score;
}

function evaluateLines(board: GameBoard, x: number, y: number, z: number, player: Player): number {
  let lineScore = 0;
  const directions = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, -1, 0],
    [0, 1, 1],
    [0, 1, -1],
    [1, 0, 1],
    [1, 0, -1],
    [-1, 0, 1],
    [-1, 0, -1],
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [-1, 1, 1],
  ];

  for (const [dx, dy, dz] of directions) {
    let count = 1;
    let emptySpaces = 0;

    // 正方向をチェック
    for (let i = 1; i < GRID_SIZE; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      const nz = z + dz * i;

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE)
        break;

      if (board[nx][ny][nz] === player) {
        count++;
      } else if (board[nx][ny][nz] === null) {
        emptySpaces++;
        break;
      } else {
        break;
      }
    }

    // 負方向をチェック
    for (let i = 1; i < GRID_SIZE; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      const nz = z - dz * i;

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE)
        break;

      if (board[nx][ny][nz] === player) {
        count++;
      } else if (board[nx][ny][nz] === null) {
        emptySpaces++;
        break;
      } else {
        break;
      }
    }

    // 連続数に応じてスコア加算
    if (count >= 2 && emptySpaces > 0) {
      lineScore += count * count;
    }
  }

  return lineScore;
}

function checkWinningMove(board: GameBoard, x: number, z: number, player: Player): boolean {
  const testBoard = simulateMove(board, x, z, player);
  return checkWinnerForBoard(testBoard) === player;
}

function checkWinnerForBoard(board: GameBoard): Player {
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const player = board[x][y][z];
        if (!player) continue;

        const directions = [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 0],
          [1, -1, 0],
          [0, 1, 1],
          [0, 1, -1],
          [1, 0, 1],
          [1, 0, -1],
          [-1, 0, 1],
          [-1, 0, -1],
          [1, 1, 1],
          [1, 1, -1],
          [1, -1, 1],
          [-1, 1, 1],
        ];

        for (const [dx, dy, dz] of directions) {
          let count = 1;

          for (let i = 1; i < GRID_SIZE; i++) {
            const nx = x + dx * i;
            const ny = y + dy * i;
            const nz = z + dz * i;

            if (
              nx < 0 ||
              nx >= GRID_SIZE ||
              ny < 0 ||
              ny >= GRID_SIZE ||
              nz < 0 ||
              nz >= GRID_SIZE ||
              board[nx][ny][nz] !== player
            ) {
              break;
            }
            count++;
          }

          for (let i = 1; i < GRID_SIZE; i++) {
            const nx = x - dx * i;
            const ny = y - dy * i;
            const nz = z - dz * i;

            if (
              nx < 0 ||
              nx >= GRID_SIZE ||
              ny < 0 ||
              ny >= GRID_SIZE ||
              nz < 0 ||
              nz >= GRID_SIZE ||
              board[nx][ny][nz] !== player
            ) {
              break;
            }
            count++;
          }

          if (count >= 4) {
            return player;
          }
        }
      }
    }
  }
  return null;
}

function getAIMove(board: GameBoard, difficulty: AIDifficulty): { x: number; z: number } | null {
  try {
    const validMoves = getValidMoves(board);
    if (validMoves.length === 0) return null;

    // 簡単モード: 50%の確率でランダム手
    if (difficulty === "easy" && Math.random() < 0.5) {
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      const randomMove = validMoves[randomIndex];
      return { x: randomMove.x, z: randomMove.z };
    }

    // 1. 勝利可能な手をチェック（全難易度共通）
    for (const move of validMoves) {
      if (checkWinningMove(board, move.x, move.z, 2)) {
        return { x: move.x, z: move.z };
      }
    }

    // 2. 相手の勝利を阻止する手をチェック
    // 簡単モードでは30%の確率でスキップ
    if (difficulty !== "easy" || Math.random() > 0.3) {
      for (const move of validMoves) {
        if (checkWinningMove(board, move.x, move.z, 1)) {
          return { x: move.x, z: move.z };
        }
      }
    }

    // 3. 戦略的な位置を評価
    let bestMove = validMoves[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of validMoves) {
      const testBoard = simulateMove(board, move.x, move.z, 2);
      const aiScore = evaluatePosition(testBoard, 2, difficulty);
      const playerScore = evaluatePosition(testBoard, 1, difficulty);
      let score = aiScore - playerScore;

      // 難易度に応じてランダム要素を調整
      let randomBonus = 0;
      switch (difficulty) {
        case "easy":
          randomBonus = Math.random() * 50; // 大きなランダム要素
          break;
        case "normal":
          randomBonus = Math.random() * 20; // 中程度のランダム要素
          break;
        case "hard":
          randomBonus = Math.random() * 5; // 小さなランダム要素
          // 難しいモードでは相手の次の手も考慮
          score += evaluateOpponentThreats(testBoard) * 10;
          break;
      }

      const totalScore = score + randomBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMove = move;
      }
    }

    return { x: bestMove.x, z: bestMove.z };
  } catch (error) {
    console.error("AI思考エラー:", error);
    // エラー時はランダムな有効手を返す
    const validMoves = getValidMoves(board);
    if (validMoves.length > 0) {
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      const randomMove = validMoves[randomIndex];
      return { x: randomMove.x, z: randomMove.z };
    }
    return null;
  }
}

function evaluateOpponentThreats(board: GameBoard): number {
  let threatScore = 0;
  const validMoves = getValidMoves(board);

  for (const move of validMoves) {
    if (checkWinningMove(board, move.x, move.z, 1)) {
      threatScore -= 100; // 相手の勝利手は大きなマイナス
    }
  }

  return threatScore;
}

export function GamePage({
  gameMode,
  onBackToMenu,
  onlineRoom,
  onlinePlayerId,
  makeOnlineMove,
}: GamePageProps) {
  const [board, setBoard] = useState<GameBoard>(() =>
    Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => Array(GRID_SIZE).fill(null)),
      ),
  );
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [showVerticalGrid, setShowVerticalGrid] = useState(true);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(false);
  const [winner, setWinner] = useState<Player>(null);
  const [gameOver, setGameOver] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("normal");

  const [player1Color, setPlayer1Color] = useState("#ef4444"); // 赤
  const [player2Color, setPlayer2Color] = useState("#3b82f6"); // 青
  // Shape pickers are not wired to UI yet; keep as constants until they are.
  const player1Shape: PieceShape = "sphere";
  const player2Shape: PieceShape = "cube";

  const [showSettings, setShowSettings] = useState(false);
  const [showReachLines, setShowReachLines] = useState(true);

  // モバイル対応の状態
  const [isMobile, setIsMobile] = useState(false);

  // 処理中フラグ
  const [isProcessing, setIsProcessing] = useState(false);

  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // resetGame関数を定義
  const resetGame = useCallback(() => {
    setBoard(
      Array(GRID_SIZE)
        .fill(null)
        .map(() =>
          Array(GRID_SIZE)
            .fill(null)
            .map(() => Array(GRID_SIZE).fill(null)),
        ),
    );
    setCurrentPlayer(1);
    setWinner(null);
    setGameOver(false);
    setAiThinking(false);
    setIsProcessing(false); // 処理フラグもリセット
  }, []);

  // オンラインモードでの自分のプレイヤー番号 (1 or 2)。null は未確定。
  const localOnlinePlayer = useMemo<1 | 2 | null>(() => {
    if (gameMode !== "online" || !onlinePlayerId || !onlineRoom?.players) return null;
    const idx = onlineRoom.players.findIndex((p: any) => p.id === onlinePlayerId);
    if (idx === 0) return 1;
    if (idx === 1) return 2;
    return null;
  }, [gameMode, onlinePlayerId, onlineRoom]);

  // リーチライン計算 — 相手のリーチは絶対に表示しない (visibleReachPlayers が決定)。
  const reachLines = useMemo(() => {
    if (!showReachLines || gameOver) return [];
    const visible = visibleReachPlayers(gameMode, currentPlayer, localOnlinePlayer);
    const lines: ReachLine[] = [];
    for (const p of visible) {
      lines.push(...findReachLines(board, p));
    }
    return lines;
  }, [board, showReachLines, gameMode, currentPlayer, localOnlinePlayer, gameOver]);

  const checkWinner = useCallback((newBoard: GameBoard): Player => {
    return checkWinnerForBoard(newBoard);
  }, []);

  // Dev-only victory demo: ?victory-demo=1 or 2 forces a winner state so the
  // confetti + modal can be captured deterministically without scripting a
  // full game. Inert in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    const demo = new URLSearchParams(window.location.search).get("victory-demo");
    if (demo === "1" || demo === "2") {
      setWinner(Number(demo) as 1 | 2);
      setGameOver(true);
    }
  }, []);

  // ターン切替バナーのトリガー。currentPlayer が変わるたび、また gameOver
  // 状態がリセットされた直後 (= 新規ゲーム) にカウンタを bump して
  // TurnBanner を再マウントする。
  const [turnBannerTick, setTurnBannerTick] = useState(0);
  useEffect(() => {
    if (gameOver) return;
    setTurnBannerTick((n) => n + 1);
  }, [currentPlayer, gameOver]);

  // dropPiece関数
  const dropPiece = useCallback(
    async (x: number, z: number) => {
      // 処理中または連続クリック防止
      if (gameOver || aiThinking || isProcessing) return;
      if (gameMode === "vs-ai" && currentPlayer === 2) return;

      // 処理開始フラグを設定
      setIsProcessing(true);

      try {
        if (gameMode === "online" && onlinePlayerId && makeOnlineMove) {
          // オンラインモードでは相手の番は打てない
          const currentPlayerIndex = onlineRoom?.players.findIndex(
            (p: any) => p.id === onlinePlayerId,
          );
          if (currentPlayerIndex !== undefined && currentPlayerIndex + 1 !== currentPlayer) return;

          // オンラインで手を送信
          const success = await makeOnlineMove(x, z);
          if (!success) return;
        }

        // ローカル処理（既存のロジック）
        let y = -1;
        for (let i = 0; i < GRID_SIZE; i++) {
          if (!board[x][i][z]) {
            y = i;
            break;
          }
        }

        if (y === -1) return;

        const newBoard = board.map((layer) => layer.map((row) => [...row]));
        newBoard[x][y][z] = currentPlayer;

        setBoard(newBoard);

        const gameWinner = checkWinner(newBoard);
        if (gameWinner) {
          setWinner(gameWinner);
          setGameOver(true);
        } else {
          setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }
      } finally {
        // 短いデバウンス後に処理フラグをリセット
        setTimeout(() => setIsProcessing(false), 200);
      }
    },
    [
      board,
      currentPlayer,
      gameOver,
      checkWinner,
      gameMode,
      aiThinking,
      onlinePlayerId,
      onlineRoom,
      makeOnlineMove,
      isProcessing,
    ],
  );

  // オンラインルームの状態変更を監視
  useEffect(() => {
    if (onlineRoom && gameMode === "online") {
      setBoard(onlineRoom.gameState);
      setCurrentPlayer(onlineRoom.currentPlayer);

      if (onlineRoom.winner) {
        setWinner(onlineRoom.winner);
        setGameOver(true);
      }
    }
  }, [onlineRoom, gameMode]);

  // AI の手番処理
  useEffect(() => {
    if (gameMode === "vs-ai" && currentPlayer === 2 && !gameOver && !aiThinking) {
      setAiThinking(true);

      // 難易度に応じて思考時間を調整
      let thinkingTime = 500;
      switch (aiDifficulty) {
        case "easy":
          thinkingTime = 300 + Math.random() * 500; // 0.3-0.8秒
          break;
        case "normal":
          thinkingTime = 500 + Math.random() * 1000; // 0.5-1.5秒
          break;
        case "hard":
          thinkingTime = 1000 + Math.random() * 1500; // 1.0-2.5秒
          break;
      }

      setTimeout(() => {
        const aiMove = getAIMove(board, aiDifficulty);
        if (aiMove) {
          // AIの手を直接処理
          let y = -1;
          for (let i = 0; i < GRID_SIZE; i++) {
            if (!board[aiMove.x][i][aiMove.z]) {
              y = i;
              break;
            }
          }

          if (y !== -1) {
            const newBoard = board.map((layer) => layer.map((row) => [...row]));
            newBoard[aiMove.x][y][aiMove.z] = 2;

            setBoard(newBoard);

            const gameWinner = checkWinner(newBoard);
            if (gameWinner) {
              setWinner(gameWinner);
              setGameOver(true);
            } else {
              setCurrentPlayer(1);
            }
          }
        }
        setAiThinking(false);
      }, thinkingTime);
    }
  }, [currentPlayer, gameMode, gameOver, board, aiThinking, checkWinner, aiDifficulty]);

  const currentDifficulty = AI_DIFFICULTIES.find((diff) => diff.id === aiDifficulty);

  // 勝利メッセージとアイコンを取得
  const getVictoryInfo = () => {
    if (!winner) return null;

    const winnerColor = winner === 1 ? player1Color : player2Color;

    if (gameMode === "vs-ai") {
      const isPlayerWin = winner === 1;
      return {
        title: isPlayerWin ? "勝利！" : "敗北...",
        subtitle: isPlayerWin ? "おめでとうございます！" : "AIの勝利です",
        color: winnerColor,
        Icon: isPlayerWin ? Trophy : Frown,
        bgColor: isPlayerWin ? "from-green-400 to-blue-500" : "from-red-400 to-pink-500",
      };
    } else {
      return {
        title: `プレイヤー${winner}の勝利！`,
        subtitle: "おめでとうございます！",
        color: winnerColor,
        Icon: Trophy,
        bgColor: "from-yellow-400 to-orange-500",
      };
    }
  };

  const victoryInfo = getVictoryInfo();

  // Dev-only label override: ?fake-name1=...&fake-name2=... lets us preview
  // the turn banner with arbitrary player names (the longest realistic case
  // being a 20-char online player name). Inert in production.
  const fakeNames = useMemo(() => {
    if (process.env.NODE_ENV === "production") return null;
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const n1 = sp.get("fake-name1");
    const n2 = sp.get("fake-name2");
    if (!n1 && !n2) return null;
    return { 1: n1 ?? "プレイヤー 1", 2: n2 ?? "プレイヤー 2" } as Record<1 | 2, string>;
  }, []);

  // getPlayerLabel関数
  const getPlayerLabel = (player: number) => {
    if (fakeNames && (player === 1 || player === 2)) return fakeNames[player as 1 | 2];
    if (gameMode === "vs-ai") {
      return player === 1 ? "あなた" : "AI";
    } else if (gameMode === "online" && onlineRoom) {
      const playerData = onlineRoom.players[player - 1];
      return playerData ? playerData.name : `プレイヤー ${player}`;
    }
    return `プレイヤー ${player}`;
  };

  return (
    <>
      <title>3D Connect Four - 3D4目並べゲーム</title>
      <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col">
        {/* ターン切替バナー (Fire Emblem 風) */}
        <TurnBanner
          triggerKey={turnBannerTick}
          label={`${getPlayerLabel(currentPlayer)}のターン`}
          sublabel={
            gameMode === "vs-ai"
              ? currentPlayer === 1
                ? "Your Phase"
                : "Enemy Phase"
              : `Player ${currentPlayer} Phase`
          }
          color={currentPlayer === 1 ? player1Color : player2Color}
          isOpponent={
            gameMode === "vs-ai"
              ? currentPlayer === 2
              : gameMode === "online"
                ? localOnlinePlayer !== null && currentPlayer !== localOnlinePlayer
                : currentPlayer === 2
          }
        />

        {/* 勝利時のクラッカー (winner が確定してから modal の裏で炸裂) */}
        {gameOver && victoryInfo && winner && (
          <VictoryCrackers triggerKey={winner} accentColor={victoryInfo.color} />
        )}

        {/* 勝利モーダル */}
        {gameOver && victoryInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in zoom-in duration-500">
              {/* ヘッダー部分 */}
              <div className={`bg-gradient-to-r ${victoryInfo.bgColor} p-6 text-center text-white`}>
                <div className="mb-3 flex justify-center" style={{ color: victoryInfo.color }}>
                  <victoryInfo.Icon className="w-12 h-12 md:w-16 md:h-16" strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{victoryInfo.title}</h2>
                <p className="text-base md:text-lg opacity-90">{victoryInfo.subtitle}</p>
              </div>

              {/* コンテンツ部分 */}
              <div className="p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-3">
                    <div
                      className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: victoryInfo.color }}
                    />
                    <span className="text-lg md:text-xl font-semibold text-gray-800">
                      {gameMode === "vs-ai"
                        ? winner === 1
                          ? "あなたの勝利！"
                          : "AIの勝利！"
                        : `プレイヤー${winner}の勝利！`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    モード:{" "}
                    {gameMode === "vs-ai"
                      ? "vs AI"
                      : gameMode === "two-player"
                        ? "2プレイヤー"
                        : "オンライン"}
                    {gameMode === "vs-ai" && currentDifficulty && (
                      <span className="ml-2">({currentDifficulty.name})</span>
                    )}
                  </div>
                </div>

                {/* ボタン */}
                <div className="space-y-3">
                  <Button
                    onClick={resetGame}
                    size="lg"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3"
                  >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    新しいゲーム
                  </Button>
                  <Button
                    onClick={onBackToMenu}
                    variant="outline"
                    size="lg"
                    className="w-full border-2 hover:bg-gray-50 font-semibold py-3 bg-transparent"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    メニューに戻る
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ヘッダー - モバイル最適化 */}
        <div className="flex-shrink-0 p-2 md:p-4">
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-base md:text-lg font-bold truncate">3D Connect Four</div>
                  <div className="text-xs md:text-sm text-gray-600 truncate">
                    {gameMode === "vs-ai"
                      ? "vs AI"
                      : gameMode === "two-player"
                        ? "2プレイヤー"
                        : "オンライン"}
                    {gameMode === "vs-ai" && currentDifficulty && (
                      <span className="ml-1" style={{ color: currentDifficulty.color }}>
                        ({currentDifficulty.name})
                      </span>
                    )}
                  </div>
                </div>

                {/* 現在のプレイヤー表示 */}
                {!gameOver && (
                  <div className="flex items-center gap-2 mx-3">
                    <div
                      className="w-3 h-3 md:w-4 md:h-4 rounded-full"
                      style={{ backgroundColor: currentPlayer === 1 ? player1Color : player2Color }}
                    />
                    <span className="text-sm md:text-base font-medium">
                      {getPlayerLabel(currentPlayer)}
                      {aiThinking && " (思考中...)"}
                    </span>
                    {showReachLines && reachLines.length > 0 && (
                      <Zap className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
                    )}
                  </div>
                )}

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBackToMenu}
                    className="h-8 w-8 p-0 md:h-10 md:w-10"
                    title="メニューに戻る"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="h-8 w-8 p-0 md:h-10 md:w-10"
                    title={showSettings ? "閉じる" : "設定"}
                  >
                    {showSettings ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* メインゲームエリア */}
        <div className="flex-1 relative min-h-0">
          {/* 3Dキャンバス */}
          <div className="absolute inset-0">
            <Canvas
              camera={{
                position: isMobile ? [6, 6, 6] : [8, 8, 8],
                fov: isMobile ? 70 : 60,
              }}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 10, 5]} intensity={0.8} />
              <pointLight position={[-10, -10, -5]} intensity={0.4} />

              <GameBoard3D
                board={board}
                onCellClick={dropPiece}
                gameOver={gameOver}
                showVerticalGrid={showVerticalGrid}
                showHorizontalGrid={showHorizontalGrid}
                player1Color={player1Color}
                player2Color={player2Color}
                player1Shape={player1Shape}
                player2Shape={player2Shape}
                aiThinking={aiThinking}
                reachLines={reachLines}
              />

              <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={isMobile ? 4 : 5}
                maxDistance={isMobile ? 15 : 20}
                maxPolarAngle={Math.PI * 0.8}
                minPolarAngle={Math.PI * 0.1}
                enableDamping={true}
                dampingFactor={0.05}
                rotateSpeed={isMobile ? 0.8 : 1.0}
                zoomSpeed={isMobile ? 0.8 : 1.0}
                panSpeed={isMobile ? 0.8 : 1.0}
                touches={{
                  ONE: THREE.TOUCH.ROTATE,
                  TWO: THREE.TOUCH.DOLLY_PAN,
                }}
              />
            </Canvas>
          </div>

          {/* 操作ヒント - モバイル用 */}
          {isMobile && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-center">
                <div className="text-sm">
                  <div className="flex justify-center items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <RotateCw className="w-3.5 h-3.5" />
                      回転: 1本指
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5" />
                      ズーム: 2本指
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Hand className="w-3.5 h-3.5" />
                      配置: タップ
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 設定パネル - モバイル最適化 */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="text-lg font-bold">ゲーム設定</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="h-8 w-8 p-0"
                  title="閉じる"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-4 space-y-6">
                {gameMode === "vs-ai" && (
                  <div>
                    <div className="text-sm font-medium mb-3">AI難易度</div>
                    <div className="grid gap-2">
                      {AI_DIFFICULTIES.map((difficulty) => (
                        <Button
                          key={difficulty.id}
                          variant={aiDifficulty === difficulty.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAiDifficulty(difficulty.id)}
                          className="justify-start text-sm"
                          style={{
                            backgroundColor:
                              aiDifficulty === difficulty.id ? difficulty.color : undefined,
                            borderColor: difficulty.color,
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{difficulty.name}</span>
                            <span className="text-xs opacity-70">{difficulty.description}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium mb-3">表示設定</div>
                  <div className="space-y-2">
                    <Button
                      variant={showReachLines ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowReachLines(!showReachLines)}
                      className="w-full justify-start text-sm gap-2"
                    >
                      {showReachLines ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      リーチライン表示
                    </Button>
                    <Button
                      variant={showVerticalGrid ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowVerticalGrid(!showVerticalGrid)}
                      className="w-full justify-start text-sm gap-2"
                    >
                      {showVerticalGrid ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      垂直グリッド
                    </Button>
                    <Button
                      variant={showHorizontalGrid ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHorizontalGrid(!showHorizontalGrid)}
                      className="w-full justify-start text-sm gap-2"
                    >
                      {showHorizontalGrid ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      水平グリッド
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-3">プレイヤー色</div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs mb-2 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: player1Color }}
                        />
                        {gameMode === "vs-ai" ? "あなた" : "プレイヤー1"}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PRESETS.slice(0, 4).map((color) => (
                          <button
                            key={`p1-${color.value}`}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              player1Color === color.value
                                ? "border-gray-800 scale-110"
                                : "border-gray-300 hover:border-gray-500"
                            }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setPlayer1Color(color.value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-2 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: player2Color }}
                        />
                        {gameMode === "vs-ai" ? "AI" : "プレイヤー2"}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PRESETS.slice(4, 8).map((color) => (
                          <button
                            key={`p2-${color.value}`}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              player2Color === color.value
                                ? "border-gray-800 scale-110"
                                : "border-gray-300 hover:border-gray-500"
                            }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setPlayer2Color(color.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={resetGame} variant="outline" className="w-full bg-transparent">
                    <RotateCw className="w-4 h-4 mr-2" />
                    ゲームリセット
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function GameBoard3D({
  board,
  onCellClick,
  gameOver,
  showVerticalGrid,
  showHorizontalGrid,
  player1Color,
  player2Color,
  player1Shape,
  player2Shape,
  aiThinking,
  reachLines,
}: {
  board: GameBoard;
  onCellClick: (x: number, z: number) => void;
  gameOver: boolean;
  showVerticalGrid: boolean;
  showHorizontalGrid: boolean;
  player1Color: string;
  player2Color: string;
  player1Shape: PieceShape;
  player2Shape: PieceShape;
  aiThinking: boolean;
  reachLines: ReachLine[];
}) {
  return (
    <group>
      {/* グリッドフレーム */}
      <GridFrame showVertical={showVerticalGrid} showHorizontal={showHorizontalGrid} />

      {/* リーチライン表示 */}
      {reachLines.map((reachLine, index) => (
        <ReachLineDisplay
          key={`reach-line-${index}`}
          reachLine={reachLine}
          player1Color={player1Color}
          player2Color={player2Color}
        />
      ))}

      {/* ゲームピース */}
      {board.map((layer, x) =>
        layer.map((row, y) =>
          row.map((cell, z) => (
            <GamePiece
              key={`${x}-${y}-${z}`}
              position={[(x - 4 / 2 + 0.5) * 1.2, (y - 4 / 2 + 0.5) * 1.2, (z - 4 / 2 + 0.5) * 1.2]}
              player={cell}
              player1Color={player1Color}
              player2Color={player2Color}
              player1Shape={player1Shape}
              player2Shape={player2Shape}
            />
          )),
        ),
      )}

      {/* クリック可能なエリア（底面） - ダブルクリック防止 */}
      {!gameOver &&
        Array(4)
          .fill(null)
          .map((_, x) =>
            Array(4)
              .fill(null)
              .map((_, z) => (
                <mesh
                  key={`clickable-${x}-${z}`}
                  position={[
                    (x - 4 / 2 + 0.5) * 1.2,
                    (-4 / 2) * 1.2 - 0.5,
                    (z - 4 / 2 + 0.5) * 1.2,
                  ]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCellClick(x, z);
                  }}
                >
                  <boxGeometry args={[1.2 * 0.9, 0.15, 1.2 * 0.9]} />
                  <meshStandardMaterial
                    color={aiThinking ? "#94a3b8" : "#4ade80"}
                    transparent
                    opacity={aiThinking ? 0.2 : 0.4}
                  />
                </mesh>
              )),
          )}
    </group>
  );
}

function ReachLineDisplay({
  reachLine,
  player1Color,
  player2Color,
}: {
  reachLine: ReachLine;
  player1Color: string;
  player2Color: string;
}) {
  const lineRef = useRef<THREE.Group>(null);
  const lineColor = reachLine.player === 1 ? player1Color : player2Color;

  useFrame((state) => {
    if (lineRef.current) {
      // パルス効果
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7;
      lineRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.opacity = pulse;
        }
      });
    }
  });

  return (
    <group ref={lineRef}>
      {/* リーチライン */}
      {reachLine.positions.map((pos, index) => {
        const [x, y, z] = pos;
        const isWinningPosition = pos === reachLine.winningPosition;

        return (
          <mesh
            key={`reach-${index}`}
            position={[(x - 4 / 2 + 0.5) * 1.2, (y - 4 / 2 + 0.5) * 1.2, (z - 4 / 2 + 0.5) * 1.2]}
          >
            {isWinningPosition ? (
              // 勝利可能位置は大きく表示
              <sphereGeometry args={[0.6, 16, 16]} />
            ) : (
              // 既存のピースは小さく表示
              <sphereGeometry args={[0.3, 16, 16]} />
            )}
            <meshStandardMaterial
              color={lineColor}
              transparent
              opacity={isWinningPosition ? 0.8 : 0.4}
              emissive={lineColor}
              emissiveIntensity={isWinningPosition ? 0.3 : 0.1}
            />
          </mesh>
        );
      })}

      {/* 接続線 */}
      {reachLine.positions.slice(0, -1).map((pos, index) => {
        const [x1, y1, z1] = pos;
        const [x2, y2, z2] = reachLine.positions[index + 1];

        const start = new THREE.Vector3(
          (x1 - 4 / 2 + 0.5) * 1.2,
          (y1 - 4 / 2 + 0.5) * 1.2,
          (z1 - 4 / 2 + 0.5) * 1.2,
        );
        const end = new THREE.Vector3(
          (x2 - 4 / 2 + 0.5) * 1.2,
          (y2 - 4 / 2 + 0.5) * 1.2,
          (z2 - 4 / 2 + 0.5) * 1.2,
        );

        const direction = end.clone().sub(start);
        const length = direction.length();
        const center = start.clone().add(end).multiplyScalar(0.5);

        return (
          <mesh key={`line-${index}`} position={center.toArray()}>
            <cylinderGeometry args={[0.05, 0.05, length]} />
            <meshStandardMaterial
              color={lineColor}
              transparent
              opacity={0.6}
              emissive={lineColor}
              emissiveIntensity={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function GridFrame({
  showVertical,
  showHorizontal,
}: {
  showVertical: boolean;
  showHorizontal: boolean;
}) {
  const lineRef = useRef<THREE.Group>(null);

  return (
    <group ref={lineRef}>
      {/* 縦線（垂直グリッド） */}
      {showVertical &&
        Array(4 + 1)
          .fill(null)
          .map((_, i) =>
            Array(4 + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`vertical-${i}-${j}`}
                  position={[(i - 4 / 2) * 1.2, 0, (j - 4 / 2) * 1.2]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 4 * 1.2]} />
                  <meshStandardMaterial color="#64748b" opacity={0.6} transparent />
                </mesh>
              )),
          )}

      {/* 横線（X方向 - 水平グリッド） */}
      {showHorizontal &&
        Array(4 + 1)
          .fill(null)
          .map((_, i) =>
            Array(4 + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`horizontal-x-${i}-${j}`}
                  position={[0, (i - 4 / 2) * 1.2, (j - 4 / 2) * 1.2]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.015, 0.015, 4 * 1.2]} />
                  <meshStandardMaterial color="#94a3b8" opacity={0.4} transparent />
                </mesh>
              )),
          )}

      {/* 横線（Z方向 - 水平グリッド） */}
      {showHorizontal &&
        Array(4 + 1)
          .fill(null)
          .map((_, i) =>
            Array(4 + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`horizontal-z-${i}-${j}`}
                  position={[(i - 4 / 2) * 1.2, (j - 4 / 2) * 1.2, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.015, 0.015, 4 * 1.2]} />
                  <meshStandardMaterial color="#94a3b8" opacity={0.4} transparent />
                </mesh>
              )),
          )}
    </group>
  );
}

function GamePiece({
  position,
  player,
  player1Color,
  player2Color,
  player1Shape,
  player2Shape,
}: {
  position: [number, number, number];
  player: Player;
  player1Color: string;
  player2Color: string;
  player1Shape: PieceShape;
  player2Shape: PieceShape;
}) {
  const meshRef = useRef<THREE.Object3D>(null);

  // 回転アニメーション
  useFrame((state) => {
    if (meshRef.current && player) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  if (!player) return null;

  const color = player === 1 ? player1Color : player2Color;
  const shape = player === 1 ? player1Shape : player2Shape;

  // ===== 各形状のジオメトリ定義 =====
  const Geometry = () => {
    switch (shape) {
      case "sphere":
        return <sphereGeometry args={[0.4, 32, 32]} />;
      case "cube":
        return <boxGeometry args={[0.7, 0.7, 0.7]} />;
      case "cylinder":
        return <cylinderGeometry args={[0.35, 0.35, 0.8, 32]} />;
      case "cone":
        return <coneGeometry args={[0.4, 0.8, 32]} />;
      case "octahedron":
        return <octahedronGeometry args={[0.45]} />;
      case "dodecahedron":
        return <dodecahedronGeometry args={[0.35]} />;
      case "torus":
        return <torusGeometry args={[0.3, 0.15, 16, 32]} />;
      // diamond は上下 2 つの円錐を合体
      case "diamond":
        return null;
      default:
        return <sphereGeometry args={[0.4, 32, 32]} />;
    }
  };

  // ===== diamond 専用描画 =====
  if (shape === "diamond") {
    return (
      <group ref={meshRef} position={position}>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.35, 0.4, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.35, 0.4, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // ===== 通常形状描画 =====
  return (
    <mesh ref={meshRef} position={position}>
      <Geometry />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.2} />
    </mesh>
  );
}
