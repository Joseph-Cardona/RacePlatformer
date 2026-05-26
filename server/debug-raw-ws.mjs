import WebSocket from "ws";
import { Schema, MapSchema, defineTypes, decode } from "@colyseus/schema";

// Define the schema classes (same as server)
class Player extends Schema {}
defineTypes(Player, { x: "number", y: "number", color: "number" });

class GameRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });

// Connect directly via WebSocket (bypass colyseus.js)
const ws = new WebSocket("ws://localhost:2567");

ws.on("open", () => {
  console.log("WebSocket connected");
  
  // Send HTTP-like matchmaking request
  const matchmakeReq = JSON.stringify([]);
  ws.send(new TextEncoder().encode(JSON.stringify({})));
  
  // Wait for response
  setTimeout(() => {
    console.log("Sending matchmake request via HTTP...");
    // Actually let's use fetch
    fetchMatchmake();
  }, 500);
});

async function fetchMatchmake() {
  try {
    // Step 1: Get room via HTTP
    const res = await fetch("http://localhost:2567/matchmake/joinOrCreate/game", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({})
    });
    const data = await res.json();
    console.log("Matchmake response:", JSON.stringify(data, null, 2));
    
    // Step 2: Connect WebSocket to room
    const roomId = data.room.roomId;
    const sessionId = data.sessionId;
    const endpoint = `ws://localhost:2567/${data.room.processId}/${roomId}?sessionId=${sessionId}`;
    console.log("Connecting to:", endpoint);
    
    const ws2 = new WebSocket(endpoint);
    let allMessages = [];
    
    ws2.on("message", (raw) => {
      const bytes = new Uint8Array(raw);
      console.log(`\nReceived ${bytes.length} bytes: [${Array.from(bytes.slice(0, 30))}${bytes.length > 30 ? '...' : ''}]`);
      console.log(`First byte (code): ${bytes[0]}`);
      
      allMessages.push(bytes);
      
      if (bytes[0] === 14) {
        // ROOM_STATE
        console.log("=== ROOM_STATE received ===");
        const stateBytes = bytes.slice(1); // remove code byte
        console.log(`State bytes length: ${stateBytes.length}`);
        console.log(`State bytes: [${Array.from(stateBytes)}]`);
        
        // Try decoding
        try {
          const clientState = new GameRoomState();
          clientState.players.onAdd((p, id) => {
            console.log(`  📢 onAdd fired! Player ${id} at (${p.x},${p.y})`);
          });
          clientState.decode(Array.from(stateBytes));
          console.log(`After decode - players.size: ${clientState.players.size}`);
          clientState.players.forEach((p, id) => {
            console.log(`  Player ${id}: x=${p.x} y=${p.y} color=${p.color}`);
          });
        } catch (e) {
          console.error("Decode error:", e.message);
        }
      }
      
      if (bytes[0] === 2) {
        // JOIN_ROOM handshake
        console.log("=== Handshake received ===");
      }
    });
    
    ws2.on("open", () => {
      console.log("\nRoom WebSocket connected");
    });
    
    setTimeout(() => {
      console.log("\n\nAll messages received:");
      allMessages.forEach((msg, i) => {
        console.log(`Message ${i}: ${msg.length} bytes, code=${msg[0]}`);
      });
      process.exit(0);
    }, 2000);
    
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

setTimeout(() => {
  console.log("Timeout - exiting");
  process.exit(1);
}, 5000);
