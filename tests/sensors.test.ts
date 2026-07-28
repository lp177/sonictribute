import { describe, it, expect } from 'vitest';
import { castGround, modeForAngle, rotate, norm360 } from '../src/physics/sensors.ts';
import { TileMap, TILE_FULL, TILES, stampLoop } from '../src/physics/TileMap.ts';
import { makeFlatMap, T } from './helpers.ts';

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
