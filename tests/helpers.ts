import { TileMap, TILES, TILE_FULL, TILE_EMPTY } from '../src/physics/TileMap.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT, type PlayerInput } from '../src/game/Player.ts';

const T = PHYS.tile;

/** Flat test map: empty with a solid floor whose surface is at `floorY`. */
export function makeFlatMap(wTiles = 40, hTiles = 20, floorY = 240): TileMap {
  const map = new TileMap(wTiles, hTiles);
  const row = Math.floor(floorY / T);
  for (let x = 0; x < wTiles; x++) {
    for (let y = row; y < hTiles; y++) map.set(x, y, TILE_FULL);
  }
  return map;
}

export function fillRow(map: TileMap, row: number, x0: number, x1: number, id = TILE_FULL): void {
  for (let x = x0; x <= x1; x++) map.set(x, row, id);
}

export function fillRect(map: TileMap, x0: number, y0: number, x1: number, y1: number, id = TILE_FULL): void {
  for (let y = y0; y <= y1; y++) fillRow(map, y, x0, x1, id);
}

export function clearRect(map: TileMap, x0: number, y0: number, x1: number, y1: number): void {
  fillRect(map, x0, y0, x1, y1, TILE_EMPTY);
}

/** Spawn a player standing on the surface at (x, surfaceY) and settle. */
export function spawnOnGround(map: TileMap, x: number, surfaceY: number): Player {
  const p = new Player(x, surfaceY - PHYS.heightRadius - 2);
  for (let i = 0; i < 30 && !p.grounded; i++) p.update(map, NO_INPUT);
  for (let i = 0; i < 5; i++) p.update(map, NO_INPUT);
  return p;
}

export function input(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

export function run(map: TileMap, p: Player, frames: number, inp: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < frames; i++) p.update(map, inp);
}

export { TILES, T };
