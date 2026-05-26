// Test: verify the server-side schema encode produces data for players
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

class Player extends Schema {
  constructor(x, y, color) {
    super();
    this.x = x;
    this.y = y;
    this.color = color;
  }
}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

// Simulate what the server does
const state = new GameRoomState();
console.log("=== Initial state ===");
console.log("state._definition.schema:", Object.keys(state._definition?.schema || {}));
console.log("state.players is MapSchema:", state.players instanceof MapSchema);
console.log("players $changes.indexes:", state.players['$changes'].indexes);
console.log("players $changes.allChanges:", [...state.players['$changes'].allChanges]);
console.log("players $changes.changes:", [...state.players['$changes'].changes]);

// Add a player (like onJoin does)
const p = new Player(100, 200, 0xff4444);
state.players.set("session1", p);

console.log("\n=== After adding player ===");
console.log("players.$items.size:", state.players['$items'].size);
console.log("players.size:", state.players.size);
console.log("players $changes.indexes:", state.players['$changes'].indexes);
console.log("players $changes.allChanges:", [...state.players['$changes'].allChanges]);
console.log("players $changes.changes:", [...state.players['$changes'].changes.entries()].map(([k,v]) => `${k}: op=${v.op}, index=${v.index}`));
console.log("players $changes.ref:", state.players['$changes'].ref?.constructor?.name);

// Now encode all
console.log("\n=== Encoding (encodeAll) ===");
const encoded = state.encodeAll(false);
console.log("Encoded bytes (" + encoded.byteLength + "):", encoded);
console.log("Encoded hex:", Buffer.from(encoded).toString("hex"));

// Now decode
console.log("\n=== Decoding ===");
const state2 = new GameRoomState();
const changes = state2.decode(encoded);
console.log("Decoded changes:", changes?.length);
changes?.forEach(c => {
  console.log(`  change: op=${c.op}, field=${c.field}, dynamicIndex=${c.dynamicIndex}, value=`, c.value?.constructor?.name);
});
console.log("Decoded state players size:", state2.players?.size);
console.log("Decoded players $items size:", state2.players?.['$items']?.size);
state2.players?.forEach((v, k) => {
  console.log(`  Player ${k}: x=${v.x}, y=${v.y}, color=${v.color}`);
});

// Now test: make a fresh state, add a player, then encode with 'true' (encodeAll)
console.log("\n\n=== TEST 2: Direct encodeAll(true) ===");
const state3 = new GameRoomState();
const p2 = new Player(300, 400, 0x44ff44);
state3.players.set("session2", p2);

const encoded3 = state3.encodeAll(true);
console.log("Encoded bytes (" + encoded3.byteLength + "):", encoded3);
console.log("Encoded hex:", Buffer.from(encoded3).toString("hex"));

const state4 = new GameRoomState();
state4.decode(encoded3);
console.log("Decoded players size:", state4.players?.size);
state4.players?.forEach((v, k) => {
  console.log(`  Player ${k}: x=${v.x}, y=${v.y}, color=${v.color}`);
});

// TEST 3: what about encodeAll(false)?
console.log("\n\n=== TEST 3: encodeAll(false) ===");
const state5 = new GameRoomState();
const p3 = new Player(500, 600, 0x4444ff);
state5.players.set("session3", p3);

const encoded5 = state5.encodeAll(false);
console.log("Encoded bytes (" + encoded5.byteLength + "):", encoded5);
console.log("Encoded hex:", Buffer.from(encoded5).toString("hex"));

const state6 = new GameRoomState();
state6.decode(encoded5);
console.log("Decoded players size:", state6.players?.size);
state6.players?.forEach((v, k) => {
  console.log(`  Player ${k}: x=${v.x}, y=${v.y}, color=${v.color}`);
});
