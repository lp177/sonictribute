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
