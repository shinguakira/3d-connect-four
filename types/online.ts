import type { GameBoard } from "./GameBoard"; // Assuming GameBoard is declared in another file

export interface GameRoom {
  id: string;
  players: Player[];
  gameState: GameBoard;
  currentPlayer: 1 | 2;
  winner: Player | null;
  gameOver: boolean;
  createdAt: Date;
  lastActivity: Date;
  gameStarted: boolean;
  settings: {
    player1Color: string;
    player2Color: string;
    showVerticalGrid: boolean;
    showHorizontalGrid: boolean;
  };
}

export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  connected: boolean;
  lastSeen: Date;
}

export interface GameMove {
  playerId: string;
  x: number;
  z: number;
  timestamp: Date;
}

export interface GameEvent {
  type:
    | "player-joined"
    | "player-left"
    | "move-made"
    | "game-reset"
    | "settings-changed";
  data: any;
  timestamp: Date;
}
