"use client";

import { useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// インポートを追加
import { OnlineMenu } from "@/components/online-menu";
import { OnlineWaiting } from "@/components/online-waiting";
import { useOnlineGame } from "@/hooks/useOnlineGame";
import { TitlePage } from "@/components/title-page";
import { GamePage } from "@/components/game-page";

type Player = 1 | 2 | null;
type GameBoard = Player[][][];
type GameMode = "two-player" | "vs-ai" | "online";
type GameState =
  | "menu"
  | "playing"
  | "online-menu"
  | "online-waiting"
  | "online-playing";
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

interface ReachLine {
  positions: [number, number, number][];
  player: Player;
  winningPosition: [number, number, number];
}

const GRID_SIZE = 4;
const CELL_SIZE = 1.2;

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

const PIECE_SHAPES = [
  {
    id: "sphere" as PieceShape,
    name: "球体",
    icon: "●",
    description: "クラシックな球形",
  },
  {
    id: "cube" as PieceShape,
    name: "立方体",
    icon: "■",
    description: "シンプルな立方体",
  },
  {
    id: "cylinder" as PieceShape,
    name: "円柱",
    icon: "⬢",
    description: "円柱形状",
  },
  {
    id: "cone" as PieceShape,
    name: "円錐",
    icon: "▲",
    description: "三角錐形状",
  },
  {
    id: "octahedron" as PieceShape,
    name: "八面体",
    icon: "◆",
    description: "8面の多面体",
  },
  {
    id: "dodecahedron" as PieceShape,
    name: "十二面体",
    icon: "⬟",
    description: "12面の多面体",
  },
  {
    id: "torus" as PieceShape,
    name: "トーラス",
    icon: "◯",
    description: "ドーナツ形状",
  },
  {
    id: "diamond" as PieceShape,
    name: "ダイヤモンド",
    icon: "♦",
    description: "ダイヤモンド形状",
  },
];

const GAME_MODES = [
  {
    id: "two-player" as GameMode,
    name: "2プレイヤー",
    description: "友達と対戦",
    available: true,
  },
  {
    id: "vs-ai" as GameMode,
    name: "vs AI",
    description: "コンピューター対戦",
    available: true,
  },
  {
    id: "online" as GameMode,
    name: "オンライン",
    description: "オンライン対戦",
    available: true,
  },
];

const AI_DIFFICULTIES = [
  {
    id: "easy" as AIDifficulty,
    name: "簡単",
    description: "初心者向け",
    color: "#22c55e",
  },
  {
    id: "normal" as AIDifficulty,
    name: "普通",
    description: "バランス良く",
    color: "#f59e0b",
  },
  {
    id: "hard" as AIDifficulty,
    name: "難しい",
    description: "上級者向け",
    color: "#ef4444",
  },
];

// AI思考用のヘルパー関数
function getValidMoves(
  board: GameBoard
): Array<{ x: number; z: number; y: number }> {
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

function simulateMove(
  board: GameBoard,
  x: number,
  z: number,
  player: Player
): GameBoard {
  const newBoard = board.map((layer) => layer.map((row) => [...row]));

  for (let y = 0; y < GRID_SIZE; y++) {
    if (!newBoard[x][y][z]) {
      newBoard[x][y][z] = player;
      break;
    }
  }

  return newBoard;
}

function evaluatePosition(
  board: GameBoard,
  player: Player,
  difficulty: AIDifficulty
): number {
  let score = 0;

  // 中央付近のポジションにボーナス
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (board[x][y][z] === player) {
          const centerDistance =
            Math.abs(x - 1.5) + Math.abs(y - 1.5) + Math.abs(z - 1.5);
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

function evaluateLines(
  board: GameBoard,
  x: number,
  y: number,
  z: number,
  player: Player
): number {
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

      if (
        nx < 0 ||
        nx >= GRID_SIZE ||
        ny < 0 ||
        ny >= GRID_SIZE ||
        nz < 0 ||
        nz >= GRID_SIZE
      )
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

      if (
        nx < 0 ||
        nx >= GRID_SIZE ||
        ny < 0 ||
        ny >= GRID_SIZE ||
        nz < 0 ||
        nz >= GRID_SIZE
      )
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

function checkWinningMove(
  board: GameBoard,
  x: number,
  z: number,
  player: Player
): boolean {
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

// リーチライン検出関数
function findReachLines(board: GameBoard, player: Player): ReachLine[] {
  const reachLines: ReachLine[] = [];
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

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (board[x][y][z] !== player) continue;

        for (const [dx, dy, dz] of directions) {
          const linePositions: [number, number, number][] = [[x, y, z]];
          let emptyPosition: [number, number, number] | null = null;
          let validLine = true;

          // 正方向をチェック
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
              nz >= GRID_SIZE
            ) {
              break;
            }

            if (board[nx][ny][nz] === player) {
              linePositions.push([nx, ny, nz]);
            } else if (board[nx][ny][nz] === null) {
              if (emptyPosition === null) {
                emptyPosition = [nx, ny, nz];
                linePositions.push([nx, ny, nz]);
              } else {
                validLine = false;
                break;
              }
            } else {
              break;
            }
          }

          // 負方向をチェック
          if (validLine) {
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
                nz >= GRID_SIZE
              ) {
                break;
              }

              if (board[nx][ny][nz] === player) {
                linePositions.unshift([nx, ny, nz]);
              } else if (board[nx][ny][nz] === null) {
                if (emptyPosition === null) {
                  emptyPosition = [nx, ny, nz];
                  linePositions.unshift([nx, ny, nz]);
                } else {
                  validLine = false;
                  break;
                }
              } else {
                break;
              }
            }
          }

          // 3つのピース + 1つの空きスペース = リーチライン
          if (validLine && linePositions.length === 4 && emptyPosition) {
            // 重力チェック：空きスペースが実際に配置可能か
            const [ex, ey, ez] = emptyPosition;
            let canPlace = true;

            // 重力により、下に他のピースがあるかチェック
            if (ey > 0) {
              let hasSupport = false;
              for (let checkY = ey - 1; checkY >= 0; checkY--) {
                if (board[ex][checkY][ez] !== null) {
                  hasSupport = true;
                  break;
                }
              }
              if (!hasSupport) {
                canPlace = false;
              }
            }

            if (canPlace) {
              reachLines.push({
                positions: linePositions,
                player,
                winningPosition: emptyPosition,
              });
            }
          }
        }
      }
    }
  }

  return reachLines;
}

function getAIMove(
  board: GameBoard,
  difficulty: AIDifficulty
): { x: number; z: number } | null {
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
          score += evaluateOpponentThreats(testBoard, difficulty) * 10;
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

function evaluateOpponentThreats(
  board: GameBoard,
  difficulty: AIDifficulty
): number {
  let threatScore = 0;
  const validMoves = getValidMoves(board);

  for (const move of validMoves) {
    if (checkWinningMove(board, move.x, move.z, 1)) {
      threatScore -= 100; // 相手の勝利手は大きなマイナス
    }
  }

  return threatScore;
}

export default function Component() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("two-player");

  // オンライン関連の状態
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [onlinePlayerId, setOnlinePlayerId] = useState<string | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // オンラインゲームフックを使用
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

  // ゲーム開始ハンドラー
  const handleStartGame = useCallback((mode: GameMode) => {
    if (mode === "online") {
      setGameState("online-menu");
    } else {
      setGameMode(mode);
      setGameState("playing");
    }
  }, []);

  // メニューに戻る
  const handleBackToMenu = useCallback(() => {
    setGameState("menu");
    setOnlineRoomId(null);
    setOnlinePlayerId(null);
    setOnlineError(null);
  }, []);

  // オンライン関連のハンドラー
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
    [createRoom]
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
    [joinRoom]
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
      } catch (err) {
        setOnlineError("クイックマッチに失敗しました");
      }

      setOnlineLoading(false);
    },
    [quickMatch]
  );

  const handleStartOnlineGame = useCallback(async () => {
    if (onlineRoom && onlineRoom.players.length === 2) {
      try {
        // Call the API to start the game and notify all players
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
      // 成功通知（トーストなど）を表示可能
    } catch (err) {
      console.error("クリップボードへのコピーに失敗:", err);
    }
  }, []);

  // 画面の状態に応じてレンダリング
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
      <GridFrame
        showVertical={showVerticalGrid}
        showHorizontal={showHorizontalGrid}
      />

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
              position={[
                (x - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
                (y - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
                (z - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
              ]}
              player={cell}
              player1Color={player1Color}
              player2Color={player2Color}
              player1Shape={player1Shape}
              player2Shape={player2Shape}
            />
          ))
        )
      )}

      {/* クリック可能なエリア（底面） */}
      {!gameOver &&
        Array(GRID_SIZE)
          .fill(null)
          .map((_, x) =>
            Array(GRID_SIZE)
              .fill(null)
              .map((_, z) => (
                <mesh
                  key={`clickable-${x}-${z}`}
                  position={[
                    (x - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
                    (-GRID_SIZE / 2) * CELL_SIZE - 0.5,
                    (z - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
                  ]}
                  onClick={() => onCellClick(x, z)}
                >
                  <boxGeometry args={[CELL_SIZE * 0.8, 0.1, CELL_SIZE * 0.8]} />
                  <meshStandardMaterial
                    color={aiThinking ? "#94a3b8" : "#4ade80"}
                    transparent
                    opacity={aiThinking ? 0.1 : 0.3}
                  />
                </mesh>
              ))
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
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
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
            position={[
              (x - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
              (y - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
              (z - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
            ]}
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
          (x1 - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
          (y1 - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
          (z1 - GRID_SIZE / 2 + 0.5) * CELL_SIZE
        );
        const end = new THREE.Vector3(
          (x2 - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
          (y2 - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
          (z2 - GRID_SIZE / 2 + 0.5) * CELL_SIZE
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
        Array(GRID_SIZE + 1)
          .fill(null)
          .map((_, i) =>
            Array(GRID_SIZE + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`vertical-${i}-${j}`}
                  position={[
                    (i - GRID_SIZE / 2) * CELL_SIZE,
                    0,
                    (j - GRID_SIZE / 2) * CELL_SIZE,
                  ]}
                >
                  <cylinderGeometry
                    args={[0.02, 0.02, GRID_SIZE * CELL_SIZE]}
                  />
                  <meshStandardMaterial
                    color="#64748b"
                    opacity={0.6}
                    transparent
                  />
                </mesh>
              ))
          )}

      {/* 横線（X方向 - 水平グリッド） */}
      {showHorizontal &&
        Array(GRID_SIZE + 1)
          .fill(null)
          .map((_, i) =>
            Array(GRID_SIZE + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`horizontal-x-${i}-${j}`}
                  position={[
                    0,
                    (i - GRID_SIZE / 2) * CELL_SIZE,
                    (j - GRID_SIZE / 2) * CELL_SIZE,
                  ]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry
                    args={[0.015, 0.015, GRID_SIZE * CELL_SIZE]}
                  />
                  <meshStandardMaterial
                    color="#94a3b8"
                    opacity={0.4}
                    transparent
                  />
                </mesh>
              ))
          )}

      {/* 横線（Z方向 - 水平グリッド） */}
      {showHorizontal &&
        Array(GRID_SIZE + 1)
          .fill(null)
          .map((_, i) =>
            Array(GRID_SIZE + 1)
              .fill(null)
              .map((_, j) => (
                <mesh
                  key={`horizontal-z-${i}-${j}`}
                  position={[
                    (i - GRID_SIZE / 2) * CELL_SIZE,
                    (j - GRID_SIZE / 2) * CELL_SIZE,
                    0,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry
                    args={[0.015, 0.015, GRID_SIZE * CELL_SIZE]}
                  />
                  <meshStandardMaterial
                    color="#94a3b8"
                    opacity={0.4}
                    transparent
                  />
                </mesh>
              ))
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
