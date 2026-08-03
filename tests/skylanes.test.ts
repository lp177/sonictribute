import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { duskActs } from '../src/levels/dusk/index.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { input } from './helpers.ts';
import { PHYS } from '../src/physics/constants.ts';
const T = PHYS.tile;

function probe(def: any, startTile: number, canopyRow: number, from: number, to: number) {
  const level = new Level(def);
  const p = new Player(startTile * T, 21 * T - PHYS.heightRadius - 2);
  for (let i = 0; i < 60 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  // full spin dash, then hold right
  for (let i = 0; i < 6; i++) p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
  p.update(level.map, input({}));
  let boarded = false;
  for (let f = 0; f < 1200 && !p.dead; f++) {
    p.update(level.map, input({ right: true }));
    level.update(p);
    const feetRow = (p.y + p.h) / T;
    if (p.grounded && p.x / T > from && p.x / T < to && feetRow <= canopyRow + 0.4) boarded = true;
    if (p.x / T > to + 20) break;
  }
  return boarded;
}

describe('dusk sky lanes are physically boardable', () => {
  it('act 5: a bowl launch lands on the canopy', () => {
    expect(probe(duskActs[4], 30, 10, 98, 228)).toBe(true);
  });
  it('act 7: the launch ramp arc boards the canopy', () => {
    expect(probe(duskActs[6], 20, 10, 76, 219)).toBe(true);
  });
  it('act 10: the shelf/bowl route boards the canopy', () => {
    expect(probe(duskActs[9], 4, 10, 50, 323)).toBe(true);
  });
});
