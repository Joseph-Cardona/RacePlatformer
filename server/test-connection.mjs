// Debug test for Colyseus server-client state sync
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "@colyseus/core";
import { GameRoom } from "./src/rooms/GameRoom.ts";

// Define client-side schema classes (match server)
class ClientPlayer extends Schema {}
defineTypes(ClientPlayer, { x: "number", y: "number", color: "number" });

class ClientGameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(ClientGameRoomState, { players: { map: ClientPlayer } });

const PORT = 2568;

const gameServer = new Server({ transport: new WebSocketTransport() });
gameServer.define("game", GameRoom);
await gameServer.listen(PORT);
console.log(`Test server on :${PORT}`);

const { Client } = await import("colyseus.js");

// Client 1 - WITHOUT schema class (default Reflection approach)
console.log("\n=== C1 joining (WITHOUT schema class) ===");
const room1 = await new Client(`ws://localhost:${PORT}`).joinOrCreate("game");
console.log("sessionId:", room1.sessionId);
console.log("has state:", !!room1.state);
console.log("players size:", room1.state?.players?.size ?? "N/A");
console.log("players constructor:", room1.state?.players?.constructor?.name ?? "N/A");

room1.state.players.onAdd((p, id) => {
  console.log(`  C1 onAdd: player ${id} (self=${id === room1.sessionId})`);
});
room1.onStateChange((state) => {
  console.log(`  C1 onStateChange: players.size = ${state.players?.size}`);
  if (state.players) {
    state.players.forEach((p, id) => console.log(`    player ${id}: (${p.x},${p.y})`));
  }
});

await new Promise(r => setTimeout(r, 300));

// Client 2 - WITH schema class
console.log("\n=== C2 joining (WITH schema class) ===");
const room2 = await new Client(`ws://localhost:${PORT}`).joinOrCreate("game", {}, ClientGameRoomState);
console.log("sessionId:", room2.sessionId);
console.log("has state:", !!room2.state);
console.log("state type:", room2.state?.constructor?.name ?? "N/A");
console.log("players size:", room2.state?.players?.size ?? "N/A");
console.log("players constructor:", room2.state?.players?.constructor?.name ?? "N/A");

room2.state.players.onAdd((p, id) => {
  console.log(`  C2 onAdd: player ${id} (self=${id === room2.sessionId}) x=${p.x} y=${p.y}`);
});

room2.onStateChange((state) => {
  console.log(`  C2 onStateChange: players.size = ${state.players?.size}`);
  if (state.players) {
    state.players.forEach((p, id) => console.log(`    player ${id}: (${p.x},${p.y})`));
  }
});

// Wait for state to sync
console.log("\n=== Waiting 1.5s for state sync ===");
await new Promise(r => setTimeout(r, 1500));

console.log("\n=== FINAL STATE ===");
console.log("Room1 players:", room1.state?.players?.size);
room1.state?.players?.forEach((p, id) => console.log(`  C1 player ${id}: (${p.x},${p.y})`));
console.log("Room2 players:", room2.state?.players?.size);
room2.state?.players?.forEach((p, id) => console.log(`  C2 player ${id}: (${p.x},${p.y})`));

// Send a move from C1
console.log("\n=== Sending move from C1 ===");
room1.send("move", { x: 500, y: 200 });
await new Promise(r => setTimeout(r, 1000));

console.log("After move - C2 players:", room2.state?.players?.size);
room2.state?.players?.forEach((p, id) => console.log(`  C2 player ${id}: (${p.x},${p.y})`));

room1.leave();
room2.leave();
process.exit(0);
