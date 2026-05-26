import { Schema, MapSchema, defineTypes, encode, decode } from "@colyseus/schema";

// Replicate server schema - plain JS for Node
class Player extends Schema {}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

// Step 1: Simulate server state
const serverState = new GameRoomState();
const p1 = new Player();
p1.x = 120;
p1.y = 300;
p1.color = 0xff4444;
serverState.players.set("session1", p1);

console.log("Server state - players.size:", serverState.players.size);

// Step 2: Encode with encodeAll (like getFullState does)
const encoded = serverState.encodeAll(false);  // useFilters=false
console.log("\nEncoded bytes length:", encoded.length);

// Step 3: Simulate client receiving and decoding
const clientState = new GameRoomState();

console.log("Client state before decode - players.size:", clientState.players.size);

// Register onAdd BEFORE decode
clientState.players.onAdd((p, id) => {
  console.log(`  onAdd fired! player: ${id} x=${p.x} y=${p.y} color=${p.color}`);
});

clientState.players.onChange((p, id) => {
  console.log(`  onChange fired! player: ${id} pos=(${p.x},${p.y})`);
});

// Step 4: Decode
console.log("\nDecoding...");
try {
  clientState.decode(encoded);
} catch (e) {
  console.error("Decode error:", e.message);
}

console.log("\nClient state after decode - players.size:", clientState.players.size);
if (clientState.players.get("session1")) {
  const p = clientState.players.get("session1");
  console.log("  Player found: x:", p.x, "y:", p.y, "color:", p.color);
} else {
  console.log("  Player NOT found!");
}

// Step 5: Also test encodeAll(true) 
console.log("\n\n=== Test with encodeAll(true) ===");
const encodedFull = serverState.encodeAll(true);
console.log("Encoded full bytes length:", encodedFull.length);

const clientState2 = new GameRoomState();
clientState2.players.onAdd((p, id) => {
  console.log(`  onAdd fired! player: ${id} x=${p.x} y=${p.y}`);
});
console.log("Decoding encodeAll(true)...");
clientState2.decode(encodedFull);
console.log("Client state2 after decode - players.size:", clientState2.players.size);

// Step 6: Test with the message format the server sends  
console.log("\n\n=== Test with full message format ===");
const msgBytes = [...encoded];
console.log("Bytes after stripping code byte:", msgBytes.length);

const clientState3 = new GameRoomState();
clientState3.players.onAdd((p, id) => {
  console.log(`  onAdd fired! player: ${id} x=${p.x} y=${p.y}`);
});
clientState3.decode(msgBytes);
console.log("Client state3 after decode - players.size:", clientState3.players.size);

process.exit(0);
