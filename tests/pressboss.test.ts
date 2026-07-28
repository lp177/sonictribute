import { describe, it, expect } from 'vitest';
import { PressBoss } from '../src/game/PressBoss.ts';
import { Player } from '../src/game/Player.ts';

/** Arena mirroring the zone 2 fight: ground at y=336. */
function makeBoss() {
  return new PressBoss(4600, 336, 254 * 16, 294 * 16);
}

function farPlayer() {
  return new Player(4200, 300);
}

describe('PressBoss — pattern', () => {
  it('descends during intro, then hovers', () => {
    const b = makeBoss();
    const p = farPlayer();
    expect(b.phase).toBe('intro');
    expect(b.y).toBeLessThan(b.homeY);
    for (let i = 0; i < 300 && b.phase === 'intro'; i++) b.update(p);
    expect(b.phase).toBe('hover');
    expect(Math.abs(b.y - b.homeY)).toBeLessThan(3);
  });

  it('tracks the player while hovering, clamped to the arena', () => {
    const b = makeBoss();
    b.phase = 'hover';
    b.y = b.homeY;
    const p = farPlayer();
    p.x = b.x - 200;
    const x0 = b.x;
    for (let i = 0; i < 40; i++) {
      b.update(p);
      b.timer = 0; // hold the hover phase for this check
    }
    expect(b.x).toBeLessThan(x0);
    p.x = 0; // way outside the arena
    for (let i = 0; i < 600; i++) {
      b.update(p);
      b.timer = 0;
    }
    expect(b.x).toBeGreaterThanOrEqual(b.minX);
  });

  it('telegraphs, slams to the floor and releases two shockwaves', () => {
    const b = makeBoss();
    const p = farPlayer();
    b.phase = 'hover';
    b.y = b.homeY;
    b.timer = 111; // hover done
    b.update(p);
    expect(b.phase).toBe('telegraph');
    const events: string[] = [];
    for (let i = 0; i < 200 && (b.phase as string) !== 'open'; i++) events.push(...b.update(p));
    expect(b.phase).toBe('open');
    expect(events).toContain('boss-telegraph');
    expect(events).toContain('boss-slam');
    expect(b.shockwaves).toHaveLength(2);
    expect(b.y).toBe(b.groundY - 18);
    // Shockwaves run in opposite directions, then expire.
    const [l, r] = b.shockwaves;
    expect(l.dir).toBe(-1);
    expect(r.dir).toBe(1);
    const lx = l.x;
    const rx = r.x;
    b.update(p);
    expect(b.shockwaves[0].x).toBeLessThan(lx);
    expect(b.shockwaves[1].x).toBeGreaterThan(rx);
    for (let i = 0; i < 90; i++) b.update(p);
    expect(b.shockwaves).toHaveLength(0);
  });

  it('rises again after the open window', () => {
    const b = makeBoss();
    const p = farPlayer();
    b.phase = 'open';
    b.y = b.groundY - 18;
    b.timer = 91;
    b.update(p);
    expect(b.phase).toBe('rise');
    for (let i = 0; i < 200 && (b.phase as string) === 'rise'; i++) b.update(p);
    expect(b.phase).toBe('hover');
    expect(b.y).toBe(b.homeY);
  });
});

describe('PressBoss — interaction', () => {
  it('is armoured outside the open window: attacks bounce off, no damage', () => {
    const b = makeBoss();
    b.phase = 'hover';
    b.y = b.homeY;
    const p = new Player(b.x, b.y);
    p.jumping = true;
    p.grounded = false;
    expect(b.interact(p)).toBeNull();
    expect(b.hp).toBe(b.maxHp);
    expect(p.ysp).toBeLessThan(0); // shrugged off
  });

  it('takes stomp damage only while open', () => {
    const b = makeBoss();
    b.phase = 'open';
    b.y = b.groundY - 18;
    const p = new Player(b.x, b.y);
    p.jumping = true;
    p.grounded = false;
    expect(b.interact(p)).toBe('hit');
    expect(b.hp).toBe(b.maxHp - 1);
    expect(b.invuln).toBeGreaterThan(0);
    expect(b.interact(p)).toBeNull(); // i-frames
  });

  it('hurts a non-attacking player on body contact', () => {
    const b = makeBoss();
    b.phase = 'hover';
    b.y = b.homeY;
    const p = new Player(b.x, b.y);
    expect(b.interact(p)).toBe('hurt');
  });

  it('shockwaves hurt even a rolling player (must be jumped)', () => {
    const b = makeBoss();
    b.phase = 'open';
    b.y = b.groundY - 18;
    b.shockwaves.push({ x: b.x + 120, dir: 1, age: 5 });
    const p = new Player(b.x + 120, b.groundY - 10);
    p.rolling = true;
    expect(b.interact(p)).toBe('hurt');
  });

  it('a shockwave overlapping the body wins over a free hit', () => {
    // Waves spawn at x±24 and briefly overlap the pod's own flank; rolling
    // into the boss at that instant must cost you, not damage it.
    const b = makeBoss();
    b.phase = 'open';
    b.y = b.groundY - 18;
    b.invuln = 0;
    b.shockwaves.push({ x: b.x + 24, dir: 1, age: 0 });
    const p = new Player(b.x + 20, b.groundY - 14);
    p.rolling = true;
    const before = b.hp;
    expect(b.interact(p)).toBe('hurt');
    expect(b.hp).toBe(before);
  });

  it('hitting it while open extends the vulnerable window', () => {
    const b = makeBoss();
    b.phase = 'open';
    b.y = b.groundY - 18;
    b.timer = 80; // nearly closed
    b.invuln = 0;
    const p = new Player(b.x, b.y);
    p.jumping = true;
    p.grounded = false;
    expect(b.interact(p)).toBe('hit');
    expect(b.timer).toBe(0);
  });

  it('stays inside the arena on the right as well as the left', () => {
    const b = makeBoss();
    b.phase = 'hover';
    b.y = b.homeY;
    const p = farPlayer();
    p.x = 1e6; // far outside the arena
    for (let i = 0; i < 600; i++) {
      b.update(p);
      b.timer = 0;
    }
    expect(b.x).toBeLessThanOrEqual(b.maxX);
  });

  it('is defeated after maxHp opens and clears its shockwaves', () => {
    const b = makeBoss();
    const p = new Player(b.x, 0);
    p.jumping = true;
    p.grounded = false;
    for (let i = 0; i < b.maxHp; i++) {
      b.phase = 'open';
      b.y = b.groundY - 18;
      b.invuln = 0;
      p.x = b.x;
      p.y = b.y;
      p.jumping = true;
      expect(b.interact(p)).toBe('hit');
    }
    expect(b.defeated).toBe(true);
    expect(b.shockwaves).toHaveLength(0);
    expect(b.interact(p)).toBeNull();
  });
});
