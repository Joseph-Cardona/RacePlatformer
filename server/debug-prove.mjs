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

const state = new GameRoomState();

// Add players
const p1 = new Player();
p1.x = 120; p1.y = 300; p1.color = 0xff4444;
state.players.set("s1", p1);

const p2 = new Player();
p2.x = 400; p2.y = 200; p2.color = 0x44ff44;
state.players.set("s2", p2);

console.log("=== Initial state ===");
console.log("players.size:", state.players.size);
console.log("players.$items size:", state.players["$items"]?.size);
console.log("indexes:", {...state.players["$changes"]?.indexes});
console.log("allChanges:", state.players["$changes"]?.allChanges ? [...state.players["$changes"].allChanges] : "N/A");

// Encode (like broadcastPatch does with encode=false)
console.log("\n=== First encode(false) - like broadcastPatch ===");
const firstEnc = state.encode(false, [], false);
console.log("Encoded bytes:", firstEnc.length);

// Now discardAllChanges (like applyPatches does)
console.log("\n=== After discardAllChanges ===");
state["$changes"]?.discardAll();
console.log("players.size:", state.players.size);
console.log("players.$items size:", state.players["$items"]?.size);
console.log("indexes:", {...state.players["$changes"]?.indexes});
console.log("allChanges:", state.players["$changes"]?.allChanges ? [...state.players["$changes"].allChanges] : "N/A");

// Now encodeAll (like sendFullState does)
console.log("\n=== encodeAll after discard - like sendFullState ===");
const fullEnc = state.encodeAll(false);
console.log("Encoded bytes:", fullEnc.length);
console.log("Encoded bytes content:", [...fullEnc].slice(0, 20));

// Try decoding
const clientState = new GameRoomState();
clientState.players.onAdd((p, id) => console.log(`  onAdd: ${id}`));
clientState.decode(fullEnc);
console.log("After decode - players.size:", clientState.players.size);

// What if we add a NEW player after discard?
console.log("\n=== Add new player after discard ===");
const p3 = new Player();
p3.x = 600; p3.y = 100; p3.color = 0xffff44;
state.players.set("s3", p3);
console.log("After adding s3 - players.size:", state.players.size);
console.log("allChanges:", state.players["$changes"]?.allChanges ? [...state.players["$changes"].allChanges] : "N/A");
console.log("indexes:", {...state.players["$changes"]?.indexes});

const fullEnc2 = state.encodeAll(false);
console.log("encodeAll after adding s3 - bytes:", fullEnc2.length);
const clientState2 = new GameRoomState();
clientState2.players.onAdd((p, id) => console.log(`  onAdd2: ${id}`));
clientState2.decode(fullEnc2);
console.log("After decode2 - players.size:", clientState2.players.size);
clientState2.players.forEach((p, id) => console.log(`  ${id}: (${p.x},${p.y})`));

process.exit(0);
