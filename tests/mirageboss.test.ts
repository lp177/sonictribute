import { describe, it, expect } from 'vitest';
import { MirageBoss, AFTERIMAGE_LIFE, AFTERIMAGE_ARM } from '../src/game/MirageBoss.ts';
import { Player } from '../src/game/Player.ts';

/** Arena mirroring the Noon Tomorrow fight: ground at y=336. */
function makeBoss() {
  return new MirageBoss(4600, 336, 254 * 16, 294 * 16);
}

function farPlayer() {
  return new Player(4200, 300);
}

/** Run the pattern until `phase` is reached, returning everything emitted. */
function advanceTo(b: MirageBoss, phase: string, p: Player, limit = 1500): string[] {
  const events: string[] = [];
  for (let i = 0; i < limit && b.phase !== phase; i++) events.push(...b.update(p));
  expect(b.phase).toBe(phase);
  return events;
}

/** A stomping hero placed on the pacer. */
function stomper(b: MirageBoss) {
  const p = new Player(b.x, b.y);
  p.jumping = true;
  p.grounded = false;
  return p;
}

describe('MirageBoss — pattern', () => {
  it('resolves out of the glare during the intro, then paces on the floor', () => {
    const b = makeBoss();
    const p = farPlayer();
    expect(b.phase).toBe('intro');
    expect(b.y).toBeLessThan(b.standY); // starts overhead
    advanceTo(b, 'pace', p);
    expect(b.y).toBe(b.standY);
    for (let i = 0; i < 60; i++) b.update(p);
    expect(b.y).toBe(b.standY); // a ground racer: it never leaves the floor
  });

  it('cycles pace -> trace -> derez -> pace', () => {
    const b = makeBoss();
    const p = farPlayer();
    const order: string[] = [];
    let prev: string = b.phase;
    for (let i = 0; i < 2000; i++) {
      b.update(p);
      if (b.phase !== prev) {
        order.push(b.phase);
        prev = b.phase;
      }
    }
    expect(order.slice(0, 4)).toEqual(['pace', 'trace', 'derez', 'pace']);
  });

  it('sprints back and forth, turning at the arena walls', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    expect(b.facing).toBe(-1); // opens running at the incoming player
    const seen = new Set<number>();
    for (let i = 0; i < 800; i++) {
      b.update(p);
      b.timer = 1; // hold the pace phase: this test is about the sprint alone
      seen.add(b.facing);
      expect(b.x).toBeGreaterThanOrEqual(b.minX);
      expect(b.x).toBeLessThanOrEqual(b.maxX);
    }
    expect(seen).toEqual(new Set([1, -1])); // both walls were reached and turned at
  });

  it('telegraphs and brakes to a standstill before tracing', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    const events = advanceTo(b, 'trace', p);
    const tell = events.indexOf('boss-telegraph');
    const trace = events.indexOf('boss-trace');
    expect(tell).toBeGreaterThanOrEqual(0);
    expect(trace).toBeGreaterThan(tell);
    // The burst always launches from a readable standstill.
    expect(b.speed).toBe(0);
  });

  it('trace outruns pace speed and lays a spread of stationary afterimages', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    for (let i = 0; i < 60; i++) b.update(p);
    const cruise = b.speed;
    expect(cruise).toBeGreaterThan(0);
    advanceTo(b, 'trace', p);
    for (let i = 0; i < 150; i++) b.update(p);
    expect(b.speed).toBeGreaterThan(cruise);
    expect(b.afterimages.length).toBeGreaterThan(8);
    // Laid along the path, not piled at the launch point.
    const xs = b.afterimages.map((a) => a.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(200);
    // Stationary hazards: nothing moves once frozen.
    const snap = b.afterimages.map((a) => ({ x: a.x, y: a.y }));
    b.update(p);
    for (let i = 0; i < snap.length; i++) {
      expect(b.afterimages[i].x).toBe(snap[i].x);
      expect(b.afterimages[i].y).toBe(snap[i].y);
    }
  });

  it('afterimages expire at the end of their lifetime', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    b.afterimages = [{ x: b.x + 100, y: b.standY, age: AFTERIMAGE_LIFE - 1 }];
    b.update(p);
    expect(b.afterimages).toHaveLength(0);
  });

  it('derez is telegraphed, stationary, and flushes the afterimages fast', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'trace', p);
    const events = advanceTo(b, 'derez', p);
    expect(events).toContain('boss-derez');
    b.afterimages.push({ x: b.x + 200, y: b.standY, age: 0 }); // freshest possible line
    const x0 = b.x;
    for (let i = 0; i < 70; i++) b.update(p);
    expect(b.phase).toBe('derez');
    expect(b.x).toBe(x0); // overheated: it does not move
    // Even a brand-new image is gone well inside the window: the flush is
    // what opens an approach path to the stalled boss.
    expect(b.afterimages).toHaveLength(0);
    const rez = advanceTo(b, 'pace', p);
    expect(rez).toContain('boss-rez');
  });

  it('derez01 ramps in, survives a timer-resetting hit, and decays after', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'derez', p);
    for (let i = 0; i < 30; i++) b.update(p);
    expect(b.derez01).toBeGreaterThan(0.9);
    const before = b.derez01;
    expect(b.interact(stomper(b))).toBe('hit');
    expect(b.timer).toBe(0); // the window was extended...
    expect(b.derez01).toBe(before); // ...but the glitch meter did not snap
    b.update(p);
    expect(b.derez01).toBeGreaterThan(0.9);
    advanceTo(b, 'pace', p);
    for (let i = 0; i < 40; i++) {
      b.update(p);
      b.timer = 1;
    }
    expect(b.derez01).toBeLessThan(before);
  });

  it('the run-cycle clock follows distance, freezing when the boss stalls', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'trace', p);
    const mid = b.runT;
    expect(mid).toBeGreaterThan(0); // accumulated through the whole pace sprint
    advanceTo(b, 'derez', p);
    expect(b.runT).toBeGreaterThan(mid); // phase changes never reset it
    const stalled = b.runT;
    for (let i = 0; i < 20; i++) b.update(p);
    expect(b.runT).toBe(stalled); // stood still, so the legs must not pump
  });
});

describe('MirageBoss — interaction', () => {
  it('mid-sprint a stomp bounces off harmlessly, but a roll is burned', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    const hero = stomper(b);
    expect(b.interact(hero)).toBeNull();
    expect(b.hp).toBe(b.maxHp);
    expect(hero.ysp).toBeLessThan(0); // shrugged off
    const roller = new Player(b.x, b.y);
    roller.rolling = true;
    roller.grounded = true;
    expect(b.interact(roller)).toBe('hurt'); // hard light must be jumped
    expect(b.hp).toBe(b.maxHp);
  });

  it('hurts a non-attacking player on contact without applying damage itself', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    const hero = new Player(b.x, b.y);
    hero.rings = 3;
    expect(b.interact(hero)).toBe('hurt');
    // Damage is the Level's job (single damage path).
    expect(hero.rings).toBe(3);
  });

  it('takes damage only while derezzed, with i-frames and window extension', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'derez', p);
    b.afterimages = []; // isolate the body from its own trail
    b.timer = 100; // nearly cooled off
    const hero = stomper(b);
    expect(b.interact(hero)).toBe('hit');
    expect(b.hp).toBe(b.maxHp - 1);
    expect(b.invuln).toBeGreaterThan(0);
    expect(b.timer).toBe(0); // hitting it keeps the window open a moment longer
    expect(b.interact(hero)).toBeNull(); // i-frames
  });

  it('afterimages hurt in ANY form, but only once they have armed', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'pace', p);
    b.afterimages = [{ x: b.x + 200, y: b.standY, age: AFTERIMAGE_ARM }];
    const roller = new Player(b.x + 200, b.standY);
    roller.rolling = true;
    expect(b.interact(roller)).toBe('hurt');
    // Still solidifying: a line materialising inside a chasing hero is free.
    b.afterimages[0].age = AFTERIMAGE_ARM - 1;
    expect(b.interact(roller)).toBeNull();
  });

  it('an afterimage overlapping the body wins over a free hit', () => {
    // Rolling into the derezzed boss through a line laid across it must cost
    // the player, not damage the boss.
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'derez', p);
    b.invuln = 0;
    b.afterimages = [{ x: b.x, y: b.standY, age: 10 }];
    const roller = new Player(b.x, b.y);
    roller.rolling = true;
    expect(b.interact(roller)).toBe('hurt');
    expect(b.hp).toBe(b.maxHp);
  });

  it('stays clamped inside the arena through full cycles', () => {
    const b = makeBoss();
    const p = farPlayer();
    for (let i = 0; i < 3000; i++) {
      b.update(p);
      expect(b.x).toBeGreaterThanOrEqual(b.minX);
      expect(b.x).toBeLessThanOrEqual(b.maxX);
    }
  });

  it('is defeated after maxHp hits, clearing its afterimages for good', () => {
    const b = makeBoss();
    const p = farPlayer();
    const hero = stomper(b);
    for (let i = 0; i < b.maxHp; i++) {
      b.phase = 'derez';
      b.y = b.standY;
      b.invuln = 0;
      hero.x = b.x;
      hero.y = b.y;
      hero.jumping = true;
      hero.grounded = false;
      b.afterimages = [{ x: b.x + 300, y: b.standY, age: 20 }];
      expect(b.interact(hero)).toBe('hit');
    }
    expect(b.hp).toBe(0);
    expect(b.defeated).toBe(true);
    expect(b.afterimages).toHaveLength(0);
    expect(b.interact(hero)).toBeNull();
    // And it never runs or lays again.
    for (let i = 0; i < 300; i++) expect(b.update(p)).toHaveLength(0);
    expect(b.afterimages).toHaveLength(0);
  });

  it('is deterministic: identical runs produce identical state and events', () => {
    const a = makeBoss();
    const c = makeBoss();
    const pa = farPlayer();
    const pc = farPlayer();
    const ea: string[] = [];
    const ec: string[] = [];
    for (let i = 0; i < 1200; i++) {
      // Same scripted wander for both, so any divergence is the boss's own.
      const x = 4300 + Math.sin(i / 37) * 200;
      pa.x = x;
      pc.x = x;
      ea.push(...a.update(pa));
      ec.push(...c.update(pc));
    }
    expect(ea).toEqual(ec);
    expect(ea.length).toBeGreaterThan(0);
    expect({ x: a.x, y: a.y, phase: a.phase, hp: a.hp, images: a.afterimages }).toEqual({
      x: c.x,
      y: c.y,
      phase: c.phase,
      hp: c.hp,
      images: c.afterimages,
    });
  });
});
