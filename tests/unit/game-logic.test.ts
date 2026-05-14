import { describe, it, expect } from "vitest"
import {
  GRID_SIZE,
  applyMove,
  checkWinner,
  cloneBoard,
  createEmptyBoard,
  dropY,
  getValidMoves,
  isBoardFull,
  isColumnFull,
  isWinningMove,
} from "@/lib/game-logic"
import type { GameBoard, Player } from "@/types/GameBoard"

function emptyBoard(): GameBoard {
  return createEmptyBoard()
}

function fillColumn(board: GameBoard, x: number, z: number, players: Player[]) {
  players.forEach((p, i) => {
    board[x][i][z] = p
  })
}

describe("createEmptyBoard", () => {
  it("creates a 4x4x4 board filled with null", () => {
    const board = emptyBoard()
    expect(board).toHaveLength(GRID_SIZE)
    for (let x = 0; x < GRID_SIZE; x++) {
      expect(board[x]).toHaveLength(GRID_SIZE)
      for (let y = 0; y < GRID_SIZE; y++) {
        expect(board[x][y]).toHaveLength(GRID_SIZE)
        for (let z = 0; z < GRID_SIZE; z++) {
          expect(board[x][y][z]).toBeNull()
        }
      }
    }
  })

  it("returns independent boards", () => {
    const a = emptyBoard()
    const b = emptyBoard()
    a[0][0][0] = 1
    expect(b[0][0][0]).toBeNull()
  })
})

describe("cloneBoard", () => {
  it("deep clones so the original is not mutated", () => {
    const board = emptyBoard()
    const clone = cloneBoard(board)
    clone[0][0][0] = 1
    expect(board[0][0][0]).toBeNull()
  })
})

describe("dropY (gravity)", () => {
  it("returns 0 for an empty column", () => {
    expect(dropY(emptyBoard(), 0, 0)).toBe(0)
  })

  it("returns the next slot above existing pieces", () => {
    const board = emptyBoard()
    fillColumn(board, 1, 2, [1, 2])
    expect(dropY(board, 1, 2)).toBe(2)
  })

  it("returns -1 when the column is full", () => {
    const board = emptyBoard()
    fillColumn(board, 0, 0, [1, 2, 1, 2])
    expect(dropY(board, 0, 0)).toBe(-1)
  })

  it("returns -1 for out-of-range coords", () => {
    const board = emptyBoard()
    expect(dropY(board, -1, 0)).toBe(-1)
    expect(dropY(board, 0, GRID_SIZE)).toBe(-1)
  })
})

describe("isColumnFull / isBoardFull", () => {
  it("detects a full column", () => {
    const board = emptyBoard()
    fillColumn(board, 0, 0, [1, 1, 1, 1])
    expect(isColumnFull(board, 0, 0)).toBe(true)
    expect(isColumnFull(board, 0, 1)).toBe(false)
  })

  it("detects a full board", () => {
    const board = emptyBoard()
    expect(isBoardFull(board)).toBe(false)
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        fillColumn(board, x, z, [1, 2, 1, 2])
      }
    }
    expect(isBoardFull(board)).toBe(true)
  })
})

describe("getValidMoves", () => {
  it("returns 16 moves on an empty board (one per column)", () => {
    const moves = getValidMoves(emptyBoard())
    expect(moves).toHaveLength(GRID_SIZE * GRID_SIZE)
    expect(moves.every((m) => m.y === 0)).toBe(true)
  })

  it("excludes full columns and uses correct y", () => {
    const board = emptyBoard()
    fillColumn(board, 0, 0, [1, 2, 1, 2])
    fillColumn(board, 1, 0, [1, 2])
    const moves = getValidMoves(board)
    expect(moves.find((m) => m.x === 0 && m.z === 0)).toBeUndefined()
    const m12 = moves.find((m) => m.x === 1 && m.z === 0)
    expect(m12?.y).toBe(2)
  })
})

describe("applyMove", () => {
  it("places a piece at the gravity-determined slot without mutating the original", () => {
    const board = emptyBoard()
    const result = applyMove(board, 2, 3, 1)
    expect(result).not.toBeNull()
    expect(result!.y).toBe(0)
    expect(result!.board[2][0][3]).toBe(1)
    expect(board[2][0][3]).toBeNull()
  })

  it("stacks correctly across multiple calls", () => {
    let board = emptyBoard()
    for (const player of [1, 2, 1, 2] as const) {
      const r = applyMove(board, 0, 0, player)
      expect(r).not.toBeNull()
      board = r!.board
    }
    expect(board[0].map((row) => row[0])).toEqual([1, 2, 1, 2])
    expect(applyMove(board, 0, 0, 1)).toBeNull()
  })
})

describe("checkWinner", () => {
  it("returns null on an empty board", () => {
    expect(checkWinner(emptyBoard())).toBeNull()
  })

  it("detects a 4-in-a-row along the X axis at the bottom layer", () => {
    const board = emptyBoard()
    for (let x = 0; x < 4; x++) board[x][0][0] = 1
    expect(checkWinner(board)).toBe(1)
  })

  it("detects a vertical 4-in-a-row (Y axis)", () => {
    const board = emptyBoard()
    for (let y = 0; y < 4; y++) board[2][y][2] = 2
    expect(checkWinner(board)).toBe(2)
  })

  it("detects a 4-in-a-row along the Z axis", () => {
    const board = emptyBoard()
    for (let z = 0; z < 4; z++) board[1][0][z] = 1
    expect(checkWinner(board)).toBe(1)
  })

  it("detects a planar diagonal in the X-Y plane", () => {
    const board = emptyBoard()
    for (let i = 0; i < 4; i++) board[i][i][0] = 1
    expect(checkWinner(board)).toBe(1)
  })

  it("detects a 3D diagonal across the cube", () => {
    const board = emptyBoard()
    for (let i = 0; i < 4; i++) board[i][i][i] = 2
    expect(checkWinner(board)).toBe(2)
  })

  it("detects an anti-diagonal in the X-Z plane", () => {
    const board = emptyBoard()
    for (let i = 0; i < 4; i++) board[i][0][3 - i] = 1
    expect(checkWinner(board)).toBe(1)
  })

  it("returns null when only 3 are aligned", () => {
    const board = emptyBoard()
    for (let x = 0; x < 3; x++) board[x][0][0] = 1
    expect(checkWinner(board)).toBeNull()
  })

  it("does not consider mixed-player lines as winning", () => {
    const board = emptyBoard()
    board[0][0][0] = 1
    board[1][0][0] = 2
    board[2][0][0] = 1
    board[3][0][0] = 2
    expect(checkWinner(board)).toBeNull()
  })
})

describe("isWinningMove", () => {
  it("recognises the move that completes a horizontal line", () => {
    const board = emptyBoard()
    for (let x = 0; x < 3; x++) board[x][0][0] = 1
    expect(isWinningMove(board, 3, 0, 1)).toBe(true)
    expect(isWinningMove(board, 3, 0, 2)).toBe(false)
  })

  it("returns false for a full column", () => {
    const board = emptyBoard()
    fillColumn(board, 0, 0, [1, 1, 1, 1])
    expect(isWinningMove(board, 0, 0, 1)).toBe(false)
  })
})
