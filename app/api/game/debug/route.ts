import { NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";

export async function GET() {
  try {
    const allRooms = gameManager.getAllRooms();
    const now = new Date();
    
    const roomsInfo = allRooms.map(room => ({
      id: room.id,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        lastSeen: p.lastSeen
      })),
      gameStarted: room.gameStarted,
      gameOver: room.gameOver,
      winner: room.winner,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      minutesSinceLastActivity: Math.floor((now.getTime() - room.lastActivity.getTime()) / (1000 * 60))
    }));

    return NextResponse.json({
      success: true,
      totalRooms: allRooms.length,
      rooms: roomsInfo,
      serverTime: now.toISOString()
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get room debug info" },
      { status: 500 }
    );
  }
}
