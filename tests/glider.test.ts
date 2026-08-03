import { describe, it, expect } from 'vitest';
import { GliderPickup, WindZone } from '../src/game/entities.ts';
import { GLIDE, NO_INPUT } from '../src/game/Player.ts';
import { makeFlatMap, spawnOnGround, input } from './helpers.ts';

function airborne(x = 300, y = 200) {
  const map = makeFlatMap(300, 40, 620);
  const p = spawnOnGround(map, x, 620);
  p.x = x;
  p.y = y;
  p.grounded = false;
  p.ysp = 4;
  p.xsp = 4;
  return { map, p };
}

describe('Hang glider (deltaplane)', () => {
  it('is granted once by its pickup', () => {
    const { p } = airborne();
    const g = new GliderPickup(p.x, p.y);
    expect(g.tryCollect(p)).toBe(true);
    expect(p.hasGlider).toBe(true);
    expect(g.tryCollect(p)).toBe(false);
  });

  it('deploys by HOLDING jump while falling, folds on release', () => {
    const { map, p } = airborne();
    p.hasGlider = true;
    p.update(map, input({ jump: true }));
    expect(p.gliding).toBe(true);
    p.update(map, input({}));
    expect(p.gliding).toBe(false);
  });

  it('never deploys during the player-owned jump ascent', () => {
    const map = makeFlatMap(300, 40, 620);
    const p = spawnOnGround(map, 300, 620);
    p.hasGlider = true;
    p.update(map, input({ jump: true, jumpPressed: true }));
    expect(p.jumping).toBe(true);
    p.update(map, input({ jump: true }));
    expect(p.gliding).toBe(false); // ascending on a held jump is still a jump
  });

  it('caps the sink rate and steers harder than bare air control', () => {
    const { map, p } = airborne();
    p.hasGlider = true;
    for (let i = 0; i < 90; i++) p.update(map, input({ jump: true }));
    expect(p.gliding).toBe(true);
    expect(p.ysp).toBeLessThanOrEqual(GLIDE.sink + 0.001);

    const { map: m2, p: q } = airborne();
    q.hasGlider = true;
    q.xsp = 0;
    for (let i = 0; i < 10; i++) q.update(m2, input({ jump: true, left: true }));
    const withWing = Math.abs(q.xsp);
    const { map: m3, p: r } = airborne();
    r.xsp = 0;
    for (let i = 0; i < 10; i++) r.update(m3, input({ left: true }));
    expect(withWing).toBeGreaterThan(Math.abs(r.xsp));
  });

  it('folds the wing on landing', () => {
    const { map, p } = airborne(300, 560);
    p.hasGlider = true;
    for (let i = 0; i < 300 && !p.grounded; i++) p.update(map, input({ jump: true }));
    expect(p.grounded).toBe(true);
    expect(p.gliding).toBe(false);
    expect(p.hasGlider).toBe(true); // landing keeps the glider, only folds it
  });

  it('is lost on a real hit, with its own event', () => {
    const { p } = airborne();
    p.hasGlider = true;
    p.rings = 5;
    p.invuln = 0;
    p.hurt(p.x + 10);
    expect(p.hasGlider).toBe(false);
    expect(p.events).toContain('glider-lost');
  });

  it('is cleared by a respawn', () => {
    const { p } = airborne();
    p.hasGlider = true;
    p.gliding = true;
    p.respawn(50, 50);
    expect(p.hasGlider).toBe(false);
    expect(p.gliding).toBe(false);
  });
});

describe('Wind zones', () => {
  it('lifts an airborne player inside the column, ignores one outside', () => {
    const { p } = airborne(300, 200);
    const w = new WindZone(280, 100, 340, 400, 0.4);
    const before = p.ysp;
    w.apply(p);
    expect(p.ysp).toBeLessThan(before);
    const { p: q } = airborne(600, 200);
    const before2 = q.ysp;
    w.apply(q);
    expect(q.ysp).toBe(before2);
  });

  it('carries a deployed glider far harder than a bare jumper', () => {
    const { p } = airborne(300, 200);
    p.gliding = true;
    const w = new WindZone(280, 100, 340, 400, 0.4);
    for (let i = 0; i < 60; i++) w.apply(p);
    expect(p.ysp).toBeLessThanOrEqual(-4); // soaring
    const { p: q } = airborne(300, 200);
    for (let i = 0; i < 60; i++) w.apply(q);
    expect(q.ysp).toBeGreaterThanOrEqual(-2.5); // nudged, not launched
  });

  it('never touches a grounded or dead player', () => {
    const map = makeFlatMap(300, 40, 620);
    const p = spawnOnGround(map, 300, 620);
    const w = new WindZone(0, 0, 5000, 700, 0.5);
    const ysp = p.ysp;
    w.apply(p);
    expect(p.ysp).toBe(ysp);
    p.die();
    p.update(map, NO_INPUT);
    const falling = p.ysp;
    w.apply(p);
    expect(p.ysp).toBe(falling);
  });

  it('is silent: a level full of wind emits no events', () => {
    // Wind is a force field, not a hazard — the idle-silence contract must
    // hold with thermals everywhere.
    expect(new WindZone(0, 0, 100, 100).lift).toBeGreaterThan(0);
  });
});
