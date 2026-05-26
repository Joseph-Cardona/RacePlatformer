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

// Test: create state, add a player, encode, decode
const state = new GameRoomState();
console.log("State definition fields:", Object.keys(GameRoomState._definition?.schema || {}));
console.log("State _typeid:", GameRoomState._typeid);

const player = new Player(100, 200, 0xff4444);
state.players.set("p1", player);

console.log("State players size:", state.players.size);
console.log("State $changes.changes:", state.$changes.changes.size);
console.log("State $changes.allChanges:", state.$changes.allChanges.size);
console.log("MapSchema $changes.changes:", state.players.$changes.changes.size);
console.log("MapSchema $changes.allChanges:", state.players.$changes.allChanges.size);

// Encode full state
const encoded = state.encodeAll(false);
console.log("Encoded bytes length:", encoded.byteLength);
console.log("Encoded bytes:", Array.from(encoded));

// Decode
const state2 = new GameRoomState();
state2.decode(encoded);
console.log("Decoded state players size:", state2.players?.size);
state2.players?.forEach((v, k) => {
  console.log("  Player:", k, "x:", v.x, "y:", v.y, "color:", v.color);
});
console.log("Decoded Player type:", state2.players?.get("p1")?.constructor?.name);

// Test with Reflection
import { Reflection } from "@colyseus/schema";

const reflectionEncoded = Reflection.encode(state);
console.log("\nReflection encoded bytes length:", reflectionEncoded.byteLength);

const decodedState = Reflection.decode(reflectionEncoded);
console.log("Reflection-decoded state type:", decodedState?.constructor?.name);
console.log("Reflection decoded fields:", Object.keys(decodedState?.constructor?._definition?.schema || {}));
if (decodedState?.players) {
  console.log("Reflection decoded players type:", decodedState.players.constructor?.name);
  console.log("Reflection decoded players size (should be 0, no data yet):", decodedState.players.size);
}
