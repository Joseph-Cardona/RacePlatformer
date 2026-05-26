import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

export class Player extends Schema {
  declare x: number;
  declare y: number;
  declare color: number;

  constructor(x = 0, y = 0, color = 0) {
    super();
    this.x = x;
    this.y = y;
    this.color = color;
  }
}
defineTypes(Player, { x: "number", y: "number", color: "number" });

export class GameRoomState extends Schema {
  players: MapSchema<Player>;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
  }
}
defineTypes(GameRoomState, { players: { map: Player } });
