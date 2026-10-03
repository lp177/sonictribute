import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { zone3 } from '../src/levels/zone3.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { castGround } from '../src/physics/sensors.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

describe('Level flow (no momentum-killing terrain)', () => {
  /**
   * Runs a bot along the ground route and measures how fluid the trip is.
   * This is the regression test for "ground shapes that just stop you": a
   * 45° face or a sheer step in the running lane shows up as a long stall.
   */
  function runBot(def: typeof zone1, frames: number) {
    const level = new Level(def);
    const p = new Player(level.startPos.x, level.startPos.y);
    for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
    p.rings = 30;

    let lastX = p.x;
    let stall = 0;
    let worstStall = 0;
    let worstAt = 0;
    const startX = p.x;
    let f = 0;
    for (; f < frames && !p.dead; f++) {
      // Only look for a gap while upright on a floor: probing "down and
      // ahead" is meaningless on a loop wall, and a bot that jumps there
      // would measure its own confusion rather than the terrain.
      const groundAhead = castGround(level.map, p.x + 26, p.y + p.h + 8, 0, p.layer);
      const jump = p.grounded && p.mode === 0 && !groundAhead;
      p.update(level.map, input({ right: true, jump, jumpPressed: jump }));
      level.update(p);
      if (p.rings === 0) p.rings = 30; // keep the bot alive; we measure flow
      if (p.x - lastX > 0.4) {
        lastX = p.x;
        stall = 0;
      } else if (++stall > worstStall) {
        worstStall = stall;
        worstAt = p.x;
      }
      if (p.x > level.bossTriggerX) break;
    }
    return { level, p, frames: f, worstStall, worstAt, avgSpeed: (p.x - startX) / Math.max(1, f) };
  }

  it.each([
    ['VERDANT RUSH', zone1],
    ['COG SKYWAY', zone2],
    ['THE CHRONO VAULT', zone3],
  ] as const)('%s: a bot holding right keeps moving and reaches the boss', (_name, def) => {
    const r = runBot(def, 9000);
    expect(r.p.dead).toBe(false);
    expect(r.p.x, 'the bot never reached the boss trigger').toBeGreaterThan(r.level.bossTriggerX);
    // No single obstacle may pin a forward-running player for long.
    expect(
      r.worstStall,
      `stalled ${r.worstStall} frames at x=${Math.round(r.worstAt)} (tile ${Math.round(r.worstAt / T)})`,
    ).toBeLessThan(150);
    // And the trip has to actually be quick.
    expect(r.avgSpeed, 'average speed too slow to feel like this game').toBeGreaterThan(2.2);
  });
});
