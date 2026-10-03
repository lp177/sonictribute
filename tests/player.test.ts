import { describe, it, expect } from 'vitest';
import { PHYS } from '../src/physics/constants.ts';
import { stampLoop, TileMap, TILE_FULL, makeTile } from '../src/physics/TileMap.ts';
import { Player, NO_INPUT, ROLL, START } from '../src/game/Player.ts';
import { Camera } from '../src/core/Camera.ts';
import { makeLoopZone, LoopTracker, LOOP } from '../src/game/loops.ts';
import { makeFlatMap, fillRect, spawnOnGround, input, run, T, TILES } from './helpers.ts';

describe('running physics (Sonic Physics Guide values)', () => {
  it('accelerates to the top speed of 6 px/frame', () => {
    const map = makeFlatMap(80);
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    expect(p.grounded).toBe(true);
    expect(p.gsp).toBeCloseTo(PHYS.top, 1);
  });

  it('stops by friction when input is released', () => {
    const map = makeFlatMap(80);
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    run(map, p, 200);
    expect(p.gsp).toBe(0);
  });

  it('brakes hard when pushing against the direction of travel', () => {
    const map = makeFlatMap(80);
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    const before = p.gsp;
    p.update(map, input({ left: true }));
    expect(before - p.gsp).toBeCloseTo(PHYS.dec, 5);
  });

  it('moves right at top speed', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    const x0 = p.x;
    run(map, p, 200, input({ right: true }));
    expect(p.x - x0).toBeGreaterThan(500);
  });
});

describe('answering the stick (the departures from the guide)', () => {
  // The guide's hero takes 128 frames to reach a run and 128 to coast to a
  // stop. Play-testing called that heavy; these pin what replaced it.
  const framesTo = (speed: number) => {
    const map = makeFlatMap(120);
    const p = spawnOnGround(map, 100, 240);
    for (let f = 1; f <= 200; f++) {
      p.update(map, input({ right: true }));
      if (p.gsp >= speed) return f;
    }
    return Infinity;
  };

  it('is at a jog in a third of a second and at a run in about one', () => {
    expect(framesTo(3)).toBeLessThanOrEqual(24);
    expect(framesTo(PHYS.top - 0.01)).toBeLessThanOrEqual(70);
    // ...but not instantly: it is still a run you build.
    expect(framesTo(PHYS.top - 0.01)).toBeGreaterThan(40);
  });

  it('kicks off hardest from rest and not at all once running', () => {
    const map = makeFlatMap(120);
    const p = spawnOnGround(map, 100, 240);
    p.update(map, input({ right: true }));
    expect(p.gsp).toBeCloseTo(PHYS.acc * (1 + START.kick), 5);
    p.gsp = START.until + 1;
    const before = p.gsp;
    p.update(map, input({ right: true }));
    expect(p.gsp - before).toBeCloseTo(PHYS.acc, 5);
  });

  it('coasts to a stop from a run in about a second, not two', () => {
    const map = makeFlatMap(120);
    const p = spawnOnGround(map, 100, 240);
    p.gsp = PHYS.top;
    let f = 0;
    while (p.gsp > 0 && f < 300) {
      p.update(map, NO_INPUT);
      f++;
    }
    expect(f).toBeLessThanOrEqual(70);
    expect(f).toBeGreaterThan(40);
  });

  it('turns round in the air twice as hard as it pushes on', () => {
    const map = makeFlatMap(120, 60, 900);
    const fall = (xsp: number, hands: Parameters<typeof input>[0]) => {
      const p = new Player(600, 100);
      p.xsp = xsp;
      p.update(map, input(hands));
      return p.xsp - xsp;
    };
    expect(fall(3, { right: true })).toBeCloseTo(PHYS.air, 5); // with the flight: the guide's push
    expect(fall(3, { left: true })).toBeCloseTo(-PHYS.airTurn, 5); // against it
    expect(PHYS.airTurn).toBeGreaterThanOrEqual(PHYS.air * 2);
    // And a flight faster than a run is still not cut down for holding forward.
    expect(fall(9, { right: true })).toBe(0);
  });

  it('gives a jump from rest the same kick, and a fall off a ledge none', () => {
    const map = makeFlatMap(120);
    const jumper = spawnOnGround(map, 600, 240);
    jumper.update(map, input({ jump: true, jumpPressed: true }));
    jumper.update(map, input({ right: true, jump: true }));
    expect(jumper.xsp).toBeCloseTo(PHYS.air * (1 + START.kick), 5);
    const faller = new Player(600, 100);
    faller.update(map, input({ right: true }));
    expect(faller.xsp).toBeCloseTo(PHYS.air, 5);
  });

  it('finds no kick on a 45° face: speed is brought to a hill, not found on it', () => {
    const map = makeFlatMap(80);
    for (let i = 0; i < 8; i++) {
      map.set(45 + i, 14 - i, 2);
      fillRect(map, 45 + i, 15 - i, 45 + i, 14);
    }
    const p = spawnOnGround(map, 47 * T + 8, 12 * T);
    expect(p.angle).toBeCloseTo(45, 0);
    p.gsp = 0;
    p.update(map, input({ right: true }));
    expect(p.gsp).toBeLessThan(PHYS.acc); // the plain push, less the hill
    expect(p.gsp).toBeGreaterThan(0); // ...which the legs still beat (CLIMB)
  });
});

describe('jumping', () => {
  it('jumps with the SPG impulse and lands back', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    const y0 = p.y;
    p.update(map, input({ jump: true, jumpPressed: true }));
    expect(p.grounded).toBe(false);
    expect(p.ysp).toBeCloseTo(-PHYS.jmp, 1);

    let minY = p.y;
    for (let i = 0; i < 200 && !p.grounded; i++) {
      p.update(map, input({ jump: true }));
      minY = Math.min(minY, p.y);
    }
    // Full-height jump: ~v²/2g ≈ 6.5²/(2·0.21875) ≈ 96 px.
    expect(y0 - minY).toBeGreaterThan(85);
    expect(y0 - minY).toBeLessThan(105);
    expect(p.grounded).toBe(true);
  });

  it('cuts the jump short when the button is released early', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    const y0 = p.y;
    p.update(map, input({ jump: true, jumpPressed: true }));
    let minY = p.y;
    for (let i = 0; i < 200 && !p.grounded; i++) {
      p.update(map, input({})); // button released immediately
      minY = Math.min(minY, p.y);
    }
    expect(y0 - minY).toBeLessThan(50);
  });
});

describe('slopes', () => {
  it('does not slide when standing on a 45° slope', () => {
    const map = makeFlatMap();
    map.set(10, 14, 2); // 45° slope on top of the floor
    const p = spawnOnGround(map, 10 * T + 8, 14 * T);
    expect(p.grounded).toBe(true);
    run(map, p, 60);
    expect(Math.abs(p.gsp)).toBeLessThan(0.2);
  });

  it('decelerates when running uphill', () => {
    const map = makeFlatMap(80);
    // Long 45° climb of 8 tiles, far ahead so we reach top speed first.
    for (let i = 0; i < 8; i++) {
      map.set(45 + i, 14 - i, 2);
      fillRect(map, 45 + i, 15 - i, 45 + i, 14);
    }
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 90, input({ right: true }));
    expect(p.gsp).toBeCloseTo(PHYS.top, 1);
    const speedBeforeClimb = p.gsp;
    let climbed = false;
    for (let i = 0; i < 60 && !climbed; i++) {
      p.update(map, input({ right: true }));
      if (p.angle > 30) climbed = true;
    }
    expect(climbed).toBe(true);
    expect(p.gsp).toBeLessThan(speedBeforeClimb);
  });
});

describe('rolling & spin dash', () => {
  it('rolls when pressing down while moving', () => {
    const map = makeFlatMap(80);
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    p.update(map, input({ right: true, down: true }));
    expect(p.rolling).toBe(true);
    expect(p.events).toContain('roll');
  });

  it('accelerates past top speed rolling downhill', () => {
    // Plateau at row 10, long 45° descent from tile 10 to 17, floor at row 18.
    const map = new TileMap(80, 26);
    fillRect(map, 0, 10, 9, 25);
    fillRect(map, 18, 18, 79, 25);
    for (let i = 0; i < 8; i++) {
      map.set(10 + i, 10 + i, 3); // slope down-right
      fillRect(map, 10 + i, 11 + i, 10 + i, 25);
    }
    const p = spawnOnGround(map, 60, 160);
    run(map, p, 60, input({ right: true }));
    p.update(map, input({ right: true, down: true })); // start rolling
    run(map, p, 80, input({ right: true }));
    expect(p.rolling).toBe(true);
    expect(p.gsp).toBeGreaterThan(PHYS.top);
  });

  it('builds speed while rolling when the direction of travel is held', () => {
    // Raw SPG has no rolling acceleration: curling up slow left you stuck slow.
    const map = makeFlatMap(80);
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 20, input({ right: true }));
    p.update(map, input({ right: true, down: true }));
    expect(p.rolling).toBe(true);
    const before = p.gsp;
    run(map, p, 120, input({ right: true }));
    expect(p.rolling).toBe(true);
    expect(p.gsp).toBeGreaterThan(before);
    expect(p.gsp).toBeLessThanOrEqual(ROLL.top + 1e-6);
  });

  it('still uncurls when nothing is held (friction must keep winning)', () => {
    // The ONLY route back to standing is gsp falling under unrollSpeed, so the
    // rolling acceleration above must never apply without input.
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 40, input({ right: true }));
    p.update(map, input({ right: true, down: true }));
    expect(p.rolling).toBe(true);
    const seen: string[] = [];
    for (let i = 0; i < 600; i++) {
      p.update(map, NO_INPUT);
      seen.push(...p.events);
    }
    expect(p.rolling).toBe(false);
    expect(seen).toContain('unroll');
  });

  it('a ball that runs out of speed on a 45° face gets up instead of freezing there', () => {
    // Too steep to uncurl, too shallow to slide off, no control in a roll:
    // it used to sit on the kicker for ever with forward held.
    const map = makeFlatMap(80);
    for (let i = 0; i < 8; i++) {
      map.set(45 + i, 14 - i, 2);
      fillRect(map, 45 + i, 15 - i, 45 + i, 14);
    }
    fillRect(map, 53, 7, 79, 14); // plateau flush with the top of the face
    const p = spawnOnGround(map, 40 * T, 240);
    run(map, p, 30, input({ right: true }));
    p.update(map, input({ right: true, down: true }));
    expect(p.rolling).toBe(true);
    run(map, p, 600, input({ right: true }));
    expect(p.rolling).toBe(false);
    expect(p.x).toBeGreaterThan(53 * T); // and walked on over the top
  });

  it('ploughs through a gentle rise instead of being stalled by it', () => {
    // Gentle 26.5° ascent (tiles 4/5) after a long flat run-up, then a plateau.
    const map = new TileMap(200, 26);
    fillRect(map, 0, 14, 59, 25);
    for (let i = 0; i < 6; i++) {
      const row = 14 - i;
      map.set(60 + i * 2, row, 4);
      map.set(60 + i * 2 + 1, row, 5);
      fillRect(map, 60 + i * 2, row + 1, 60 + i * 2 + 1, 25);
    }
    fillRect(map, 72, 9, 199, 25); // plateau flush with the ramp top
    const p = spawnOnGround(map, 100, 14 * T);
    run(map, p, 150, input({ right: true })); // reach running speed on the flat
    p.update(map, input({ right: true, down: true }));
    expect(p.rolling).toBe(true);
    const before = p.gsp;
    run(map, p, 140, input({ right: true })); // over the rise onto the plateau
    expect(p.rolling).toBe(true);
    expect(p.gsp).toBeGreaterThan(before * 0.5);
  });

  it('rides a small lip instead of being stopped dead by it', () => {
    // A few px of tile-join rounding used to read as a perpendicular wall and
    // zero gsp outright. 4px step here: well under ROLL.stepUp.
    const map = makeFlatMap(120, 20, 240);
    const step = makeTile(new Array(T).fill(4));
    map.setTile(40, Math.floor(240 / T) - 1, step, 0); // surface 4px proud
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 150, input({ right: true }));
    const before = p.gsp;
    expect(before).toBeGreaterThan(PHYS.top - 0.5);
    run(map, p, 40, input({ right: true }));
    expect(p.gsp).toBeGreaterThan(before * 0.5);
  });

  it('spin dash releases at 8 + revs', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    p.update(map, input({ down: true, jump: true, jumpPressed: true }));
    expect(p.spindashing).toBe(true);
    for (let i = 0; i < 4; i++) p.update(map, input({ down: true, jump: true, jumpPressed: true }));
    p.update(map, input({ down: false })); // release
    expect(p.spindashing).toBe(false);
    expect(p.rolling).toBe(true);
    expect(p.gsp).toBeGreaterThanOrEqual(PHYS.dashBase + 6); // 8 + 3+ revs
    expect(p.gsp).toBeLessThanOrEqual(PHYS.dashBase + PHYS.dashRevMax);
  });
});

describe('loop traversal (360° physics + layer switching)', () => {
  /** Flat corridor on layer 0, the annulus channel on layer 1. */
  function loopMap(floorY = 400) {
    const innerR = LOOP.innerR;
    const thickness = LOOP.thickness;
    const cy = floorY - innerR;
    const map = makeFlatMap(80, 34, floorY);
    map.copyLayer(0, 1);
    stampLoop(map, 1, 400, cy, innerR, thickness, LOOP.flatHalf);
    return { map, zone: makeLoopZone(400, cy, innerR, thickness), floorY };
  }

  it('runs a full 360 through all four ground modes and exits the far side', () => {
    const { map, zone, floorY } = loopMap();
    const tracker = new LoopTracker([zone]);
    const p = spawnOnGround(map, 200, floorY);
    p.gsp = 6;

    const modes = new Set<number>();
    let boosted = false;
    let exited = false;
    for (let i = 0; i < 600; i++) {
      const prevX = p.x;
      p.update(map, input({ right: true }));
      const cross = tracker.update(prevX, p.x, p.y, p.gsp);
      p.layer = cross.layer;
      if (cross.entered !== 0) {
        p.gsp = Math.max(p.gsp, LOOP.boost);
        boosted = true;
      }
      if (tracker.current >= 0 && p.grounded && Math.abs(p.gsp) < LOOP.sustain) p.gsp = LOOP.sustain;
      modes.add(p.mode);
      if (p.grounded && p.x > zone.cx + 120 && p.layer === 0) {
        exited = true;
        break;
      }
    }
    expect(boosted).toBe(true);
    expect(exited).toBe(true);
    expect(modes.has(1)).toBe(true); // ran up the right wall
    expect(modes.has(2)).toBe(true); // ran across the ceiling
    expect(modes.has(3)).toBe(true); // ran down the left wall
    expect(p.grounded).toBe(true);
  });

  it('walks straight past the loop on layer 0 when too slow to commit', () => {
    const { map, zone, floorY } = loopMap();
    const tracker = new LoopTracker([zone]);
    const p = spawnOnGround(map, 340, floorY);
    let everSwitched = false;
    for (let i = 0; i < 400; i++) {
      const prevX = p.x;
      p.update(map, NO_INPUT);
      p.x += 1; // creep forward below LOOP.entryMin
      p.layer = tracker.update(prevX, p.x, p.y, 1).layer;
      if (p.layer === 1) everSwitched = true;
    }
    expect(everSwitched).toBe(false);
    expect(p.x).toBeGreaterThan(zone.cx + 100);
  });
});

describe('edges & one-way platforms', () => {
  it('walks off a ledge and falls', () => {
    const map = makeFlatMap();
    // Gap in the floor between x tiles 20 and 30.
    for (let x = 20; x <= 30; x++) map.set(x, 15, 0);
    const p = spawnOnGround(map, 100, 240);
    let fellIn = false;
    for (let i = 0; i < 300; i++) {
      p.update(map, input({ right: true }));
      if (p.y + p.h > 244) fellIn = true; // dropped below floor level into the gap
    }
    expect(p.x).toBeGreaterThan(20 * T);
    expect(fellIn).toBe(true);
  });

  it('lands on one-way platforms from above but passes from below', () => {
    const map = new TileMap(40, 20);
    for (let x = 9; x <= 11; x++) map.set(x, 10, 8); // 3-tile one-way platform
    const p = new Player(10 * T + 8, 8 * T); // above the platform
    run(map, p, 60);
    expect(p.grounded).toBe(true);
    expect(p.y + p.h).toBeCloseTo(10 * T, 0);
  });
});

describe('damage', () => {
  it('loses all rings and becomes invulnerable when hurt', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    p.rings = 12;
    const lost = p.hurt(150);
    expect(lost).toBe(12);
    expect(p.rings).toBe(0);
    expect(p.invuln).toBe(120);
    expect(p.grounded).toBe(false);
    expect(p.xsp).toBeLessThan(0); // knocked away from the hazard
    // Second hit while invulnerable does nothing.
    expect(p.hurt(150)).toBe(0);
  });

  it('dies when hurt with no rings', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    p.hurt(150);
    expect(p.dead).toBe(true);
    expect(p.events).toContain('die');
  });
});

describe('world bounds', () => {
  it('cannot leave the map horizontally', () => {
    const map = makeFlatMap(40, 20, 240);
    map.set(39, 14, TILE_FULL);
    const p = spawnOnGround(map, 38 * T, 240);
    run(map, p, 300, input({ right: true }));
    expect(p.x).toBeLessThan(map.pixelW);
  });
});

describe('rounded ramp joins', () => {
  it('eased tiles keep the linear endpoints (no level geometry shift)', () => {
    const foot = TILES[9].heights;
    const crest = TILES[10].heights;
    const linLow = TILES[4].heights;
    const linHigh = TILES[5].heights;
    // Right edge of the foot tile and of the crest tile must match the linear
    // ramp exactly — that is what keeps a pair rising exactly one tile.
    expect(foot[T - 1]).toBeCloseTo(linLow[T - 1], 5); // 8
    expect(crest[T - 1]).toBeCloseTo(linHigh[T - 1], 5); // 16
  });

  it('eased tiles are flatter at the join than the linear ones', () => {
    const foot = TILES[9].heights;
    const crest = TILES[10].heights;
    // Foot starts nearly flat (tangent to the ground it leaves)...
    expect(foot[0]).toBeLessThan(TILES[4].heights[0]);
    expect(foot[1] - foot[0]).toBeLessThan(0.5);
    // ...and the crest arrives nearly flat (tangent to the plateau above).
    expect(crest[T - 1] - crest[T - 2]).toBeLessThan(0.5);
    // Both stay monotonic: no dips for the player to catch on.
    for (let c = 1; c < T; c++) {
      expect(foot[c]).toBeGreaterThanOrEqual(foot[c - 1]);
      expect(crest[c]).toBeGreaterThanOrEqual(crest[c - 1]);
    }
  });

  it('mirrors the profiles for descents', () => {
    for (let c = 0; c < T; c++) {
      expect(TILES[11].heights[c]).toBeCloseTo(TILES[10].heights[T - 1 - c], 5);
      expect(TILES[12].heights[c]).toBeCloseTo(TILES[9].heights[T - 1 - c], 5);
    }
  });
});

describe('look up / look down camera', () => {
  it('pans up when up is held while standing still, and recentres on release', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(400, 500, 4000, 2000);
    const base = cam.viewY;
    for (let i = 0; i < 60; i++) cam.update(400, 500, 0, 0, 4000, 2000, -1);
    expect(cam.viewY).toBeLessThan(base); // looking up = view moves up
    expect(base - cam.viewY).toBeCloseTo(cam.lookDist, 0);
    for (let i = 0; i < 60; i++) cam.update(400, 500, 0, 0, 4000, 2000, 0);
    expect(cam.viewY).toBeCloseTo(base, 0);
  });

  it('pans down for look-down and eases rather than snapping', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(400, 500, 4000, 2000);
    const base = cam.viewY;
    cam.update(400, 500, 0, 0, 4000, 2000, 1);
    const afterOne = cam.viewY - base;
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThanOrEqual(cam.lookSpeed + 1e-6); // eased, not a snap
    for (let i = 0; i < 60; i++) cam.update(400, 500, 0, 0, 4000, 2000, 1);
    expect(cam.viewY - base).toBeCloseTo(cam.lookDist, 0);
  });

  it('never scrolls the glance outside the level', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(320, 180, 640, 360); // level exactly one screen: no room to pan
    for (let i = 0; i < 60; i++) cam.update(320, 180, 0, 0, 640, 360, 1);
    expect(cam.viewY).toBe(0);
  });
});
