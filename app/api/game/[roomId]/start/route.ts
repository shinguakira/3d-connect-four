import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/game-manager";
import { broadcastToRoom } from "../events/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    console.log("Game start request received for room:", roomId);
    
    const body = await request.json();
    const { playerId } = body;
    console.log("Player ID:", playerId);

    // Get the room
    let room = gameManager.getRoom(roomId);
    if (!room) {
      console.log("Room not found:", roomId);
      
      // Debug: List all available rooms
      const allRooms = gameManager.getAllRooms();
      console.log("Available rooms:", allRooms.map(r => ({
        id: r.id,
        players: r.players.length,
        lastActivity: r.lastActivity,
        gameStarted: r.gameStarted
      })));
      
      // Clean up inactive rooms and check again
      gameManager.cleanupInactiveRooms();
      const roomAfterCleanup = gameManager.getRoom(roomId);
      
      if (!roomAfterCleanup) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Room not found or has been cleaned up due to inactivity",
            availableRooms: allRooms.length,
            debug: {
              requestedRoom: roomId,
              timestamp: new Date().toISOString()
            }
          },
          { status: 404 }
        );
      }
      
      // Room was found after cleanup, use it
      room = roomAfterCleanup;
    }

    // Check if player is in the room
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      console.log("Player not found in room:", playerId);
      return NextResponse.json(
        { success: false, error: "Player not found in room" },
        { status: 404 }
      );
    }

    // Check if we have enough players
    if (room.players.length !== 2) {
      console.log("Not enough players:", room.players.length);
      return NextResponse.json(
        { success: false, error: "Need exactly 2 players to start" },
        { status: 400 }
      );
    }

    // Mark the game as started in the room state
    room.gameStarted = true;
    room.lastActivity = new Date();
    console.log("Game marked as started for room:", roomId);

    // Broadcast to all clients that the game has started
    console.log("Broadcasting game-started event to room:", roomId);
    
    // Make 3 broadcast attempts to ensure all clients receive it
    // First immediate broadcast
    broadcastToRoom(roomId, {
      type: "game-started",
      room,
      message: "Game has started!",
      timestamp: new Date().toISOString(),
    });
    
    // Second broadcast after short delay (200ms)
    setTimeout(() => {
      broadcastToRoom(roomId, {
        type: "game-started",
        room,
        message: "Game has started!",
        timestamp: new Date().toISOString(),
        retryNumber: 1
      });
    }, 200);
    
    // Third broadcast after longer delay (500ms)
    setTimeout(() => {
      broadcastToRoom(roomId, {
        type: "game-started",
        room,
        message: "Game has started!",
        timestamp: new Date().toISOString(),
        retryNumber: 2
      });
    }, 500);

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Error in start game route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
