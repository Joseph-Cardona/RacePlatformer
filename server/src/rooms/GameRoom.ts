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
  private waitingPlayers: string[] = [];
  private activePlayers: Set<string> = new Set();

  onCreate(_options: any) {
    this.setState(new GameRoomState());
    this.maxClients = 12;
    this.autoDispose = false;

    this.onMessage("move", (client, data: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
    });

    this.onMessage("start", (client) => {
      // Allow re-queueing: if was in a game, remove from active set
      this.activePlayers.delete(client.sessionId);
      // Don't queue if already waiting
      if (this.waitingPlayers.includes(client.sessionId)) return;

      this.waitingPlayers.push(client.sessionId);
      console.log(`🎯 Player ${client.sessionId} is waiting. (${this.waitingPlayers.length} waiting)`);

      // Notify the player they're waiting
      client.send("waiting", { count: this.waitingPlayers.length });

      // Check if we have a match
      if (this.waitingPlayers.length >= 2) {
        this.startMatch();
      }
    });

    this.onMessage("cancel_wait", (client) => {
      const idx = this.waitingPlayers.indexOf(client.sessionId);
      if (idx !== -1) {
        this.waitingPlayers.splice(idx, 1);
        console.log(`❌ Player ${client.sessionId} cancelled waiting. (${this.waitingPlayers.length} waiting)`);
      }
    });
  }

  private startMatch() {
    const p1 = this.waitingPlayers.shift()!;
    const p2 = this.waitingPlayers.shift()!;
    const levelIndex = Math.floor(Math.random() * LEVEL_COUNT);

    this.activePlayers.add(p1);
    this.activePlayers.add(p2);

    console.log(`🏁 Match started! ${p1} vs ${p2}, level ${levelIndex}`);

    // Send game_start to both players
    this.clients.forEach((client) => {
      if (client.sessionId === p1 || client.sessionId === p2) {
        client.send("game_start", { levelIndex });
      }
    });
  }

  onJoin(client: any, _options: any) {
    const colorIndex = this.state.players.size % PLAYER_COLORS.length;
    const player = new Player(120, 300, PLAYER_COLORS[colorIndex]);
    this.state.players.set(client.sessionId, player);
    console.log(`🟢 Player ${client.sessionId} joined. (${this.state.players.size} players)`);
  }

  onLeave(client: any) {
    // Clean up from waiting list
    const waitIdx = this.waitingPlayers.indexOf(client.sessionId);
    if (waitIdx !== -1) {
      this.waitingPlayers.splice(waitIdx, 1);
    }

    // Clean up from active game
    this.activePlayers.delete(client.sessionId);

    this.state.players.delete(client.sessionId);
    console.log(`🔴 Player ${client.sessionId} left. (${this.state.players.size} players)`);
  }
}
