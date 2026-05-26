import { Schema, MapSchema, defineTypes, hasFilter } from "@colyseus/schema";

// Exact replica of server GameRoom.ts
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
  players = new MapSchema();
}
defineTypes(GameRoomState, { players: { map: Player } });

// Simulate server's setState flow
class FakeSerializer {
  reset(newState) {
    this.state = newState;
    this.useFilters = hasFilter(newState.constructor);
  }
  getFullState() {
    const fullEncoded = this.state.encodeAll(this.useFilters);
    return fullEncoded;
  }
}

const serializer = new FakeSerializer();

// Step 1: create state (like setState)
const state = new GameRoomState();
console.log("=== After new GameRoomState() ===");
console.log("state.players:", state.players?.constructor?.name);
console.log("state.players.size:", state.players?.size);
console.log("state has _definition:", "_definition" in state);
console.log("state.constructor._definition:", !!state.constructor._definition);
console.log("state.constructor._definition.schema keys:", state.constructor._definition?.schema ? Object.keys(state.constructor._definition.schema).join(", ") : "N/A");
console.log("hasFilter:", hasFilter(state.constructor));

serializer.reset(state);

// Step 2: add player (like onJoin)
const colorIndex = 0;
const PLAYER_COLORS = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];
const player = new Player(120, 300, PLAYER_COLORS[colorIndex]);
console.log("\n=== Player created ===");
console.log("player:", player.x, player.y, player.color);
console.log("player._definition:", !!player.constructor._definition);
console.log("player.$changes:", !!player.$changes);

state.players.set("s1", player);
console.log("\n=== After state.players.set() ===");
console.log("state.players.size:", state.players.size);
console.log("state.players has s1:", state.players.has("s1"));
console.log("state.players.$items size:", state.players.$items?.size ?? "N/A");
console.log("state.players.$changes.allChanges:", state.players.$changes?.allChanges ? Array.from(state.players.$changes.allChanges) : "N/A");
console.log("state.players.$changes.indexes:", state.players.$changes?.indexes ? {...state.players.$changes.indexes} : "N/A");

// Step 3: check state's own change tracking
console.log("\n=== State change tracking ===");
console.log("state.$changes.allChanges:", state.$changes?.allChanges ? Array.from(state.$changes.allChanges) : "N/A");
console.log("state.$changes.changes.size:", state.$changes?.changes?.size ?? "N/A");

// Step 4: encodeAll
const encodedFalse = state.encodeAll(false);
console.log("\n=== encodeAll(false) ===");
console.log("bytes:", encodedFalse.length);
console.log("content:", encodedFalse.length > 0 ? [...encodedFalse].slice(0, 20) : "EMPTY");

const encodedTrue = state.encodeAll(true);
console.log("\n=== encodeAll(true) ===");
console.log("bytes:", encodedTrue.length);
console.log("content:", encodedTrue.length > 0 ? [...encodedTrue].slice(0, 20) : "EMPTY");

// Step 5: Try decode (simulate client)
class ClientGameRoomState extends Schema {
  players = new MapSchema();
}
defineTypes(ClientGameRoomState, { players: { map: Player } });

const clientState = new ClientGameRoomState();
clientState.players.onAdd((p, id) => console.log(`  onAdd: ${id}`));
const decoded = clientState.decode(encodedFalse.length > 0 ? encodedFalse : encodedTrue);
console.log("\n=== Client decode result ===");
console.log("client players.size:", clientState.players?.size ?? "N/A");
clientState.players?.forEach((p, id) => console.log(`  ${id}: (${p.x},${p.y})`));

// Step 6: Test with Object.getOwnPropertyDescriptor
console.log("\n=== Property descriptors ===");
const protoDesc = Object.getOwnPropertyDescriptor(GameRoomState.prototype, "players");
console.log("prototype desc:", !!protoDesc, protoDesc ? (protoDesc.get ? "getter" : "value") : "none");
const stateDesc = Object.getOwnPropertyDescriptor(state, "players");
console.log("instance desc:", !!stateDesc, stateDesc ? (stateDesc.get ? "getter" : "value") : "none");
console.log("state has own players:", state.hasOwnProperty("players"));

process.exit(0);
