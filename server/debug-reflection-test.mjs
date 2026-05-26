// Debug script: Test colyseus.js client with reflection mode
import { Client } from 'colyseus.js';

async function main() {
  console.log("Connecting to ws://localhost:2567...");
  const client = new Client('ws://localhost:2567');

  try {
    const room = await client.joinOrCreate('game', {});
    console.log(`✅ Connected! sessionId: ${room.sessionId}`);
    console.log(`   roomId: ${room.roomId}`);
    console.log(`   serializerId: ${room.serializerId}`);
    console.log(`   has serializer: ${!!room.serializer}`);
    console.log(`   serializer state: ${room.serializer ? typeof room.serializer.state : 'N/A'}`);
    
    // Check state
    const state = room.state;
    console.log(`   state type: ${state ? state.constructor.name : 'null'}`);
    console.log(`   state.players: ${state ? typeof state.players : 'N/A'}`);
    
    if (state && state.players) {
      console.log(`   state.players.size: ${state.players.size}`);
      console.log(`   state.players type: ${state.players.constructor.name}`);
      
      // List all players
      state.players.forEach((player, sessionId) => {
        console.log(`   Player ${sessionId}: x=${player.x}, y=${player.y}, color=${player.color}`);
      });
    }

    // Listen for changes
    room.onStateChange((newState) => {
      console.log(`   🔄 onStateChange fired! players.size: ${newState.players.size}`);
      newState.players.forEach((player, sessionId) => {
        console.log(`      Player ${sessionId}: x=${player.x}, y=${player.y}`);
      });
    });

    // Listen for state patches
    if (state && state.players) {
      state.players.onAdd((player, sessionId) => {
        console.log(`   🟢 onAdd: ${sessionId}, x=${player.x}, y=${player.y}, color=${player.color}`);
      }, true);
    }

    // Keep running for 10 seconds to see if players join
    console.log("\nWaiting for state changes... (10 second timeout)");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Final check
    console.log(`\nFinal state check:`);
    console.log(`   state.players.size: ${state.players.size}`);
    state.players.forEach((player, sessionId) => {
      console.log(`   Player ${sessionId}: x=${player.x}, y=${player.y}, color=${player.color}`);
    });

    room.leave();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
