import { describe, it, expect } from 'vitest';
import { Boss } from '../src/game/Boss.ts';
import { Player } from '../src/game/Player.ts';

function makeBoss() {
  // Arena from x=4032 to 4672, ground at 336.
  return new Boss(4576, 336, 4032, 4672);
}

function dummyPlayer(): Player {
  return new Player(4300, 300);
}

describe('Wrecking Pod — the mace must stay readable', () => {
  function armed() {
    const b = new Boss(4600, 336, 4200 - 0, 5000);
    b.phase = 'sway';
    b.y = b.homeY;
    return b;
  }

  it('never teleports the mace when the pod is hit', () => {
    // Regression: the swing was driven by `timer`, which every phase change
    // resets. Hitting the pod snapped the mace to centre, and the end of the
    // stun snapped it again — an unpredictable, unfair weapon.
    const b = armed();
    const p = new Player(0, 0); // far away: no contact
    let prev = b.maceAngle;
    let worstJump = 0;
    for (let f = 0; f < 400; f++) {
      b.update(p);
      if (f === 60) {
        // Land a stomp: this is the moment that used to warp the mace.
        const hero = new Player(b.x, b.y);
        hero.jumping = true;
        hero.grounded = false;
        b.invuln = 0;
        expect(b.interact(hero)).toBe('hit');
      }
      worstJump = Math.max(worstJump, Math.abs(b.maceAngle - prev));
      prev = b.maceAngle;
    }
    // One frame of a 30-frame-period sine can only move so far.
    expect(worstJump).toBeLessThan(0.1);
  });

  it('keeps swinging while stunned instead of freezing', () => {
    const b = armed();
    const p = new Player(0, 0);
    const hero = new Player(b.x, b.y);
    hero.jumping = true;
    hero.grounded = false;
    b.invuln = 0;
    b.interact(hero);
    expect(b.phase).toBe('stunned');
    const seen = new Set<number>();
    for (let f = 0; f < 40; f++) {
      b.update(p);
      seen.add(Math.round(b.maceAngle * 100));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('returns to hover height after being hit mid-dive', () => {
    // Only 'retreat' used to restore altitude, so a hit during a dive left
    // the pod stranded low for the rest of the fight.
    const b = armed();
    const p = new Player(0, 0);
    b.phase = 'dive';
    b.timer = 10;
    b.y = b.homeY + 40;
    const hero = new Player(b.x, b.y);
    hero.jumping = true;
    hero.grounded = false;
    b.invuln = 0;
    b.interact(hero);
    for (let f = 0; f < 200; f++) b.update(p);
    expect(Math.abs(b.y - b.homeY)).toBeLessThan(2);
  });
});

describe('Dr. Yolk — Wrecking Pod', () => {
  it('flies in during intro then starts swaying', () => {
    const b = makeBoss();
    const p = dummyPlayer();
    expect(b.phase).toBe('intro');
    for (let i = 0; i < 300 && b.phase === 'intro'; i++) b.update(p);
    expect(b.phase).toBe('sway');
    expect(Math.abs(b.y - (336 - 104))).toBeLessThan(2);
  });

  it('follows its attack pattern: sway -> telegraph -> dive -> retreat', () => {
    const b = makeBoss();
    const p = dummyPlayer();
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      b.update(p);
      seen.add(b.phase);
    }
    expect(seen.has('sway')).toBe(true);
    expect(seen.has('telegraph')).toBe(true);
    expect(seen.has('dive')).toBe(true);
    expect(seen.has('retreat')).toBe(true);
  });

  it('stays inside the arena horizontally', () => {
    const b = makeBoss();
    const p = dummyPlayer();
    for (let i = 0; i < 2000; i++) b.update(p);
    expect(b.x).toBeGreaterThanOrEqual(4032);
    expect(b.x).toBeLessThanOrEqual(4672);
  });

  it('takes a hit from an attacking player, with an invulnerability window', () => {
    const b = makeBoss();
    b.phase = 'sway';
    const p = new Player(b.x, b.y);
    p.rolling = true; // ball form = attacking
    expect(b.interact(p)).toBe('hit');
    expect(b.hp).toBe(7);
    expect(b.phase).toBe('stunned');
    expect(b.interact(p)).toBeNull(); // invulnerable now
  });

  it('is defeated after 8 hits', () => {
    const b = makeBoss();
    b.phase = 'sway';
    const p = new Player(b.x, b.y);
    p.rolling = true;
    for (let i = 0; i < 8; i++) {
      b.invuln = 0; // skip the window for the test
      b.interact(p);
    }
    expect(b.hp).toBe(0);
    expect(b.defeated).toBe(true);
    expect(b.interact(p)).toBeNull(); // no interaction after defeat
  });

  it('reports contact with the pod for a non-attacking player (caller applies damage)', () => {
    const b = makeBoss();
    b.phase = 'sway';
    const p = new Player(b.x, b.y);
    p.rings = 3;
    expect(b.interact(p)).toBe('hurt');
    // Damage is applied by the Level, not the boss (single damage path).
    expect(p.rings).toBe(3);
    p.hurt(b.x);
    expect(p.rings).toBe(0);
  });

  it('reports mace contact (caller applies damage)', () => {
    const b = makeBoss();
    b.phase = 'sway';
    b.timer = 1;
    b.update(dummyPlayer()); // compute mace position
    const m = b.macePos();
    const p = new Player(m.x, m.y);
    expect(b.interact(p)).toBe('hurt');
  });

  it('telegraph then dives toward the player x', () => {
    const b = makeBoss();
    const p = dummyPlayer();
    p.x = 4200;
    // Fast-forward to the dive.
    for (let i = 0; i < 1000 && b.phase !== 'dive'; i++) b.update(p);
    expect(b.phase).toBe('dive');
    for (let i = 0; i < 100 && b.phase === 'dive'; i++) b.update(p);
    // Dive reached its lowest point heading at the player's position.
    expect(b.y).toBeGreaterThan(336 - 104);
  });
});
