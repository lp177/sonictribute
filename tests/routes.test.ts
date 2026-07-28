import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { LEVELS } from '../src/levels/index.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { zone3 } from '../src/levels/zone3.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { castGround } from '../src/physics/sensors.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

/** Row bands each route is expected to live in. */
const LANES = [
  { name: 'sky', from: 2, to: 16 },
  { name: 'ground', from: 17, to: 27 },
  { name: 'under', from: 28, to: 36 },
] as const;

/** Every column that has a standable surface inside [from, to]. */
function laneColumns(level: Level, from: number, to: number): Set<number> {
  const cols = new Set<number>();
  for (let tx = 0; tx < level.map.w; tx++) {
    for (let ty = from; ty <= to; ty++) {
      const t = level.map.get(tx, ty, 0);
      if (t.heights.some((h) => h > 0)) {
        cols.add(tx);
        break;
      }
    }
  }
  return cols;
}

describe('Three routes to the goal', () => {
  it.each(LEVELS.map((d) => [d.name, d] as const))(
    '%s offers a sky, a ground and an underground route',
    (_name, def) => {
      const level = new Level(def);
      for (const lane of LANES) {
        const cols = laneColumns(level, lane.from, lane.to);
        expect(cols.size, `${lane.name} route is missing`).toBeGreaterThan(30);
      }
    },
  );

  it.each(LEVELS.map((d) => [d.name, d] as const))(
    '%s keeps each route continuous enough to travel',
    (_name, def) => {
      const level = new Level(def);
      // A route is travellable when consecutive standable columns are never
      // further apart than a running jump (~8 tiles is comfortable; the
      // physics allow far more at speed).
      const MAX_GAP = 9;
      for (const lane of LANES) {
        const cols = [...laneColumns(level, lane.from, lane.to)].sort((a, b) => a - b);
        const span = cols[cols.length - 1] - cols[0];
        expect(span, `${lane.name} route is too short to be a route`).toBeGreaterThan(90);
        let worst = 0;
        let worstAt = -1;
        for (let i = 1; i < cols.length; i++) {
          const gap = cols[i] - cols[i - 1] - 1;
          if (gap > worst) {
            worst = gap;
            worstAt = cols[i - 1];
          }
        }
        expect(worst, `${lane.name} route has a ${worst}-tile gap at x=${worstAt}`).toBeLessThanOrEqual(MAX_GAP);
      }
    },
  );

  it.each(LEVELS.map((d) => [d.name, d] as const))(
    '%s spreads the Chrono Crystals across the routes',
    (_name, def) => {
      const level = new Level(def);
      const laneOf = (y: number) => LANES.find((l) => y / T >= l.from && y / T <= l.to)?.name ?? 'other';
      const used = new Set(level.crystals.map((c) => laneOf(c.y)));
      // No single route may hold every crystal — you have to learn the zone.
      expect(used.size).toBeGreaterThanOrEqual(2);
      expect(level.crystals.length).toBe(5);
    },
  );

  it('every underworld gallery sits above the killing void', () => {
    for (const def of LEVELS) {
      const level = new Level(def);
      const under = laneColumns(level, 28, 36);
      expect(under.size).toBeGreaterThan(30);
      // The void that ends an endless fall must be BELOW the deepest route,
      // or the underworld would kill anyone who used it.
      expect(level.voidY).toBeGreaterThan(36 * T);
    }
  });
});

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
