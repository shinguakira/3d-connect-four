import type { GameRoom, Player, GameMove } from "@/types/online"

class GameManager {
  private rooms = new Map<string, GameRoom>()
  private playerConnections = new Map<string, Set<string>>() // playerId -> roomIds

  createRoom(hostPlayer: Player): GameRoom {
    const roomId = this.generateRoomId()
    const room: GameRoom = {
      id: roomId,
      players: [hostPlayer],
      gameState: this.createEmptyBoard(),
      currentPlayer: 1,
      winner: null,
      gameOver: false,
      createdAt: new Date(),
      lastActivity: new Date(),
      settings: {
        player1Color: "#ef4444",
        player2Color: "#3b82f6",
        showVerticalGrid: true,
        showHorizontalGrid: false,
      },
    }

    this.rooms.set(roomId, room)
    return room
  }

  joinRoom(roomId: string, player: Player): GameRoom | null {
    const room = this.rooms.get(roomId)
    if (!room || room.players.length >= 2) {
      return null
    }

    room.players.push(player)
    room.lastActivity = new Date()
    return room
  }

  makeMove(roomId: string, playerId: string, move: GameMove): GameRoom | null {
    const room = this.rooms.get(roomId)
    if (!room || room.gameOver) return null

    const playerIndex = room.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1 || playerIndex + 1 !== room.currentPlayer) {
      return null // 不正な手番
    }

    // 重力で駒を落とす
    let y = -1
    for (let i = 0; i < 4; i++) {
      if (!room.gameState[move.x][i][move.z]) {
        y = i
        break
      }
    }

    if (y === -1) return null // 列が満杯

    room.gameState[move.x][y][move.z] = room.currentPlayer
    room.winner = this.checkWinner(room.gameState)
    room.gameOver = !!room.winner
    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1
    room.lastActivity = new Date()

    return room
  }

  // 利用可能なルーム（1人のプレイヤーがいるルーム）を検索
  findAvailableRoom(): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.length === 1 && !room.gameOver) {
        return room
      }
    }
    return null
  }

  // 全ルーム一覧を取得（デバッグ用）
  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values())
  }

  // プレイヤーの接続状態を更新
  updatePlayerConnection(roomId: string, playerId: string, connected: boolean): GameRoom | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    const player = room.players.find((p) => p.id === playerId)
    if (player) {
      player.connected = connected
      player.lastSeen = new Date()
      room.lastActivity = new Date()
    }

    return room
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  private createEmptyBoard() {
    return Array(4)
      .fill(null)
      .map(() =>
        Array(4)
          .fill(null)
          .map(() => Array(4).fill(null)),
      )
  }

  private checkWinner(board: any): any {
    // 勝利判定ロジック（既存のものを使用）
    return null
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null
  }

  removeRoom(roomId: string): void {
    this.rooms.delete(roomId)
  }

  // 非アクティブなルームをクリーンアップ
  cleanupInactiveRooms(): void {
    const now = new Date()
    const INACTIVE_THRESHOLD = 30 * 60 * 1000 // 30分

    for (const [roomId, room] of this.rooms.entries()) {
      if (now.getTime() - room.lastActivity.getTime() > INACTIVE_THRESHOLD) {
        this.removeRoom(roomId)
      }
    }
  }
}

export const gameManager = new GameManager()
