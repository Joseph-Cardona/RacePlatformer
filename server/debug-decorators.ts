import { Schema, type, MapSchema } from "@colyseus/schema";

class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") color: number = 0;
}

class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

const p = new Player();
p.x = 100;
p.y = 200;
p.color = 0xff4444;
console.log("Player:", p.x, p.y, p.color);
console.log("Has _definition:", !!Player._definition);
console.log("Schema fields:", Player._definition ? Object.keys(Player._definition.schema) : "N/A");

const state = new GameRoomState();
console.log("State has _definition:", !!GameRoomState._definition);
console.log("State fields:", GameRoomState._definition ? Object.keys(GameRoomState._definition.schema) : "N/A");

state.players.set("test", p);
console.log("State players size:", state.players.size);
console.log("State players.has('test'):", state.players.has("test"));
