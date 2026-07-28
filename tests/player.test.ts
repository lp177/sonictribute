import { describe, it, expect } from 'vitest';
import { PHYS } from '../src/physics/constants.ts';
import { stampLoop, TileMap, TILE_FULL } from '../src/physics/TileMap.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { makeLoopZone, LoopTracker, LOOP } from '../src/game/loops.ts';
import { makeFlatMap, fillRect, spawnOnGround, input, run, T } from './helpers.ts';

describe('running physics (Sonic Physics Guide values)', () => {
  it('accelerates to the top speed of 6 px/frame', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    expect(p.grounded).toBe(true);
    expect(p.gsp).toBeCloseTo(PHYS.top, 1);
  });

  it('stops by friction when input is released', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 100, 240);
    run(map, p, 140, input({ right: true }));
    run(map, p, 200);
    expect(p.gsp).toBe(0);
  });

  it('brakes hard when pushing against the direction of travel', () => {
    const map = makeFlatMap();
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
    run(map, p, 130, input({ right: true }));
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
    const map = makeFlatMap();
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
