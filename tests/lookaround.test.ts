import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { LEVELS } from '../src/levels/index.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Camera } from '../src/core/Camera.ts';
import { makeFlatMap, spawnOnGround, input, run } from './helpers.ts';

const T = PHYS.tile;

describe('Looking up and crouching', () => {
  it('sets the look state while standing still', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.update(map, input({ up: true }));
    expect(p.lookUp).toBe(true);
    expect(p.crouch).toBe(false);

    p.update(map, input({ down: true }));
    expect(p.crouch).toBe(true);
    expect(p.lookUp).toBe(false);
  });

  it('clears the moment the key is released', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.update(map, input({ up: true }));
    expect(p.lookUp).toBe(true);
    p.update(map, input({}));
    expect(p.lookUp).toBe(false);
  });

  it('never looks around while running', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    run(map, p, 120, input({ right: true }));
    p.update(map, input({ right: true, up: true }));
    expect(p.lookUp).toBe(false);
  });

  it('does not look around in mid-air', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.update(map, input({ jump: true, jumpPressed: true }));
    p.update(map, input({ up: true }));
    expect(p.grounded).toBe(false);
    expect(p.lookUp).toBe(false);
  });

  it('crouching never blocks the spin dash it leads into', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.update(map, input({ down: true }));
    expect(p.crouch).toBe(true);
    p.update(map, input({ down: true, jump: true, jumpPressed: true }));
    expect(p.spindashing).toBe(true);
    // Charging is its own posture: the crouch reads only on the frame the
    // dash is triggered, then the spin-dash pose takes over.
    p.update(map, input({ down: true }));
    expect(p.spindashing).toBe(true);
    expect(p.crouch).toBe(false);
  });
});

describe('The look camera returns to neutral', () => {
  const W = 640;
  const H = 360;
  const LEVEL_W = 5000;
  const LEVEL_H = 2000;

  function settled(look: -1 | 0 | 1, frames: number) {
    const cam = new Camera(W, H);
    cam.snapTo(1000, 900, LEVEL_W, LEVEL_H);
    for (let i = 0; i < frames; i++) cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, look);
    return cam;
  }

  it('pans up while up is held, and all the way back on release', () => {
    const cam = settled(-1, 120);
    expect(cam.lookOff).toBeLessThan(-50);
    const panned = cam.viewY;
    for (let i = 0; i < 200; i++) cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, 0);
    expect(cam.lookOff).toBe(0);
    expect(cam.viewY).toBe(cam.y);
    expect(cam.viewY).not.toBe(panned);
  });

  it('pans down while down is held, and all the way back on release', () => {
    const cam = settled(1, 120);
    expect(cam.lookOff).toBeGreaterThan(50);
    for (let i = 0; i < 200; i++) cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, 0);
    expect(cam.lookOff).toBe(0);
    expect(cam.viewY).toBe(cam.y);
  });

  it('eases rather than snapping, in both directions', () => {
    const cam = new Camera(W, H);
    cam.snapTo(1000, 900, LEVEL_W, LEVEL_H);
    cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, -1);
    const afterOne = Math.abs(cam.lookOff);
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(20); // a glide, not a jump cut
  });

  it('recentres even if the key is released mid-pan', () => {
    const cam = new Camera(W, H);
    cam.snapTo(1000, 900, LEVEL_W, LEVEL_H);
    for (let i = 0; i < 8; i++) cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, -1);
    expect(cam.lookOff).not.toBe(0);
    for (let i = 0; i < 200; i++) cam.update(1000, 900, 0, 1, LEVEL_W, LEVEL_H, 0);
    expect(cam.lookOff).toBe(0);
  });
});

describe('Launch ramps ease back down', () => {
  it.each(LEVELS.map((d) => [d.name, d] as const))(
    '%s never leaves a cliff just past a launcher',
    (_name, def) => {
      // A launcher tops out above the surrounding ground. If the level drops
      // straight back to the base row after the pad, anyone arriving too slow
      // to fire the board walks off a multi-tile cliff.
      const level = new Level(def);
      expect(level.launchers.length).toBeGreaterThan(0);

      const surfaceAt = (px: number): number | null => {
        for (let ty = 0; ty < level.map.h; ty++) {
          const tile = level.map.get(Math.floor(px / T), ty, 0);
          if (tile.oneWay) continue;
          const h = tile.heights[px % T];
          if (h > 0) return (ty + 1) * T - h;
        }
        return null;
      };

      for (const l of level.launchers) {
        for (let px = Math.floor(l.x); px < l.x + 10 * T; px++) {
          const a = surfaceAt(px);
          const b = surfaceAt(px + 1);
          if (a === null || b === null) continue;
          const drop = b - a; // positive = ground falls away to the right
          expect(
            drop,
            `cliff of ${drop}px at x=${px + 1} (tile ${Math.round((px + 1) / T)}), just past the launcher at tile ${Math.round(l.x / T)}`,
          ).toBeLessThanOrEqual(8);
        }
      }
    },
  );
});
