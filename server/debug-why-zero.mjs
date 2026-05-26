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

// Test 1: Fresh state, add player
console.log("=== Test 1: Fresh state ===");
const state1 = new GameRoomState();
console.log("Initial players.size:", state1.players.size);
const p1 = new Player(120, 300, 0xff4444);
state1.players.set("s1", p1);
console.log("After set players.size:", state1.players.size);
const enc1 = state1.encodeAll(false);
console.log("encodeAll bytes:", enc1.length);
console.log("After encode players.size:", state1.players.size);

// Test 2: Using setState pattern (like server does)
console.log("\n=== Test 2: setState pattern ===");
const state2 = new GameRoomState();
state2.players = new MapSchema();
console.log("After reassign players.size:", state2.players.size);
const p2 = new Player(120, 300, 0xff4444);
state2.players.set("s2", p2);
console.log("After set players.size:", state2.players.size);

// Test 3: Check if PropertyDescriptor on players field breaks things
console.log("\n=== Test 3: Players setter/getter ===");
const desc = Object.getOwnPropertyDescriptor(GameRoomState.prototype, "players");
console.log("Has descriptor:", !!desc);
console.log("Has getter:", !!desc?.get);
console.log("Has setter:", !!desc?.set);
console.log("Has value:", desc?.value);

// Test 4: Check the full definition
console.log("\n=== Test 4: Definitions ===");
console.log("GameRoomState._definition:", !!GameRoomState._definition);
console.log("fields:", GameRoomState._definition?.schema ? Object.keys(GameRoomState._definition.schema) : "N/A");
console.log("fieldsByIndex:", GameRoomState._definition?.fieldsByIndex || "N/A");

// Test 5: Check $changes after set
console.log("\n=== Test 5: Changes tracking ===");
const state5 = new GameRoomState();
console.log("Initial $changes.allChanges:", state5["$changes"]?.allChanges ? Array.from(state5["$changes"].allChanges) : "N/A");
console.log("Initial $changes.changes.size:", state5["$changes"]?.changes?.size ?? "N/A");

const p5 = new Player(120, 300, 0xff4444);
state5.players.set("s5", p5);

console.log("After set $changes.allChanges:", state5["$changes"]?.allChanges ? Array.from(state5["$changes"].allChanges) : "N/A");
console.log("After set $changes.changes.size:", state5["$changes"]?.changes?.size ?? "N/A");

// Deep inspect
console.log("\nState keys:", Object.keys(state5));
console.log("$changes keys:", state5["$changes"] ? Object.keys(state5["$changes"]) : "N/A");
if (state5["$changes"]) {
  console.log("$changes.ref:", state5["$changes"].ref?.constructor?.name);
  console.log("$changes.root:", state5["$changes"].root?.constructor?.name);
  
  // Try encodeAll with all=true (not false)
  const enc5a = state5.encodeAll(true);
  console.log("encodeAll(true) bytes:", enc5a.length);
  const enc5f = state5.encodeAll(false);
  console.log("encodeAll(false) bytes:", enc5f.length);
  
  // Direct encode
  const enc5d = state5.encode(true, [], false);
  console.log("encode(true,[],false) bytes:", enc5d.length);
  const enc5f2 = state5.encode(false, [], false);
  console.log("encode(false,[],false) bytes:", enc5f2.length);
}

// Test 6: Define without initializer
console.log("\n=== Test 6: Without initializer in constructor ===");
class GameRoomState2 extends Schema {
  constructor() {
    super();
    // DON'T initialize players in constructor
  }
}
defineTypes(GameRoomState2, { players: { map: Player } });

const state6 = new GameRoomState2();
console.log("Without init - players:", state6.players?.constructor?.name ?? "N/A");
console.log("Without init - has players:", !!state6.players);

process.exit(0);
