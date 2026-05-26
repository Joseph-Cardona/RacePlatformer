// Wire-level debug: intercept sendFullState and client setState
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

const PLAYER_COLORS = [
  0xff4444, 0x44ff44, 0x4444ff, 0xffff44,
  0xff44ff, 0x44ffff, 0xff8844, 0x88ff44,
];

class Player extends Schema {
  x; y; color;
  constructor(x, y, color) {
    super();
    this.x = x; this.y = y; this.color = color;
  }
}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  players = new MapSchema();
  constructor() {
    super();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

class DebugRoom {
  onCreate(options) {
    this.setState(new GameRoomState());
    this.maxClients = 12;

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
    });
  }

  onJoin(client, options) {
    const colorIndex = this.state.players.size % PLAYER_COLORS.length;
    const player = new Player(120, 300, PLAYER_COLORS[colorIndex]);
    this.state.players.set(client.sessionId, player);
    console.log(`🟢 ${client.sessionId} joined. (${this.state.players.size} players)`);

    // Log the state BEFORE encoding
    console.log("Server state before encode:");
    console.log("  players size:", this.state.players.size);
    this.state.players.forEach((p, id) => {
      console.log(`  player ${id}: x=${p.x} y=${p.y} color=${p.color}`);
    });

    // Log what encodeAll produces
    const encoded = this.state.encodeAll(false);
    console.log("  encodeAll(false) bytes:", encoded);
    console.log("  encodeAll(false) hex:", Buffer.from(encoded).toString("hex"));
    console.log("  encodeAll(false) length:", encoded.length);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`🔴 ${client.sessionId} left. (${this.state.players.size} players)`);
  }
}

const gameServer = new Server({ transport: new WebSocketTransport() });
gameServer.define("game", DebugRoom);
await gameServer.listen(2570);
console.log("Debug server on :2570\n");

const { Client } = await import("colyseus.js");

const room1 = await new Client("ws://localhost:2570").joinOrCreate("game");

// Log what client sees right after join
console.log("\n=== Client right after joinOrCreate ===");
console.log("state type:", room1.state?.constructor?.name);
console.log("state keys:", Object.keys(room1.state || {}));
console.log("players type:", room1.state?.players?.constructor?.name);
console.log("players size:", room1.state?.players?.size);
console.log("players $items size:", room1.state?.players?.['$items']?.size);

// Wrap setState on client to log
const origSetState = room1.setState.bind(room1);
room1.setState = function(bytes) {
  console.log("\n=== Client setState called ===");
  console.log("received bytes length:", bytes?.length);
  console.log("received bytes:", Array.from(bytes || []).slice(0, 30));
  console.log("received hex:", Buffer.from(Array.from(bytes || [])).toString("hex"));
  console.log("players BEFORE decode:", this.state?.players?.size);
  return origSetState(bytes);
};

room1.onStateChange((state) => {
  console.log("\n=== Client onStateChange ===");
  console.log("state type:", state?.constructor?.name);
  console.log("players size:", state?.players?.size);
  console.log("players $items size:", state?.players?.['$items']?.size);
  if (state?.players) {
    state.players.forEach((p, id) => {
      console.log(`  player ${id}: x=${p.x} y=${p.y} color=${p.color}`);
    });
  }
});

room1.state.players.onAdd((p, id) => {
  console.log(`\n=== Client onAdd: player ${id} ===`);
  console.log(`  x=${p.x} y=${p.y} color=${p.color}`);
});

await new Promise(r => setTimeout(r, 3000));

console.log("\n=== Final state ===");
console.log("players size:", room1.state?.players?.size);
room1.state?.players?.forEach((p, id) => {
  console.log(`  player ${id}: x=${p.x} y=${p.y}`);
});

room1.leave();
process.exit(0);
