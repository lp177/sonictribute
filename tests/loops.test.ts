import { describe, it, expect } from 'vitest';
import { LoopTracker, makeLoopZone, minThickness, LOOP } from '../src/game/loops.ts';
import { Level } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { LEVELS } from '../src/levels/index.ts';
import { PHYS } from '../src/physics/constants.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

/** A loop standing on `floorY`, as the builder makes them. */
function zone(floorY = 384, cx = 712) {
  return makeLoopZone(cx, floorY - LOOP.innerR, LOOP.innerR, LOOP.thickness);
}

describe('Loop geometry', () => {
  it('is thick enough for its legs to reach the ground', () => {
    // Below this the annulus floats above the corridor and headbutts the
    // player instead of curving up under their feet.
    expect(LOOP.thickness).toBeGreaterThanOrEqual(minThickness(LOOP.innerR));
  });

  it('switches layers exactly where both floors coincide', () => {
    // The flattened channel base must span the trigger lines.
    expect(zone().trigHalf).toBeLessThanOrEqual(LOOP.flatHalf);
  });

  it('is big enough to read as a real loop (taller than the hero)', () => {
    expect(2 * LOOP.innerR).toBeGreaterThan(6 * PHYS.heightRadius);
  });
});

describe('LoopTracker', () => {
  const z = zone();
  const floorY = z.cy + z.innerR;
  const left = z.cx - z.trigHalf;
  const right = z.cx + z.trigHalf;
  const y = floorY - 20; // standing height at the base

  it('enters when running into the left line, and reports the direction', () => {
    const t = new LoopTracker([z]);
    const r = t.update(left - 4, left + 1, y, 8);
    expect(r.layer).toBe(1);
    expect(r.entered).toBe(1);
    expect(t.current).toBe(0);
  });

  it('enters leftwards from the right line', () => {
    const t = new LoopTracker([z]);
    const r = t.update(right + 4, right - 1, y, -8);
    expect(r.layer).toBe(1);
    expect(r.entered).toBe(-1);
  });

  it('ignores a crawl: too slow to commit stays on the flat corridor', () => {
    const t = new LoopTracker([z]);
    const r = t.update(left - 1, left + 1, y, LOOP.entryMin - 0.1);
    expect(r.layer).toBe(0);
    expect(r.entered).toBe(0);
  });

  it('will not enter backwards through the line it is running away from', () => {
    const t = new LoopTracker([z]);
    // Moving right across the RIGHT line is an exit line, not an entry.
    expect(t.update(right - 4, right + 1, y, 8).layer).toBe(0);
  });

  it('does not release the player until a lap is actually climbed', () => {
    const t = new LoopTracker([z]);
    t.update(left - 4, left + 1, y, 8);
    expect(t.lapArmed).toBe(false);
    // Running straight across the base must NOT exit — that is the bug that
    // made big loops eject the player one frame after entering.
    const r = t.update(right - 4, right + 1, y, 8);
    expect(r.layer).toBe(1);
    expect(t.current).toBe(0);
  });

  it('exits by the far line once the lap has passed the loop centre', () => {
    const t = new LoopTracker([z]);
    t.update(left - 4, left + 1, y, 8);
    t.update(z.cx, z.cx, z.cy - 10, 8); // climbed above the centre
    expect(t.lapArmed).toBe(true);
    const r = t.update(right - 4, right + 1, y, 8);
    expect(r.layer).toBe(0);
    expect(t.current).toBe(-1);
  });

  it('lets go if the player strays far from the loop', () => {
    const t = new LoopTracker([z]);
    t.update(left - 4, left + 1, y, 8);
    const r = t.update(z.cx, z.cx + z.outerR + 400, y, 8);
    expect(r.layer).toBe(0);
    expect(t.current).toBe(-1);
  });

  it('only ever consults the loop being ridden', () => {
    const near = zone(384, 712);
    const far = zone(384, 3000);
    const t = new LoopTracker([near, far]);
    const l = near.cx - near.trigHalf;
    // Entering the near loop must not be cancelled by the distant one.
    expect(t.update(l - 4, l + 1, y, 8).layer).toBe(1);
    expect(t.current).toBe(0);
  });

  it('resets on respawn', () => {
    const t = new LoopTracker([z]);
    t.update(left - 4, left + 1, y, 8);
    t.reset();
    expect(t.current).toBe(-1);
    expect(t.lapArmed).toBe(false);
  });
});

/** Drives a hero into a real level's loop and reports what happened. */
function rideLoop(def: typeof zone1, loopIndex: number, entrySpeed: number) {
  const level = new Level(def);
  const loop = level.loops[loopIndex];
  const floorY = loop.cy + loop.innerR;
  const p = new Player(loop.cx - 150, floorY - PHYS.heightRadius - 2);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  p.gsp = entrySpeed;

  let boosted = false;
  let upsideDown = false;
  let apex = p.y;
  let rodeLayer1 = false;
  for (let i = 0; i < 400; i++) {
    p.update(level.map, input({ right: true }));
    if (level.update(p).includes('loop-boost')) boosted = true;
    if (p.layer === 1) rodeLayer1 = true;
    apex = Math.min(apex, p.y);
    if (p.grounded && p.angle > 140 && p.angle < 220) upsideDown = true;
    if (p.x > loop.cx + 200) break;
  }
  return { p, loop, boosted, upsideDown, rodeLayer1, climbed: floorY - apex };
}

describe('Loops in the real zones', () => {
  it.each([
    ['zone 1 loop 1', zone1, 0],
    ['zone 1 loop 2', zone1, 1],
    ['zone 2 loop 1', zone2, 0],
    ['zone 2 loop 2', zone2, 1],
  ] as const)('%s carries the hero all the way round', (_name, def, i) => {
    const r = rideLoop(def, i, 6);
    expect(r.boosted).toBe(true);
    expect(r.rodeLayer1).toBe(true);
    expect(r.upsideDown).toBe(true);
    // Reached the ceiling of the channel, i.e. a genuine full lap.
    expect(r.climbed).toBeGreaterThan(2 * r.loop.innerR - PHYS.heightRadius - 4);
    expect(r.p.dead).toBe(false);
  });

  it.each([2.5, 4, 6, 9, 12])('completes the loop entered at %s px/frame', (speed) => {
    const r = rideLoop(zone1, 0, speed);
    expect(r.upsideDown).toBe(true);
    expect(r.p.x).toBeGreaterThan(r.loop.cx + 100);
  });

  it('boosts to LOOP.boost and keeps that speed out the far side', () => {
    const r = rideLoop(zone1, 0, 3);
    expect(r.p.gsp).toBeGreaterThan(PHYS.top); // did not decay back to walking pace
    expect(r.p.gsp).toBeGreaterThanOrEqual(LOOP.boost - 1);
  });

  it('never leaves the player stuck on the loop layer after exiting', () => {
    const r = rideLoop(zone1, 0, 6);
    expect(r.p.layer).toBe(0);
  });

  it('lays a ring arc inside every loop channel', () => {
    for (const def of LEVELS) {
      const level = new Level(def);
      for (const loop of level.loops) {
        const inChannel = level.rings.filter((ring) => {
          const d = Math.hypot(ring.x - loop.cx, ring.y - loop.cy);
          return d > loop.innerR - 24 && d < loop.innerR;
        });
        expect(inChannel.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('keeps hand-placed rings clear of the loop footprint', () => {
    for (const def of LEVELS) {
      const level = new Level(def);
      for (const loop of level.loops) {
        for (const ring of level.rings) {
          const d = Math.hypot(ring.x - loop.cx, ring.y - loop.cy);
          // Rings live either on the channel arc or outside the annulus —
          // never buried inside the loop's solid wall.
          const buriedInWall = d >= loop.innerR && d <= loop.outerR;
          expect(buriedInWall).toBe(false);
        }
      }
    }
  });

  it('does not overlap loops with other terrain in either zone', () => {
    for (const def of LEVELS) {
      const level = new Level(def);
      for (const loop of level.loops) {
        const x0 = Math.floor((loop.cx - loop.outerR) / T);
        const x1 = Math.ceil((loop.cx + loop.outerR) / T);
        const yTop = Math.floor((loop.cy - loop.outerR) / T);
        const yBase = Math.floor((loop.cy + loop.innerR) / T);
        for (let tx = x0; tx <= x1; tx++) {
          for (let ty = yTop; ty < yBase; ty++) {
            // Layer 0 must stay hollow above the corridor so the loop art and
            // channel have room; solid terrain here would trap the rider.
            expect(level.map.get(tx, ty, 0).heights.some((h) => h > 0)).toBe(false);
          }
        }
      }
    }
  });
});
