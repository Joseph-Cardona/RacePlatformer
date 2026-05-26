import { Room } from "@colyseus/core";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

const PLAYER_COLORS = [
  0xff4444, 0x44ff44, 0x4444ff, 0xffff44,
  0xff44ff, 0x44ffff, 0xff8844, 0x88ff44,
];

const LEVEL_COUNT = 3;

class Player extends Schema {
  declare x: number;
  declare y: number;
  declare color: number;

  constructor(x: number, y: number, color: number) {
    super();
    this.x = x;
    this.y = y;
    this.color = color;
  }
}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  players: MapSchema<Player>;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

export class GameRoom extends Room<GameRoomState> {
  private readyPlayers: Set<string> = new Set();
  private activeMatches: Map<string, string> = new Map(); // sessionId -> opponent sessionId

  onCreate(_options: any) {
    this.setState(new GameRoomState());
    this.maxClients = 2;

    this.onMessage("move", (client, data: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
    });

    this.onMessage("start", (client) => {
      // Don't re-queue if already ready
      if (this.readyPlayers.has(client.sessionId)) return;

      this.readyPlayers.add(client.sessionId);
      console.log(`🎯 Player ${client.sessionId} is ready. (${this.readyPlayers.size}/2 ready)`);

      // Check if both players are ready
      if (this.readyPlayers.size >= 2) {
        this.startMatch();
      }
    });

    this.onMessage("cancel_wait", (client) => {
      this.readyPlayers.delete(client.sessionId);
      console.log(`❌ Player ${client.sessionId} no longer ready. (${this.readyPlayers.size}/2 ready)`);
    });

    this.onMessage("win", (client) => {
      const opponentId = this.activeMatches.get(client.sessionId);
      if (!opponentId) {
        console.log(`⚠️ Win from ${client.sessionId} but no opponent found in activeMatches`);
        return;
      }

      const winner = this.state.players.get(client.sessionId);
      if (!winner) return;

      console.log(`🏆 ${client.sessionId} won! Opponent: ${opponentId}`);

      // Broadcast to both players in the match
      this.clients.forEach((c) => {
        if (c.sessionId === client.sessionId || c.sessionId === opponentId) {
          c.send("player_won", {
            winnerId: client.sessionId,
            winnerColor: winner.color,
          });
        }
      });

      // Clean up the match pairing
      this.activeMatches.delete(client.sessionId);
      this.activeMatches.delete(opponentId);
    });
  }

  private startMatch() {
    const levelIndex = Math.floor(Math.random() * LEVEL_COUNT);
    this.readyPlayers.clear();

    // Pair up the two players in the room
    const sessionIds = Array.from(this.state.players.keys());
    if (sessionIds.length >= 2) {
      const p1 = sessionIds[0];
      const p2 = sessionIds[1];
      this.activeMatches.set(p1, p2);
      this.activeMatches.set(p2, p1);
      console.log(`🏁 Match started! ${p1} vs ${p2}, level ${levelIndex}`);
    }

    // Send game_start to all players in the room
    this.clients.forEach((client) => {
      client.send("game_start", { levelIndex });
    });
  }

  onJoin(client: any, _options: any) {
    const colorIndex = this.state.players.size % PLAYER_COLORS.length;
    const player = new Player(120, 300, PLAYER_COLORS[colorIndex]);
    this.state.players.set(client.sessionId, player);

    // Notify the waiting player that an opponent has joined
    this.clients.forEach((c) => {
      if (c.sessionId !== client.sessionId) {
        c.send("opponent_joined");
      }
    });

    console.log(`🟢 Player ${client.sessionId} joined. (${this.state.players.size}/2 players)`);

    // Auto-start the game when the room is full and someone is ready
    if (this.state.players.size >= 2 && this.readyPlayers.size > 0) {
      this.startMatch();
    }
  }

  onLeave(client: any) {
    // Clean up ready state
    this.readyPlayers.delete(client.sessionId);

    // Clean up active match
    const opponentId = this.activeMatches.get(client.sessionId);
    if (opponentId) {
      this.activeMatches.delete(opponentId);
    }
    this.activeMatches.delete(client.sessionId);

    this.state.players.delete(client.sessionId);
    console.log(`🔴 Player ${client.sessionId} left. (${this.state.players.size}/2 players)`);
  }
}
