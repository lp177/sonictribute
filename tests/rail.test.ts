import { describe, it, expect } from 'vitest';
import { Rail, RAIL } from '../src/game/entities.ts';
import { NO_INPUT } from '../src/game/Player.ts';
import { makeFlatMap, spawnOnGround, input } from './helpers.ts';

/** Puts a falling player right on top of a rail at `x`. */
function faller(rail: Rail, x: number) {
  const map = makeFlatMap(300, 40, 600);
  const p = spawnOnGround(map, x, 600);
  p.x = x;
  p.y = rail.yAt(x)! - p.h;
  p.grounded = false;
  p.ysp = 3;
  p.xsp = 6;
  p.gsp = 6;
  return { map, p };
}

describe('Grind rail', () => {
  it('stores its ends left-to-right whichever way it is declared', () => {
    const a = new Rail(100, 200, 400, 260);
    const b = new Rail(400, 260, 100, 200);
    expect(a.yAt(250)).toBeCloseTo(b.yAt(250)!, 6);
    expect(a.yAt(100)).toBe(200);
    expect(a.yAt(400)).toBe(260);
  });

  it('reports nothing past its ends', () => {
    const r = new Rail(100, 200, 400, 200);
    expect(r.yAt(99)).toBeNull();
    expect(r.yAt(401)).toBeNull();
  });

  it('catches a player landing on it', () => {
    const r = new Rail(100, 300, 800, 300);
    const { p } = faller(r, 400);
    expect(r.tryCatch(p)).toBe(true);
    expect(p.railing).toBe(true);
    expect(p.railDir).toBe(1);
  });

  it('never catches a player rising through it', () => {
    const r = new Rail(100, 300, 800, 300);
    const { p } = faller(r, 400);
    p.ysp = -6; // jumping up through the rail
    expect(r.tryCatch(p)).toBe(false);
    expect(p.railing).toBe(false);
  });

  it('never catches from far away', () => {
    const r = new Rail(100, 300, 800, 300);
    const { p } = faller(r, 400);
    p.y -= 200;
    expect(r.tryCatch(p)).toBe(false);
  });

  it('carries the player along and holds them on the line', () => {
    const r = new Rail(100, 300, 800, 400); // descends to the right
    const { p } = faller(r, 200);
    r.tryCatch(p);
    for (let i = 0; i < 30; i++) expect(r.carry(p)).toBe(true);
    expect(p.x).toBeGreaterThan(200);
    expect(p.y + p.h).toBeCloseTo(r.yAt(p.x)!, 4);
    expect(p.grounded).toBe(true);
  });

  it('gains speed downhill and bleeds it uphill', () => {
    // Compare each rail against ITS OWN starting speed: the two rides start
    // from different speeds, so their end speeds are not comparable.
    const down = new Rail(100, 300, 900, 460);
    const a = faller(down, 200).p;
    down.tryCatch(a);
    a.gsp = 12;
    a.xsp = 12;
    const aStart = a.gsp;
    for (let i = 0; i < 40; i++) down.carry(a);
    expect(a.gsp).toBeGreaterThan(aStart);

    const up = new Rail(100, 460, 900, 300);
    const b = faller(up, 200).p;
    up.tryCatch(b);
    b.gsp = 12;
    b.xsp = 12;
    const bStart = b.gsp;
    for (let i = 0; i < 40; i++) up.carry(b);
    expect(b.gsp).toBeLessThan(bStart);

    expect(Math.abs(a.gsp)).toBeLessThanOrEqual(RAIL.max);
    expect(Math.abs(b.gsp)).toBeGreaterThanOrEqual(RAIL.min);
  });

  it('never drops below the minimum ride speed', () => {
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 200);
    r.tryCatch(p);
    p.gsp = 0.2;
    r.carry(p);
    expect(Math.abs(p.gsp)).toBeGreaterThanOrEqual(RAIL.min);
  });

  it('sets the rider down exactly on the tip when the rail runs out', () => {
    // Regression: `carry` used to advance x past the end and bail without
    // touching y, launching the player from last frame's height — which, on a
    // rail ending flush with a one-way platform, put them inside it.
    const r = new Rail(100, 300, 260, 380);
    const { p } = faller(r, 240);
    r.tryCatch(p);
    while (r.carry(p)) { /* ride to the end */ }
    expect(p.x).toBe(r.x1);
    expect(p.y + p.h).toBeCloseTo(r.y1, 6);
  });

  it('ends the ride when the rail runs out', () => {
    const r = new Rail(100, 300, 260, 300);
    const { p } = faller(r, 240);
    r.tryCatch(p);
    let carried = 0;
    while (r.carry(p) && carried < 200) carried++;
    expect(carried).toBeLessThan(200);
    expect(p.x).toBeGreaterThan(250);
  });

  it('lets the player jump off under their own power', () => {
    const map = makeFlatMap(300, 40, 600);
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 400);
    r.tryCatch(p);
    r.carry(p);
    const speed = p.gsp;
    p.update(map, input({ jump: true, jumpPressed: true }));
    expect(p.railing).toBe(false);
    expect(p.jumping).toBe(true);
    expect(p.ysp).toBeLessThan(0);
    expect(p.xsp).toBeCloseTo(speed, 4); // keeps the momentum it earned
  });

  it('ignores steering while locked on: the rail is the ride', () => {
    const map = makeFlatMap(300, 40, 600);
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 400);
    r.tryCatch(p);
    r.carry(p);
    const before = p.gsp;
    p.update(map, input({ left: true }));
    expect(p.railing).toBe(true);
    expect(p.gsp).toBe(before);
  });

  it('uncurls a rolling player onto the rail', () => {
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 400);
    p.rolling = true;
    r.tryCatch(p);
    expect(p.railing).toBe(true);
    expect(p.rolling).toBe(false);
  });

  it('is cleared by a respawn', () => {
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 400);
    r.tryCatch(p);
    p.respawn(50, 50);
    expect(p.railing).toBe(false);
  });

  it('does not catch a dead player', () => {
    const r = new Rail(100, 300, 900, 300);
    const { p } = faller(r, 400);
    p.die();
    expect(r.tryCatch(p)).toBe(false);
  });

  it('a player standing still on flat ground is not grabbed', () => {
    const map = makeFlatMap(300, 40, 600);
    const p = spawnOnGround(map, 400, 600);
    const r = new Rail(100, 100, 900, 100); // way above
    p.update(map, NO_INPUT);
    expect(r.tryCatch(p)).toBe(false);
  });
});
