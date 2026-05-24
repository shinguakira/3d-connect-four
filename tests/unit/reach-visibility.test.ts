import { describe, it, expect } from "vitest";
import {
  createEmptyBoard,
  findReachLines,
  visibleReachPlayers,
} from "@/lib/game-logic";

describe("findReachLines", () => {
  it("returns no reach when player has fewer than three in a row", () => {
    const board = createEmptyBoard();
    board[0][0][0] = 1;
    board[1][0][0] = 1;
    expect(findReachLines(board, 1)).toHaveLength(0);
  });

  it("detects a ground-row reach along x", () => {
    const board = createEmptyBoard();
    board[0][0][0] = 1;
    board[1][0][0] = 1;
    board[2][0][0] = 1;
    const reaches = findReachLines(board, 1);
    expect(reaches.length).toBeGreaterThan(0);
    expect(reaches[0].winningPosition).toEqual([3, 0, 0]);
  });

  it("does NOT report opponent reach for the queried player", () => {
    const board = createEmptyBoard();
    // Player 2 has 3-in-a-row along the ground.
    board[0][0][1] = 2;
    board[1][0][1] = 2;
    board[2][0][1] = 2;
    // Querying as player 1: should see nothing for the opponent's threat.
    expect(findReachLines(board, 1)).toHaveLength(0);
    // Querying as player 2: should see the threat.
    expect(findReachLines(board, 2).length).toBeGreaterThan(0);
  });

  it("ignores a floating gap with no support (gravity)", () => {
    const board = createEmptyBoard();
    // Three player-1 pieces sit at y=1 with the (3,*,0) slot empty,
    // but column (3,0) has no support so the gap is unreachable.
    board[0][1][0] = 1;
    board[1][1][0] = 1;
    board[2][1][0] = 1;
    expect(findReachLines(board, 1)).toHaveLength(0);
  });
});

describe("visibleReachPlayers — opponent must not see my reach lines", () => {
  it("vs-ai always shows only the human (player 1), never the AI", () => {
    expect(visibleReachPlayers("vs-ai", 1, null)).toEqual([1]);
    // Even while it's the AI's turn, do NOT leak the AI's threats.
    expect(visibleReachPlayers("vs-ai", 2, null)).toEqual([1]);
  });

  it("online shows only the local player's reach (host = player 1)", () => {
    expect(visibleReachPlayers("online", 1, 1)).toEqual([1]);
    expect(visibleReachPlayers("online", 2, 1)).toEqual([1]);
  });

  it("online shows only the local player's reach (guest = player 2)", () => {
    expect(visibleReachPlayers("online", 1, 2)).toEqual([2]);
    expect(visibleReachPlayers("online", 2, 2)).toEqual([2]);
  });

  it("online returns nothing when the local player slot is unknown", () => {
    expect(visibleReachPlayers("online", 1, null)).toEqual([]);
  });

  it("two-player (pass-and-play) shows only the player whose turn it is", () => {
    // Same screen → still hide the off-turn player's threats from the active viewer.
    expect(visibleReachPlayers("two-player", 1, null)).toEqual([1]);
    expect(visibleReachPlayers("two-player", 2, null)).toEqual([2]);
  });

  it("never returns both players for any mode (no opponent leak)", () => {
    const modes = ["vs-ai", "online", "two-player"] as const;
    for (const mode of modes) {
      for (const cur of [1, 2] as const) {
        for (const local of [null, 1, 2] as const) {
          const v = visibleReachPlayers(mode, cur, local);
          expect(v.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
