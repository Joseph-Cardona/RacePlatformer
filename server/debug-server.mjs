// Direct test: server-side schema encode/decode
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./src/rooms/GameRoom.ts";

const gameServer = new Server({ transport: new WebSocketTransport() });

gameServer.define("game", GameRoom);

await gameServer.listen(2569);
console.log("Test server on :2569");

const { Client } = await import("colyseus.js");

// Client 1
const room1 = await new Client("ws://localhost:2569").joinOrCreate("game");

console.log("\n=== C1 joined ===");
console.log("sessionId:", room1.sessionId);
console.log("state type:", room1.state?.constructor?.name);
console.log("state KEYS:", Object.keys(room1.state || {}));
console.log("players type:", room1.state?.players?.constructor?.name);
console.log("players size:", room1.state?.players?.size || 0);

// Dump all $items in players
if (room1.state?.players) {
  console.log("players $items keys:", [...room1.state.players.keys()]);
  room1.state.players.forEach((v, k) => {
    console.log(`  player ${k}: x=${v.x} y=${v.y} color=${v.color}`);
  });
  console.log("players $items map size:", room1.state.players['$items']?.size);
}

// Set up onStateChange to catch the initial sync
room1.onStateChange((state) => {
  console.log("\n=== C1 onStateChange ===");
  console.log("state type:", state?.constructor?.name);
  console.log("state KEYS:", Object.keys(state || {}));
  console.log("has players:", !!state?.players);
  if (state?.players) {
    console.log("players size:", state.players.size);
    console.log("players $items size:", state.players['$items']?.size);
    state.players.forEach((v, k) => {
      console.log(`  player ${k}: x=${v.x} y=${v.y} color=${v.color}`);
    });
  }
});

// Set up onAdd
room1.state.players.onAdd((mp, id) => {
  console.log(`\n=== C1 onAdd: player ${id} ===`);
  console.log(`  x=${mp.x} y=${mp.y} color=${mp.color}`);
});

// Wait for a bit to receive any pending messages
await new Promise(r => setTimeout(r, 2000));

console.log("\n=== After 2s delay ===");
console.log("C1 players size:", room1.state?.players?.size);
console.log("C1 players $items size:", room1.state?.players?.['$items']?.size);
if (room1.state?.players) {
  room1.state.players.forEach((v, k) => {
    console.log(`  player ${k}: x=${v.x} y=${v.y}`);
  });
}

room1.leave();
process.exit(0);
