import { describe, it, expect } from 'vitest';
import { CrystalBoss } from '../src/game/CrystalBoss.ts';
import { Player } from '../src/game/Player.ts';

/** Arena mirroring the Chrono Vault fight: ground at y=336. */
function makeBoss() {
  return new CrystalBoss(4600, 336, 254 * 16, 294 * 16);
}

function farPlayer() {
  return new Player(4300, 300);
}

/** Run the pattern until `phase` is reached, returning everything emitted. */
function advanceTo(b: CrystalBoss, phase: string, p: Player, limit = 1500): string[] {
  const events: string[] = [];
  for (let i = 0; i < limit && b.phase !== phase; i++) events.push(...b.update(p));
  expect(b.phase).toBe(phase);
  return events;
}

/** A stomping hero placed on the rig. */
function stomper(b: CrystalBoss) {
  const p = new Player(b.x, b.y);
  p.jumping = true;
  p.grounded = false;
  return p;
}

describe('CrystalBoss — pattern', () => {
  it('drops in during the intro, then drills under the floor', () => {
    const b = makeBoss();
    const p = farPlayer();
    expect(b.phase).toBe('intro');
    expect(b.y).toBeLessThan(b.surfaceY);
    const events = advanceTo(b, 'burrow', p);
    expect(events).toContain('boss-dig');
    for (let i = 0; i < 30; i++) b.update(p);
    expect(b.buried).toBe(true);
    expect(b.emergence).toBe(0);
  });

  it('cycles burrow -> surface -> shards -> vulnerable -> burrow', () => {
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
    expect(order.slice(0, 5)).toEqual(['burrow', 'surface', 'shards', 'vulnerable', 'burrow']);
  });

  it('tracks the player underground while burrowed', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'burrow', p);
    for (let i = 0; i < 20; i++) b.update(p); // finish sinking
    p.x = b.x - 400;
    const x0 = b.x;
    for (let i = 0; i < 40 && b.phase === 'burrow'; i++) b.update(p);
    expect(b.x).toBeLessThan(x0);
  });

  it('telegraphs the spot before erupting out of it', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'burrow', p);
    const events = advanceTo(b, 'shards', p);
    const tell = events.indexOf('boss-telegraph');
    const burst = events.indexOf('boss-burst');
    expect(tell).toBeGreaterThanOrEqual(0);
    expect(burst).toBeGreaterThan(tell);
    // The rig ends the eruption stood on the cavern floor.
    expect(b.y).toBe(b.surfaceY);
    expect(b.emergence).toBe(1);
  });

  it('holds still once it has committed to a surfacing spot', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'burrow', p);
    for (let i = 0; i < 200 && b.phase === 'burrow'; i++) {
      if (b.timer === 90) break; // past the chase, into the tell
      b.update(p);
    }
    const spot = b.x;
    p.x = b.x - 600; // yanking the player away must not drag the tell with it
    advanceTo(b, 'surface', p);
    expect(b.x).toBe(spot);
  });

  it('fires two volleys of shards that arc and then expire', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'shards', p);
    const events: string[] = [];
    for (let i = 0; i < 40; i++) events.push(...b.update(p));
    expect(events.filter((e) => e === 'boss-shards')).toHaveLength(2);
    expect(b.shards.length).toBe(9);
    // Ballistic: gravity keeps bending each shard downward.
    const s = b.shards[0];
    const vy0 = s.vy;
    b.update(p);
    expect(s.vy).toBeGreaterThan(vy0);
    // Everything is gone well before the next volley.
    for (let i = 0; i < 200; i++) b.update(p);
    expect(b.shards).toHaveLength(0);
  });

  it('aims the second volley at the side the player fled to', () => {
    const b = makeBoss();
    const left = farPlayer();
    advanceTo(b, 'shards', left);
    left.x = b.x - 300;
    const right = new Player(b.x + 300, 300);
    const clone = makeBoss();
    advanceTo(clone, 'shards', right);
    right.x = clone.x + 300;
    for (let i = 0; i < 36; i++) {
      b.update(left);
      clone.update(right);
    }
    // Same fan, leaned opposite ways: the aimed volley's mean drift follows
    // the player rather than the arena.
    const mean = (o: CrystalBoss) => o.shards.reduce((a, s) => a + s.vx, 0) / o.shards.length;
    expect(mean(b)).toBeLessThan(mean(clone));
  });
});

describe('CrystalBoss — interaction', () => {
  it('cannot be touched at all while burrowed', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'burrow', p);
    for (let i = 0; i < 20; i++) b.update(p);
    const hero = stomper(b); // sat right on the buried rig
    expect(b.interact(hero)).toBeNull();
    expect(b.hp).toBe(b.maxHp);
    hero.jumping = false;
    hero.grounded = true;
    expect(b.interact(hero)).toBeNull(); // and it cannot hurt them either
  });

  it('is armoured while surfacing and firing', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'shards', p);
    b.shards = []; // isolate the hull from its own volley
    const hero = stomper(b);
    expect(b.interact(hero)).toBeNull();
    expect(b.hp).toBe(b.maxHp);
    expect(hero.ysp).toBeLessThan(0); // shrugged off
  });

  it('takes stomp damage only in the vulnerable window', () => {
    const b = makeBoss();
    const p = farPlayer();
    advanceTo(b, 'vulnerable', p);
    b.shards = [];
    const hero = stomper(b);
    expect(b.interact(hero)).toBe('hit');
    expect(b.hp).toBe(b.maxHp - 1);
    expect(b.invuln).toBeGreaterThan(0);
    expect(b.interact(hero)).toBeNull(); // i-frames
  });

  it('hitting it extends the vulnerable window', () => {
    const b = makeBoss();
    b.phase = 'vulnerable';
    b.y = b.surfaceY;
    b.timer = 85; // nearly done venting
    b.invuln = 0;
    expect(b.interact(stomper(b))).toBe('hit');
    expect(b.timer).toBe(0);
  });

  it('hurts a non-attacking player on hull contact', () => {
    const b = makeBoss();
    b.phase = 'vulnerable';
    b.y = b.surfaceY;
    const p = new Player(b.x, b.y);
    p.rings = 3;
    expect(b.interact(p)).toBe('hurt');
    // Damage is the Level's job (single damage path).
    expect(p.rings).toBe(3);
  });

  it('shards hurt a ROLLING player: they must be jumped', () => {
    const b = makeBoss();
    b.phase = 'vulnerable';
    b.y = b.surfaceY;
    b.shards = [{ x: b.x + 120, y: b.groundY - 12, vx: 3, vy: 1, age: 20 }];
    const p = new Player(b.x + 120, b.groundY - 12);
    p.rolling = true;
    expect(b.interact(p)).toBe('hurt');
    expect(b.hp).toBe(b.maxHp);
  });

  it('shards stay lethal after the rig has dived again', () => {
    const b = makeBoss();
    b.phase = 'burrow';
    b.y = b.buriedY;
    b.shards = [{ x: b.x - 80, y: b.groundY - 20, vx: -2, vy: -1, age: 10 }];
    const p = new Player(b.x - 80, b.groundY - 20);
    expect(b.interact(p)).toBe('hurt');
  });

  it('a shard overlapping the hull wins over a free hit', () => {
    // Rolling into the rig the instant a shard clips it must cost the player,
    // not damage the boss.
    const b = makeBoss();
    b.phase = 'vulnerable';
    b.y = b.surfaceY;
    b.invuln = 0;
    b.shards = [{ x: b.x, y: b.y - 20, vx: 0, vy: -1, age: 1 }];
    const p = new Player(b.x, b.y - 18);
    p.rolling = true;
    expect(b.interact(p)).toBe('hurt');
    expect(b.hp).toBe(b.maxHp);
  });

  it('stays inside the arena chasing a player off either end', () => {
    for (const target of [-1e6, 1e6]) {
      const b = makeBoss();
      const p = farPlayer();
      p.x = target;
      for (let i = 0; i < 3000; i++) {
        b.update(p);
        expect(b.x).toBeGreaterThanOrEqual(b.minX);
        expect(b.x).toBeLessThanOrEqual(b.maxX);
      }
    }
  });

  it('shatters shards that reach the arena walls', () => {
    const b = makeBoss();
    const p = farPlayer();
    b.phase = 'vulnerable';
    b.y = b.surfaceY;
    b.shards = [
      { x: b.arenaLeft + 10, y: b.groundY - 120, vx: -6, vy: -4, age: 0 },
      { x: b.arenaRight - 10, y: b.groundY - 120, vx: 6, vy: -4, age: 0 },
    ];
    for (let i = 0; i < 4; i++) b.update(p);
    expect(b.shards).toHaveLength(0);
  });

  it('is defeated after maxHp hits, clearing its shards for good', () => {
    const b = makeBoss();
    const p = farPlayer();
    const hero = stomper(b);
    for (let i = 0; i < b.maxHp; i++) {
      b.phase = 'vulnerable';
      b.y = b.surfaceY;
      b.invuln = 0;
      hero.x = b.x;
      hero.y = b.y;
      hero.jumping = true;
      hero.grounded = false;
      b.shards = [{ x: b.x + 60, y: b.groundY - 40, vx: 1, vy: -1, age: 0 }];
      expect(b.interact(hero)).toBe('hit');
    }
    expect(b.hp).toBe(0);
    expect(b.defeated).toBe(true);
    expect(b.shards).toHaveLength(0);
    expect(b.interact(hero)).toBeNull();
    // And it never fires again.
    b.update(p);
    expect(b.shards).toHaveLength(0);
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
    expect({ x: a.x, y: a.y, phase: a.phase, hp: a.hp, shards: a.shards }).toEqual({
      x: c.x,
      y: c.y,
      phase: c.phase,
      hp: c.hp,
      shards: c.shards,
    });
  });
});
