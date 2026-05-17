import { describe, it, expect } from "vitest";
import {
  applyMove,
  checkWinner,
  createEmptyBoard,
  dropY,
  getValidMoves,
  isBoardFull,
  isWinningMove,
} from "@/lib/game-logic";
import type { GameBoard } from "@/types/GameBoard";

function emptyBoard(): GameBoard {
  return createEmptyBoard();
}

describe("game-logic: every 4-in-a-row direction", () => {
  // 26 axial directions collapse into 13 unique line orientations. The
  // checkWinner implementation walks both +dir and -dir from each seed cell,
  // so verifying every orientation here pins the directional matrix down.
  const cases: Array<{
    name: string;
    seed: [number, number, number];
    step: [number, number, number];
  }> = [
    { name: "x axis", seed: [0, 0, 0], step: [1, 0, 0] },
    { name: "y axis", seed: [0, 0, 0], step: [0, 1, 0] },
    { name: "z axis", seed: [0, 0, 0], step: [0, 0, 1] },
    { name: "xy diag", seed: [0, 0, 0], step: [1, 1, 0] },
    { name: "xy anti-diag", seed: [0, 3, 0], step: [1, -1, 0] },
    { name: "yz diag", seed: [0, 0, 0], step: [0, 1, 1] },
    { name: "yz anti-diag", seed: [0, 3, 0], step: [0, -1, 1] },
    { name: "xz diag", seed: [0, 0, 0], step: [1, 0, 1] },
    { name: "xz anti-diag", seed: [3, 0, 0], step: [-1, 0, 1] },
    { name: "main cube diag", seed: [0, 0, 0], step: [1, 1, 1] },
    { name: "cube diag b", seed: [0, 0, 3], step: [1, 1, -1] },
    { name: "cube diag c", seed: [0, 3, 0], step: [1, -1, 1] },
    { name: "cube diag d", seed: [3, 0, 0], step: [-1, 1, 1] },
  ];

  for (const c of cases) {
    it(`detects a win along ${c.name}`, () => {
      const board = emptyBoard();
      for (let i = 0; i < 4; i++) {
        const x = c.seed[0] + c.step[0] * i;
        const y = c.seed[1] + c.step[1] * i;
        const z = c.seed[2] + c.step[2] * i;
        board[x][y][z] = 1;
      }
      expect(checkWinner(board)).toBe(1);
    });
  }
});

describe("game-logic: partial-fill no-winner scenarios", () => {
  it("a partially filled board with no 4-in-a-row has no winner", () => {
    const board = emptyBoard();
    // 6 player-1 pieces and 6 player-2 pieces, none forming a 4-line:
    // three in a row at (0..2, 0, 0) for player 1, broken by player 2 at x=3.
    board[0][0][0] = 1;
    board[1][0][0] = 1;
    board[2][0][0] = 1;
    board[3][0][0] = 2;
    // three for player 1 along z at (0, 0, 0..2), broken by player 2 at z=3.
    board[0][0][1] = 1;
    board[0][0][2] = 1;
    board[0][0][3] = 2;
    // a few more scattered pieces
    board[3][0][1] = 1;
    board[3][0][2] = 2;
    board[1][0][1] = 2;
    board[2][0][2] = 2;
    expect(checkWinner(board)).toBeNull();
    expect(isBoardFull(board)).toBe(false);
    // 16 columns total; 8 still have y=0 empty.
    expect(getValidMoves(board)).toHaveLength(16);
  });

  it("a column filled with alternating colors does not register a win", () => {
    const board = emptyBoard();
    board[2][0][1] = 1;
    board[2][1][1] = 2;
    board[2][2][1] = 1;
    board[2][3][1] = 2;
    expect(checkWinner(board)).toBeNull();
  });
});

describe("game-logic: gravity edge cases", () => {
  it("isWinningMove respects gravity: cannot land on a floating square", () => {
    // Three player-1 pieces sit at y=1, z=0 (x = 0..2). Column (3, 0) has NO
    // support, so dropping there lands at y=0, NOT y=1 — the row at y=1
    // therefore does not complete.
    const board = emptyBoard();
    board[0][1][0] = 1;
    board[1][1][0] = 1;
    board[2][1][0] = 1;
    // Mixed support at y=0 prevents an accidental player-2 win along x.
    board[0][0][0] = 1;
    board[1][0][0] = 2;
    board[2][0][0] = 1;
    expect(checkWinner(board)).toBeNull();
    expect(isWinningMove(board, 3, 0, 1)).toBe(false);
  });

  it("isWinningMove returns true once the column has support to reach the row", () => {
    const board = emptyBoard();
    board[0][1][0] = 1;
    board[1][1][0] = 1;
    board[2][1][0] = 1;
    // Support so dropping at (3, 0) lands at y=1.
    board[0][0][0] = 1;
    board[1][0][0] = 2;
    board[2][0][0] = 1;
    board[3][0][0] = 2;
    expect(isWinningMove(board, 3, 0, 1)).toBe(true);
  });

  it("applyMove returns null without mutating when the column is full", () => {
    const board = emptyBoard();
    for (let y = 0; y < 4; y++) board[1][y][1] = 1;
    const snapshot = JSON.stringify(board);
    expect(applyMove(board, 1, 1, 2)).toBeNull();
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("dropY treats fractional / NaN / Infinity coords as out-of-range", () => {
    const board = emptyBoard();
    expect(dropY(board, Number.NaN, 0)).toBe(-1);
    expect(dropY(board, 0, Number.POSITIVE_INFINITY)).toBe(-1);
    expect(dropY(board, 1.5, 0)).toBe(-1);
    expect(dropY(board, 0, -0.0001)).toBe(-1);
  });
});
