import type { GameRoom, Player, GameMove } from "@/types/online";
import { checkWinner, createEmptyBoard, dropY } from "@/lib/game-logic";

class GameManager {
  private rooms = new Map<string, GameRoom>();
  private playerConnections = new Map<string, Set<string>>(); // playerId -> roomIds

  createRoom(hostPlayer: Player): GameRoom {
    const roomId = this.generateRoomId();
    const room: GameRoom = {
      id: roomId,
      players: [hostPlayer],
      gameState: createEmptyBoard(),
      currentPlayer: 1,
      winner: null,
      gameOver: false,
      gameStarted: false,
      readyPlayerIds: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      settings: {
        player1Color: "#ef4444",
        player2Color: "#3b82f6",
        showVerticalGrid: true,
        showHorizontalGrid: false,
      },
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, player: Player): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 2) {
      return null;
    }

    room.players.push(player);
    room.lastActivity = new Date();
    return room;
  }

  makeMove(roomId: string, playerId: string, move: GameMove): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver) return null;
    if (!room.gameStarted) return null;

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1 || playerIndex + 1 !== room.currentPlayer) {
      return null;
    }

    const y = dropY(room.gameState, move.x, move.z);
    if (y === -1) return null;

    room.gameState[move.x][y][move.z] = room.currentPlayer;
    room.winner = checkWinner(room.gameState);
    room.gameOver = !!room.winner;
    if (!room.gameOver) {
      room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
    }
    room.lastActivity = new Date();

    return room;
  }

  // Mark a player as ready to start (or rematch). The transition to
  // gameStarted only fires once BOTH players have signaled ready — single-side
  // approval is not enough. Same mechanism handles a rematch after a finished
  // game: when gameOver was true and both players ready, the board resets and
  // the game resumes with currentPlayer=1.
  //
  // Idempotent: a player calling markReady twice doesn't double-count.
  // Returns null if the room or player is unknown, or there aren't yet 2
  // players in the room.
  markReady(
    roomId: string,
    playerId: string,
  ): { room: GameRoom; started: boolean; restarted: boolean } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length !== 2) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    if (!room.readyPlayerIds.includes(playerId)) {
      room.readyPlayerIds = [...room.readyPlayerIds, playerId];
    }
    room.lastActivity = new Date();

    const bothReady = room.players.every((p) => room.readyPlayerIds.includes(p.id));
    if (!bothReady) {
      return { room, started: false, restarted: false };
    }

    // Both players ready — fire the appropriate transition.
    const wasGameOver = room.gameOver;
    const wasNotStarted = !room.gameStarted;

    if (wasGameOver) {
      // Rematch: reset board and resume.
      room.gameState = createEmptyBoard();
      room.currentPlayer = 1;
      room.winner = null;
      room.gameOver = false;
      room.gameStarted = true;
    } else if (wasNotStarted) {
      room.gameStarted = true;
    }
    // Clear readiness for the next phase (next rematch, etc.)
    room.readyPlayerIds = [];

    return { room, started: wasNotStarted, restarted: wasGameOver };
  }

  // Drop a player's readiness (e.g. they want to cancel before opponent agrees).
  unmarkReady(roomId: string, playerId: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (!room.readyPlayerIds.includes(playerId)) return room;
    room.readyPlayerIds = room.readyPlayerIds.filter((id) => id !== playerId);
    room.lastActivity = new Date();
    return room;
  }

  // Find a room with a single waiting player (used by quick-match).
  findAvailableRoom(): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.length === 1 && !room.gameOver) {
        return room;
      }
    }
    return null;
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  updatePlayerConnection(roomId: string, playerId: string, connected: boolean): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      const connectionChanged = player.connected !== connected;
      player.connected = connected;

      if (connectionChanged) {
        player.lastSeen = new Date();
        room.lastActivity = new Date();
      }
    }

    return room;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null;
  }

  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  // Drop rooms idle for >30 minutes.
  cleanupInactiveRooms(): void {
    const now = new Date();
    const INACTIVE_THRESHOLD = 30 * 60 * 1000;

    for (const [roomId, room] of this.rooms.entries()) {
      if (now.getTime() - room.lastActivity.getTime() > INACTIVE_THRESHOLD) {
        this.removeRoom(roomId);
      }
    }
  }

  // Test-only: reset internal state.
  __resetForTests(): void {
    this.rooms.clear();
    this.playerConnections.clear();
  }
}

export { GameManager };

// Persist the singleton across Next.js dev's module reloads. Without this,
// each lazily-compiled API route gets a fresh GameManager and rooms vanish
// between routes (e.g. quick-match creates a room that events/route.ts
// cannot see). Production serverless instances still need a real store.
declare global {
  // eslint-disable-next-line no-var
  var __gameManager: GameManager | undefined;
}
export const gameManager: GameManager =
  globalThis.__gameManager ?? (globalThis.__gameManager = new GameManager());
