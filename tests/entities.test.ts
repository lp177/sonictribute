import { describe, it, expect } from 'vitest';
import {
  Ring,
  ScatteredRing,
  Spring,
  Monitor,
  Spikes,
  Crystal,
  Checkpoint,
  SnapCrab,
  GoalSign,
} from '../src/game/entities.ts';
import { makeFlatMap, spawnOnGround, run } from './helpers.ts';

function standingPlayer() {
  const map = makeFlatMap();
  const p = spawnOnGround(map, 100, 240);
  return { map, p };
}

describe('Ring', () => {
  it('is collected on overlap and increments rings', () => {
    const { p } = standingPlayer();
    const r = new Ring(p.x, p.y);
    expect(r.tryCollect(p)).toBe(true);
    expect(p.rings).toBe(1);
    expect(r.tryCollect(p)).toBe(false); // only once
  });

  it('is not collected when far away', () => {
    const { p } = standingPlayer();
    expect(new Ring(p.x + 50, p.y).tryCollect(p)).toBe(false);
  });
});

describe('ScatteredRing', () => {
  it('bounces on the ground and expires', () => {
    const { map, p } = standingPlayer();
    const s = new ScatteredRing(p.x, 100, 1, 0);
    let bounced = false;
    for (let i = 0; i < 200; i++) {
      const prevYsp = s.ysp;
      s.update(map, 0);
      if (s.ysp < 0 && prevYsp > 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(s.alive).toBe(true);
    for (let i = 0; i < 60; i++) s.update(map, 0);
    expect(s.alive).toBe(false);
  });

  it('cannot be collected during the grace period', () => {
    const { p } = standingPlayer();
    const s = new ScatteredRing(p.x, p.y, 0, 0);
    expect(s.tryCollect(p)).toBe(false);
    s.age = 31;
    expect(s.tryCollect(p)).toBe(true);
  });
});

describe('Spring', () => {
  it('launches a falling player upward and enters cooldown', () => {
    const { p } = standingPlayer();
    p.grounded = false;
    p.ysp = 2; // falling
    const s = new Spring(p.x, p.y, 'up', 10);
    expect(s.tryTrigger(p)).toBe(true);
    expect(p.ysp).toBe(-10);
    expect(s.tryTrigger(p)).toBe(false); // cooldown
  });

  it('does not trigger on a rising player', () => {
    const { p } = standingPlayer();
    p.grounded = false;
    p.ysp = -3;
    expect(new Spring(p.x, p.y, 'up', 10).tryTrigger(p)).toBe(false);
  });
});

describe('Monitor', () => {
  it('only breaks for an attacking player', () => {
    const { p } = standingPlayer();
    const m = new Monitor(p.x, p.y, 'rings10');
    expect(m.tryBreak(p)).toBeNull(); // standing, not ball form
    p.rolling = true;
    expect(m.tryBreak(p)).toBe('rings10');
    expect(p.rings).toBe(10);
    expect(m.tryBreak(p)).toBeNull(); // already broken
  });

  it('grants shield and shoes', () => {
    const { p } = standingPlayer();
    p.jumping = true;
    new Monitor(p.x, p.y, 'shield').tryBreak(p);
    expect(p.shield).toBe(true);
    new Monitor(p.x, p.y, 'shoes').tryBreak(p);
    expect(p.shoes).toBeGreaterThan(0);
  });
});

describe('Spikes / Crystal / Checkpoint / GoalSign', () => {
  it('spikes detect contact', () => {
    const { p } = standingPlayer();
    expect(new Spikes(p.x, p.y + 14).touches(p)).toBe(true);
    expect(new Spikes(p.x + 60, p.y + 14).touches(p)).toBe(false);
  });

  it('crystal is collected once without granting rings', () => {
    const { p } = standingPlayer();
    const c = new Crystal(p.x, p.y, 0);
    expect(c.tryCollect(p)).toBe(true);
    expect(p.rings).toBe(0);
    expect(c.tryCollect(p)).toBe(false);
  });

  it('checkpoint activates once when passed', () => {
    const { p } = standingPlayer();
    const c = new Checkpoint(p.x, 240);
    expect(c.tryActivate(p)).toBe(true);
    expect(c.tryActivate(p)).toBe(false);
  });

  it('goal triggers once and finishes the player', () => {
    const { p } = standingPlayer();
    const g = new GoalSign(p.x, 240);
    expect(g.tryTrigger(p)).toBe(true);
    expect(p.finished).toBe(true);
    expect(g.tryTrigger(p)).toBe(false);
  });
});

describe('SnapCrab', () => {
  it('patrols between its bounds', () => {
    const e = new SnapCrab(100, 233, 80, 120);
    for (let i = 0; i < 200; i++) e.update();
    expect(e.x).toBeGreaterThanOrEqual(80);
    expect(e.x).toBeLessThanOrEqual(120);
  });

  it('is destroyed by an attacking player, hurts a vulnerable one', () => {
    const { map, p } = standingPlayer();
    const e = new SnapCrab(p.x, p.y, 0, 200);
    expect(e.interact(p)).toBe('hurt');
    p.rings = 5;
    p.hurt(e.x);
    run(map, p, 130); // wait out invulnerability
    p.x = e.x; // knockback moved the player; step back in
    p.y = e.y;
    p.rolling = true;
    expect(e.interact(p)).toBe('kill');
    expect(e.alive).toBe(false);
    expect(e.interact(p)).toBeNull();
  });
});
