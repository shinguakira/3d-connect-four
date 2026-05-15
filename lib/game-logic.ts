import type { GameBoard, Player } from "@/types/GameBoard";

export const GRID_SIZE = 4;

export function createEmptyBoard(): GameBoard {
  return Array(GRID_SIZE)
    .fill(null)
    .map(() =>
      Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill(null) as Player[]),
    ) as GameBoard;
}

export function cloneBoard(board: GameBoard): GameBoard {
  return board.map((layer) => layer.map((row) => [...row])) as GameBoard;
}

export function dropY(board: GameBoard, x: number, z: number): number {
  if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return -1;
  for (let y = 0; y < GRID_SIZE; y++) {
    if (board[x][y][z] === null) return y;
  }
  return -1;
}

export function isColumnFull(board: GameBoard, x: number, z: number): boolean {
  return dropY(board, x, z) === -1;
}

export function getValidMoves(board: GameBoard): Array<{ x: number; z: number; y: number }> {
  const moves: Array<{ x: number; z: number; y: number }> = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const y = dropY(board, x, z);
      if (y !== -1) moves.push({ x, z, y });
    }
  }
  return moves;
}

export function applyMove(
  board: GameBoard,
  x: number,
  z: number,
  player: Exclude<Player, null>,
): { board: GameBoard; y: number } | null {
  const y = dropY(board, x, z);
  if (y === -1) return null;
  const next = cloneBoard(board);
  next[x][y][z] = player;
  return { board: next, y };
}

export function isBoardFull(board: GameBoard): boolean {
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (!isColumnFull(board, x, z)) return false;
    }
  }
  return true;
}

// 13 unique direction vectors covering all 26 axes (each line tested once).
export const DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = [
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

export function checkWinner(board: GameBoard): Player {
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const player = board[x][y][z];
        if (!player) continue;

        for (const [dx, dy, dz] of DIRECTIONS) {
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

          if (count >= 4) return player;
        }
      }
    }
  }
  return null;
}

export function isWinningMove(
  board: GameBoard,
  x: number,
  z: number,
  player: Exclude<Player, null>,
): boolean {
  const result = applyMove(board, x, z, player);
  if (!result) return false;
  return checkWinner(result.board) === player;
}
