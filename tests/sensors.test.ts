import { describe, it, expect } from 'vitest';
import { castGround, modeForAngle, rotate, norm360 } from '../src/physics/sensors.ts';
import { TileMap, TILE_FULL, TILES, stampLoop } from '../src/physics/TileMap.ts';
import { makeFlatMap, spawnOnGround, input, T } from './helpers.ts';

describe('ground sensors — flat floor', () => {
  const map = makeFlatMap(40, 20, 240);

  it('finds the surface and reports penetration depth', () => {
    const hit = castGround(map, 50, 245, 0);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(240);
    expect(hit!.depth).toBe(5);
    expect(hit!.angle).toBeCloseTo(0, 5);
  });

  it('finds the surface from above within snap range', () => {
    const hit = castGround(map, 50, 232, 0);
    expect(hit).not.toBeNull();
    expect(hit!.depth).toBe(-8);
  });

  it('returns null when too far above the surface', () => {
    expect(castGround(map, 50, 220, 0)).toBeNull();
  });

  it('treats out-of-bounds as solid', () => {
    const hit = castGround(map, -8, 100, 0);
    expect(hit).not.toBeNull();
  });
});

describe('ground sensors — slopes', () => {
  it('reports height and angle of a 45° slope', () => {
    const map = makeFlatMap();
    map.set(5, 15, 2); // slope up-right: heights 1..16
    const px = 5 * T + 3;
    const hit = castGround(map, px, 256, 0);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(16 * T - TILES[2].heights[3]); // 256 - 4 = 252
    expect(hit!.angle).toBeCloseTo(45, 0);
  });

  it('regresses to the tile below through empty columns', () => {
    const map = makeFlatMap();
    map.set(5, 15, 3); // slope down-right; column 0 has height 16, last has 1
    const px = 5 * T + 15; // heights[15] = 1
    const hit = castGround(map, px, 256, 0);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(256 - 1);
  });

  it('supports wall-mode traversal on a 45° slope (mirrored width arrays)', () => {
    const map = new TileMap(20, 20);
    map.set(10, 10, 2); // '/' slope: row r has r+1 solid pixels from the right
    // Row 7: solid face at x = 176 - 8 = 168.
    const hit = castGround(map, 172, 10 * T + 7, 1);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(168);
    expect(hit!.depth).toBe(4);
    expect(hit!.angle).toBeCloseTo(45, 0);
    // Bottom row is fully solid: deep penetration reports the tile's west face.
    const deep = castGround(map, 175, 10 * T + 15, 1);
    expect(deep).not.toBeNull();
    expect(deep!.surface).toBe(160);
    expect(deep!.depth).toBe(15);
  });
});

describe('wall sensors', () => {
  it('detects a wall to the east', () => {
    const map = new TileMap(20, 20);
    map.set(10, 10, TILE_FULL);
    const hit = castGround(map, 155, 165, 1);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(160);
    expect(hit!.depth).toBe(-5);
    expect(hit!.angle).toBeCloseTo(90, 0);
  });

  it('detects a wall to the west', () => {
    const map = new TileMap(20, 20);
    map.set(10, 10, TILE_FULL);
    const hit = castGround(map, 173, 165, 3); // sensor inside the wall
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(176);
    expect(hit!.depth).toBe(3);
    expect(hit!.angle).toBeCloseTo(270, 0);
  });

  it('detects a ceiling above', () => {
    const map = new TileMap(20, 20);
    map.set(10, 5, TILE_FULL);
    const hit = castGround(map, 165, 100, 2);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBe(96);
    expect(hit!.angle).toBeCloseTo(180, 0);
  });
});

describe('loop tiles (all four ground modes)', () => {
  const map = new TileMap(30, 30);
  stampLoop(map, 0, 240, 240, 40, 16); // centre (240,240), inner radius 40

  it('has a floor at the bottom of the cavity', () => {
    const hit = castGround(map, 240, 285, 0);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBeGreaterThanOrEqual(279);
    expect(hit!.surface).toBeLessThanOrEqual(281);
    expect(Math.abs(hit!.angle)).toBeLessThan(10);
  });

  it('has a wall on the right of the cavity', () => {
    const hit = castGround(map, 277, 240, 1);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBeGreaterThanOrEqual(279);
    expect(hit!.surface).toBeLessThanOrEqual(281);
    expect(hit!.angle).toBeGreaterThan(75);
    expect(hit!.angle).toBeLessThan(105);
  });

  it('has a ceiling at the top of the cavity', () => {
    const hit = castGround(map, 240, 197, 2);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBeGreaterThanOrEqual(199);
    expect(hit!.surface).toBeLessThanOrEqual(201);
    expect(hit!.angle).toBeGreaterThan(170);
    expect(hit!.angle).toBeLessThan(190);
  });

  it('has a wall on the left of the cavity', () => {
    const hit = castGround(map, 203, 240, 3);
    expect(hit).not.toBeNull();
    expect(hit!.surface).toBeGreaterThanOrEqual(199);
    expect(hit!.surface).toBeLessThanOrEqual(201);
    expect(hit!.angle).toBeGreaterThan(255);
    expect(hit!.angle).toBeLessThan(285);
  });

  it('has no phantom solidity outside the annulus', () => {
    // Well above the loop: nothing overhead.
    expect(castGround(map, 240, 100, 2)).toBeNull();
    // Well below: nothing underfoot.
    expect(castGround(map, 240, 400, 0)).toBeNull();
  });
});

describe('angle utilities', () => {
  it('maps angles to ground-mode quadrants', () => {
    expect(modeForAngle(0)).toBe(0);
    expect(modeForAngle(44)).toBe(0);
    expect(modeForAngle(46)).toBe(1);
    expect(modeForAngle(90)).toBe(1);
    expect(modeForAngle(134)).toBe(1);
    expect(modeForAngle(136)).toBe(2);
    expect(modeForAngle(180)).toBe(2);
    expect(modeForAngle(226)).toBe(3);
    expect(modeForAngle(270)).toBe(3);
    expect(modeForAngle(314)).toBe(3);
    expect(modeForAngle(316)).toBe(0);
  });

  it('normalises angles to [0, 360)', () => {
    expect(norm360(-45)).toBe(315);
    expect(norm360(360)).toBe(0);
    expect(norm360(725)).toBe(5);
  });

  it('rotates body offsets by ground mode', () => {
    expect(rotate(0, 3, 4)).toEqual({ x: 3, y: 4 });
    expect(rotate(1, 3, 4)).toEqual({ x: 4, y: -3 });
    expect(rotate(2, 3, 4)).toEqual({ x: -3, y: -4 });
    expect(rotate(3, 3, 4)).toEqual({ x: -4, y: 3 });
  });
});

describe('ground sensors — the edge of a ledge', () => {
  // Floor at y = 240 with a pit cut out of columns 20..25.
  const pit = () => {
    const map = makeFlatMap(40, 20, 240);
    for (let x = 20; x <= 25; x++) for (let y = 15; y < 19; y++) map.set(x, y, 0);
    return map;
  };

  it('the last pixel column before a drop reads as level ground, not as a cliff', () => {
    const map = pit();
    // It used to read -83°: 16 px of ground, then nothing, taken for a slope.
    expect(castGround(map, 20 * T - 1, 240, 0)!.angle).toBeCloseTo(0, 5);
    expect(castGround(map, 26 * T, 240, 0)!.angle).toBeCloseTo(0, 5);
    expect(modeForAngle(castGround(map, 20 * T - 1, 240, 0)!.angle)).toBe(0);
  });

  it('a ramp keeps its own angle right up to its lip', () => {
    const map = makeFlatMap(40, 20, 240);
    map.set(10, 14, 2); // a 45° tile standing on the floor, open air after it
    const lip = castGround(map, 11 * T - 1, 14 * T + 2, 0)!;
    expect(lip.angle).toBeCloseTo(45, 0);
    const mid = castGround(map, 10 * T + 8, 14 * T + 10, 0)!;
    expect(mid.angle).toBeCloseTo(45, 0);
  });

  it('a hero who runs or rolls off a ledge FALLS — at every speed and pixel offset', () => {
    // The bug was one pixel column wide, so sweep them all.
    for (const roll of [false, true]) {
      for (let v = 1; v <= 12; v += 0.5) {
        for (let off = 0; off < 16; off++) {
          const map = pit();
          const p = spawnOnGround(map, 14 * T + off, 240);
          p.gsp = v;
          let wrapped = false;
          let fell = false;
          for (let f = 0; f < 80 && p.x < 22 * T; f++) {
            p.update(map, input({ right: true, down: roll && f === 0 }));
            if (p.grounded && p.mode !== 0) wrapped = true;
            if (!p.grounded) fell = true;
          }
          expect(wrapped, `v=${v} off=${off} roll=${roll}`).toBe(false);
          expect(fell, `v=${v} off=${off} roll=${roll}`).toBe(true);
        }
      }
    }
  });
});

describe('side profiles — what a sensor cast along a row meets', () => {
  it('a full tile is a wall from both sides, an empty one from neither', () => {
    expect(TILES[1].widths).toEqual(new Array(T).fill(T));
    expect(TILES[1].widthsLeft).toEqual(new Array(T).fill(T));
    expect(TILES[0].widths).toEqual(new Array(T).fill(0));
  });

  it('the air above a ramp is air: no row is solid above the profile', () => {
    // 9 = the rounded foot of a gentle ramp (0 -> 8 px): its top half is empty.
    for (let r = 0; r < 8; r++) {
      expect(TILES[9].widths[r], `row ${r}`).toBe(0);
      expect(TILES[9].widthsLeft[r], `row ${r}`).toBe(0);
    }
    // The bottom row is solid wherever the ramp has left the ground.
    expect(TILES[9].widths[T - 1]).toBe(TILES[9].heights.filter((h) => h >= 1).length);
  });

  it('a row is as wide as the columns that reach it, measured from the tall side', () => {
    for (const id of [4, 5, 9, 10]) {
      const t = TILES[id]; // rising to the right: tall side on the right
      for (let r = 0; r < T; r++) {
        expect(t.widths[r], `tile ${id} row ${r}`).toBe(t.heights.filter((h) => h >= T - r).length);
      }
    }
    for (const id of [3, 6, 7, 11, 12]) {
      const t = TILES[id]; // falling to the right: tall side on the left
      for (let r = 0; r < T; r++) {
        expect(t.widthsLeft[r], `tile ${id} row ${r}`).toBe(t.heights.filter((h) => h >= T - r).length);
      }
    }
  });

  it('a ball never stops dead at the foot of a rise — at every speed and pixel offset', () => {
    // The foot tile used to be a 16-px wall to anything as low as a ball: one
    // approach in three ended with the hero standing still at a ramp.
    const rises: { name: string; build: (map: TileMap) => void }[] = [
      {
        name: 'gentle ramp',
        build: (map) => {
          for (let i = 0; i < 4; i++) {
            map.set(40 + i * 2, 14 - i, i === 0 ? 9 : 4);
            map.set(41 + i * 2, 14 - i, 5);
            for (let y = 15 - i; y < 15; y++) {
              map.set(40 + i * 2, y, TILE_FULL);
              map.set(41 + i * 2, y, TILE_FULL);
            }
          }
          for (let x = 48; x < 120; x++) for (let y = 11; y < 15; y++) map.set(x, y, TILE_FULL);
        },
      },
      {
        name: 'kicker',
        build: (map) => {
          map.set(40, 14, 9);
          map.set(41, 14, 5);
          for (let i = 0; i < 3; i++) {
            map.set(42 + i, 13 - i, 2);
            for (let y = 14 - i; y < 15; y++) map.set(42 + i, y, TILE_FULL);
          }
        },
      },
    ];
    for (const rise of rises) {
      for (let v = 3; v <= 14; v += 0.5) {
        for (let off = 0; off < 16; off++) {
          const map = makeFlatMap(120, 20, 240);
          rise.build(map);
          const p = spawnOnGround(map, 30 * T + off, 240);
          p.gsp = v;
          p.update(map, input({ right: true, down: true }));
          let slowest = Infinity;
          for (let f = 0; f < 40 && p.x < 46 * T && p.grounded; f++) {
            p.update(map, input({ right: true }));
            if (p.grounded) slowest = Math.min(slowest, Math.abs(p.gsp));
          }
          expect(slowest, `${rise.name} v=${v} off=${off}`).toBeGreaterThan(v * 0.4);
        }
      }
    }
  });
});
