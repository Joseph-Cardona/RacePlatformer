import * as schema from "@colyseus/schema";
const { Schema, type, MapSchema, encode, decode } = schema;

// Test: Decorator API
class PlayerDecorated extends Schema {}
type("number")(PlayerDecorated.prototype, "x");
type("number")(PlayerDecorated.prototype, "y");
type("number")(PlayerDecorated.prototype, "color");

const p1 = new PlayerDecorated();
p1.x = 100;
p1.y = 200;
p1.color = 0xff4444;
console.log("Decorated Player:", p1.x, p1.y, p1.color);
console.log("Definition:", !!PlayerDecorated._definition);
console.log("Fields:", Object.keys(PlayerDecorated._definition?.schema || {}));

// Test 2: MapSchema on state
class StateDecorated extends Schema {}
type({ map: PlayerDecorated })(StateDecorated.prototype, "players");

const state = new StateDecorated();
console.log("State fields:", Object.keys(StateDecorated._definition?.schema || {}));

// Test 3: Encode/decode
state.players = new MapSchema();
const p2 = new PlayerDecorated();
p2.x = 300;
p2.y = 400;
p2.color = 0x00ff00;
state.players.set("player1", p2);

console.log("State.players.size before encode:", state.players.size);
state.players.forEach((v, k) => console.log("  -", k, v.x, v.y, v.color));

const encoded = encode(state);
console.log("Encoded bytes:", encoded?.byteLength ?? encoded);

const decodedState = new StateDecorated();
decode(decodedState, encoded);
console.log("Decoded state players size:", decodedState.players?.size);
if (decodedState.players) {
  decodedState.players.forEach((v, k) => console.log("  -", k, v.x, v.y, v.color));
}
