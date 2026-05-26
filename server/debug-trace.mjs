// Direct trace of what the server actually sends vs what we expect
import { Schema, MapSchema, defineTypes, Reflection } from "@colyseus/schema";

// Server-side schema
class Player extends Schema {}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

// Simulate the server flow
const state = new GameRoomState();

// Add 2 players (like the server would after both join)
const p1 = new Player();
p1.x = 120; p1.y = 300; p1.color = 0xff4444;
state.players.set("sessionA", p1);

const p2 = new Player();
p2.x = 400; p2.y = 200; p2.color = 0x44ff44;
state.players.set("sessionB", p2);

console.log("=== SERVER STATE ===");
console.log("players.size:", state.players.size);

// 1. Handshake - what the server sends first
console.log("\n=== HANDSHAKE (Reflection.encode) ===");
const handshakeBytes = Reflection.encode(state);
console.log("Handshake bytes length:", handshakeBytes.length);
console.log("Handshake bytes:", [...handshakeBytes].slice(0, 30), "...");

// 2. Full state - what getFullState returns  
console.log("\n=== FULL STATE (encodeAll) ===");
const stateBytes = state.encodeAll(false);
console.log("State bytes length:", stateBytes.length);
console.log("State bytes:", [...stateBytes]);

// Decode the state directly (standalone - works)
const clientState = new GameRoomState();
clientState.players.onAdd((p, id) => console.log(`  onAdd: ${id} at (${p.x},${p.y})`));
clientState.decode(stateBytes);
console.log("Standalone decode - players.size:", clientState.players.size);

// 3. Simulate what the client does after Reflection handshake + state decode
console.log("\n=== SIMULATED CLIENT FLOW ===");
// Client receives handshake, creates reflected state
const reflectedState = Reflection.decode(handshakeBytes, { offset: 0 });
console.log("Reflected state type:", reflectedState.constructor.name);
console.log("Reflected state has players:", !!reflectedState.players);
console.log("Reflected players type:", reflectedState.players?.constructor?.name ?? "N/A");

// Decode state data into reflected state
reflectedState.players.onAdd((p, id) => console.log(`  reflected onAdd: ${id} at (${p.x},${p.y})`));
try {
  reflectedState.decode(stateBytes);
  console.log("Reflected state after decode - players.size:", reflectedState.players.size);
  reflectedState.players.forEach((p, id) => console.log(`  Player ${id}: (${p.x},${p.y})`));
} catch (e) {
  console.error("Reflected decode error:", e.message);
}

// 4. Wrap stateBytes in the ROOM_STATE message format (like server does)
console.log("\n=== CLIENT ROOM_STATE RECEPTION ===");
const roomStateMsg = [14, ...stateBytes]; // code 14 = ROOM_STATE
const receivedBytes = roomStateMsg.slice(1); // client strips code byte
console.log("Received bytes after strip:", receivedBytes.length, "bytes");

const clientState2 = new GameRoomState();
clientState2.players.onAdd((p, id) => console.log(`  client2 onAdd: ${id} at (${p.x},${p.y})`));
clientState2.decode(receivedBytes);
console.log("Client2 after decode - players.size:", clientState2.players.size);

// 5. KEY TEST: What does encodeAll actually return for a state with players?
console.log("\n=== KEY: encodeAll with players added via onJoin flow ===");
const testState = new GameRoomState();
// Simulate adding players the same way the server does in onJoin
const pa = new Player(120, 300, 0xff4444);
pa.x = 120; pa.y = 300; pa.color = 0xff4444;
testState.players.set("user1", pa);
const pb = new Player(400, 200, 0x44ff44);
pb.x = 400; pb.y = 200; pb.color = 0x44ff44;
testState.players.set("user2", pb);

console.log("After adding players - testState.players.size:", testState.players.size);

const encoded = testState.encodeAll(false);
console.log("encoded bytes:", [...encoded]);
console.log("encoded length:", encoded.length);

// Decode it
const check = new GameRoomState();
check.players.onAdd((p, id) => console.log(`  check onAdd: ${id} at (${p.x},${p.y})`));
check.decode(encoded);
console.log("Check state size:", check.players.size);
check.players.forEach((p, id) => console.log(`  ${id}: (${p.x},${p.y})`));

process.exit(0);
