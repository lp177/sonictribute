import type { Level } from '../src/game/Level.ts';
import type { LoopZone } from '../src/game/loops.ts';
import { PHYS } from '../src/physics/constants.ts';

const T = PHYS.tile;

/**
 * True when layer 1 carries the loop's inner ceiling (the surface the hero
 * runs across upside-down) somewhere above the loop centre. Derived from the
 * loop's own radii so it survives geometry tuning.
 */
export function hasCrown(level: Level, loop: LoopZone): boolean {
  const cxTile = Math.floor(loop.cx / T);
  const from = Math.floor((loop.cy - loop.outerR) / T);
  const to = Math.floor((loop.cy - loop.innerR) / T);
  for (let ty = from; ty <= to; ty++) {
    if (level.map.get(cxTile, ty, 1).heightsTop.some((h) => h > 0)) return true;
  }
  return false;
}
