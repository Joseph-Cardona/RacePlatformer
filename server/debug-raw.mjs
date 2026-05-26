import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

class Player extends Schema {}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

// Simulate what @colyseus/core's SchemaSerializer does
const useFilters = false;
const state = new GameRoomState();

// Add a player (like onJoin does)
const p = new Player();
p.x = 120;
p.y = 300;
p.color = 0xff4444;
state.players.set("session1", p);

console.log("Players in state:", state.players.size);
console.log("Has definition:", !!state.constructor._definition);

// GetFullState equivalent
console.log("\nCalling state.encodeAll(false)...");
const encoded = state.encodeAll(useFilters);
console.log("Encoded bytes length:", encoded.length);
console.log("Encoded:", JSON.stringify(encoded));

// Decode test
const clientState = new GameRoomState();
clientState.players.onAdd((p, id) => {
  console.log(`  onAdd fired! player: ${id} x=${p.x} y=${p.y}`);
});
clientState.decode(encoded);
console.log("Decoded players size:", clientState.players.size);
if (clientState.players.get("session1")) {
  console.log("Player session1 found at:", clientState.players.get("session1").x, clientState.players.get("session1").y);
} else {
  console.log("Player session1 NOT found after decode - THIS IS THE BUG!");
}

// Also test what happens when we encode with the changes system
console.log("\n=== Test with changes ===");
const state2 = new GameRoomState();
const p2 = new Player();
p2.x = 120;
p2.y = 300;
p2.color = 0xff4444;
state2.players.set("session1", p2);

// At this point, the changes should include the new player
console.log("Changes:", state2["$changes"].changes?.size || "N/A");
console.log("AllChanges:", state2["$changes"].allChanges?.length || "N/A");

// Encode with all=false (like applyPatches does)
const patchEncoded = state2.encode(false, [], false);
console.log("Patch encoded length:", patchEncoded.length);
console.log("Patch encoded:", JSON.stringify(patchEncoded));

process.exit(0);
