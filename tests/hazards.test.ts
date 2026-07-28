import { describe, it, expect } from 'vitest';
import { SpikeTrap, CrumblePlatform, SwingBall, Launcher, Spring } from '../src/game/entities.ts';
import { BossArena } from '../src/game/BossArena.ts';
import { Level } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { makeFlatMap, spawnOnGround, input } from './helpers.ts';

describe('SpikeTrap — telegraphed and dodgeable', () => {
  it('spends most of its cycle harmless', () => {
    const t = new SpikeTrap(100, 240, 150);
    let dangerous = 0;
    for (let i = 0; i < 150; i++) {
      t.update();
      if (t.extension > 0.35) dangerous++;
    }
    // A trap that is armed most of the time is a wall, not a hazard.
    expect(dangerous).toBeLessThan(150 * 0.3);
    expect(dangerous).toBeGreaterThan(0);
  });

  it('always warns before it strikes', () => {
    const t = new SpikeTrap(100, 240, 150);
    let sawWarning = false;
    let warnedBeforeStrike = false;
    for (let i = 0; i < 300; i++) {
      const ev = t.update();
      if (ev === 'warn') sawWarning = true;
      if (ev === 'strike') {
        warnedBeforeStrike = sawWarning;
        sawWarning = false;
      }
    }
    expect(warnedBeforeStrike).toBe(true);
  });

  it('is safe to stand on while retracted', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const t = new SpikeTrap(p.x, 240, 150, 0);
    expect(t.phase).toBe('hidden');
    expect(t.touches(p)).toBe(false);
  });

  it('hurts once fully out', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const t = new SpikeTrap(p.x, 240, 150, 0);
    for (let i = 0; i < 150 && t.extension < 1; i++) t.update();
    expect(t.extension).toBe(1);
    expect(t.touches(p)).toBe(true);
  });

  it('is deterministic for a given offset', () => {
    const a = new SpikeTrap(0, 0, 150, 40);
    const b = new SpikeTrap(0, 0, 150, 40);
    for (let i = 0; i < 400; i++) {
      a.update();
      b.update();
      expect(a.extension).toBe(b.extension);
    }
  });
});

describe('CrumblePlatform', () => {
  function standing(x = 100, y = 240) {
    const map = makeFlatMap();
    const p = spawnOnGround(map, x, y);
    return p;
  }

  it('carries the player, then shakes, then lets go', () => {
    const c = new CrumblePlatform(90, 260, 48);
    const p = standing(100, 260);
    p.y = 260 - p.h;
    expect(c.solid).toBe(true);
    expect(c.update(p)).toBeNull();
    expect(c.state).toBe('shaking');
    let crumbled = false;
    for (let i = 0; i < CrumblePlatform.SHAKE + 2; i++) {
      if (c.update(p) === 'crumble') crumbled = true;
    }
    expect(crumbled).toBe(true);
    expect(c.solid).toBe(false);
  });

  it('gives a visible warning before dropping', () => {
    const c = new CrumblePlatform(90, 260, 48);
    const p = standing(100, 260);
    p.y = 260 - p.h;
    c.update(p);
    expect(c.state).toBe('shaking');
    c.update(p);
    c.update(p);
    expect(c.shakeOffset).not.toBe(0); // it visibly rattles first
    expect(CrumblePlatform.SHAKE).toBeGreaterThan(20); // enough time to react
  });

  it('comes back so a route is never permanently lost', () => {
    const c = new CrumblePlatform(90, 260, 48);
    const p = standing(100, 260);
    p.y = 260 - p.h;
    for (let i = 0; i < CrumblePlatform.SHAKE + 2; i++) c.update(p);
    expect(c.state).toBe('falling');
    p.x = 9999; // the player moves on; the ledge rebuilds itself behind them
    for (let i = 0; i < 400; i++) c.update(p);
    expect(c.state).toBe('solid');
    expect(c.solid).toBe(true);
  });

  it('ignores a player who is nowhere near it', () => {
    const c = new CrumblePlatform(900, 260, 48);
    const p = standing(100, 260);
    c.update(p);
    expect(c.state).toBe('solid');
  });
});

describe('SwingBall', () => {
  it('swings on a readable, deterministic arc', () => {
    const s = new SwingBall(400, 200, 144, 150);
    const xs: number[] = [];
    for (let i = 0; i < 150; i++) {
      s.update();
      xs.push(s.x);
    }
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    expect(max - min).toBeGreaterThan(100); // it really travels
    expect(s.y).toBeLessThanOrEqual(200 + 144 + 0.001); // never below the chain
    const again = new SwingBall(400, 200, 144, 150);
    for (let i = 0; i < 150; i++) again.update();
    expect(again.x).toBeCloseTo(s.x, 6);
  });

  it('hurts on contact regardless of rolling', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const s = new SwingBall(p.x, p.y - 100, 100, 150);
    p.rolling = true;
    expect(s.touches(p)).toBe(true);
  });
});

describe('Launcher — the shot into the sky', () => {
  it('needs a running approach', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const l = new Launcher(p.x, 240 - 8);
    p.gsp = 1;
    expect(l.tryLaunch(p)).toBe(false);
    p.gsp = 6;
    expect(l.tryLaunch(p)).toBe(true);
  });

  it('throws the player up and forward, hard', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const l = new Launcher(p.x, 240 - 8, 1, 12, 56);
    p.gsp = 6;
    l.tryLaunch(p);
    expect(p.grounded).toBe(false);
    expect(p.ysp).toBeLessThan(-8); // steeply up
    expect(p.xsp).toBeGreaterThan(4); // and well forward
  });

  it('clears `jumping` so the arc is not cut short', () => {
    // Without this the variable-jump-height cutoff clamps the launch to
    // PHYS.jrel the moment the jump button is released.
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.jumping = true;
    const l = new Launcher(p.x, 240 - 8);
    p.gsp = 6;
    l.tryLaunch(p);
    expect(p.jumping).toBe(false);
    const launchYsp = p.ysp;
    p.update(map, NO_INPUT); // jump button NOT held
    expect(p.ysp).toBeLessThan(launchYsp + 1); // still climbing at full power
  });

  it('sends the player far higher than a normal jump', () => {
    const map = makeFlatMap(200, 40, 560);
    const p = spawnOnGround(map, 200, 560);
    const jumpTop = (() => {
      const q = spawnOnGround(map, 200, 560);
      let top = q.y;
      q.update(map, input({ jump: true, jumpPressed: true }));
      for (let i = 0; i < 120; i++) {
        q.update(map, input({ jump: true }));
        top = Math.min(top, q.y);
      }
      return top;
    })();
    const l = new Launcher(p.x, 560 - 8);
    p.gsp = 6;
    l.tryLaunch(p);
    let top = p.y;
    for (let i = 0; i < 200; i++) {
      p.update(map, input({ right: true }));
      top = Math.min(top, p.y);
    }
    expect(top).toBeLessThan(jumpTop - 60);
  });

  it('respects its cooldown', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const l = new Launcher(p.x, 240 - 8);
    p.gsp = 6;
    expect(l.tryLaunch(p)).toBe(true);
    p.gsp = 6;
    expect(l.tryLaunch(p)).toBe(false);
    for (let i = 0; i < 30; i++) l.update();
    expect(l.ready).toBe(true);
  });
});

describe('Springs launch at full power', () => {
  it('is not truncated by the jump-release cutoff', () => {
    // Regression: springs used to be clipped to PHYS.jrel because `jumping`
    // stayed true, making every spring in the game fire at a third power.
    const map = makeFlatMap(200, 40, 560);
    const p = spawnOnGround(map, 200, 560);
    const before = p.y;
    p.ysp = 1;
    const s = new Spring(p.x, 560 - 8, 'up', 13);
    expect(s.tryTrigger(p)).toBe(true);
    expect(p.jumping).toBe(false);
    let top = p.y;
    for (let i = 0; i < 200; i++) {
      p.update(map, NO_INPUT); // button not held
      top = Math.min(top, p.y);
    }
    // 13 px/frame against 0.21875 gravity is ~386px of rise.
    expect(before - top).toBeGreaterThan(300);
  });
});

describe('BossArena lock-in', () => {
  const arena = () => new BossArena(1000, 1600, 400);

  it('starts open and slams shut on lock', () => {
    const a = arena();
    expect(a.closed).toBe(0);
    expect(a.blocking).toBe(false);
    expect(a.lock()).toBe('gate-slam');
    expect(a.phase).toBe('slamming');
  });

  it('plays a cinematic beat before handing control back', () => {
    const a = arena();
    a.lock();
    expect(a.cinematic).toBe(true);
    for (let i = 0; i < BossArena.SLAM_FRAMES + BossArena.LOCK_HOLD + 2; i++) a.update();
    expect(a.phase).toBe('locked');
    expect(a.cinematic).toBe(false);
    expect(a.closed).toBe(1);
  });

  it('holds the player inside once shut', () => {
    const a = arena();
    a.lock();
    for (let i = 0; i < BossArena.SLAM_FRAMES + 2; i++) a.update();
    const p = new Player(500, 300);
    p.gsp = -8;
    p.xsp = -8;
    expect(a.confine(p)).toBe(true);
    expect(p.x).toBeGreaterThan(1000);
    expect(p.gsp).toBe(0);

    p.x = 5000;
    p.gsp = 8;
    p.xsp = 8;
    expect(a.confine(p)).toBe(true);
    expect(p.x).toBeLessThan(1600);
  });

  it('lets a player inside the arena move freely', () => {
    const a = arena();
    a.lock();
    for (let i = 0; i < BossArena.SLAM_FRAMES + 2; i++) a.update();
    const p = new Player(1300, 300);
    p.gsp = 6;
    expect(a.confine(p)).toBe(false);
    expect(p.x).toBe(1300);
    expect(p.gsp).toBe(6);
  });

  it('opens again after the boss falls', () => {
    const a = arena();
    a.lock();
    for (let i = 0; i < BossArena.SLAM_FRAMES + 2; i++) a.update();
    expect(a.release()).toBe('gate-open');
    for (let i = 0; i < BossArena.OPEN_FRAMES + 2; i++) a.update();
    expect(a.phase).toBe('cleared');
    expect(a.closed).toBe(0);
    expect(a.blocking).toBe(false);
    const p = new Player(500, 300);
    expect(a.confine(p)).toBe(false); // free to leave for the goal
  });
});

describe('Level integration — arena and backtracking', () => {
  it('seals the arena when the boss spawns and opens it when he falls', () => {
    const level = new Level(zone1);
    const p = new Player(level.bossTriggerX + 4, 300);
    p.invuln = 99999;
    const events = level.update(p);
    expect(events).toContain('gate-slam');
    expect(level.arenaGates).not.toBeNull();
    expect(level.arenaGates!.phase).toBe('slamming');

    // Cannot leave the way you came in.
    for (let i = 0; i < BossArena.SLAM_FRAMES + 4; i++) level.update(p);
    p.x = level.arena.left - 200;
    level.update(p);
    expect(p.x).toBeGreaterThanOrEqual(level.arena.left);

    const boss = level.boss!;
    boss.phase = 'sway';
    for (let i = 0; i < 8; i++) {
      boss.invuln = 0;
      p.x = boss.x;
      p.y = boss.y;
      p.rolling = true;
      p.jumping = false;
      p.grounded = false;
      level.update(p);
    }
    expect(level.bossDefeated).toBe(true);
    expect(level.arenaGates!.phase).toBe('opening');
  });

  it('closes the world behind the player instead of letting them re-run it', () => {
    const level = new Level(zone1);
    const p = new Player(level.startPos.x, level.startPos.y);
    p.grounded = true;
    // Walk a long way forward.
    for (let i = 0; i < 60; i++) {
      p.x += 40;
      level.update(p);
    }
    const limit = level.backLimitX;
    expect(limit).toBeGreaterThan(level.startPos.x);

    // Now try to walk all the way back to the start.
    p.x = level.startPos.x;
    p.gsp = -6;
    level.update(p);
    expect(p.x).toBeGreaterThanOrEqual(limit);
    expect(p.gsp).toBe(0);
  });

  it('still allows a short step back for a missed pickup', () => {
    const level = new Level(zone1);
    const p = new Player(level.startPos.x + 2000, level.startPos.y);
    level.update(p);
    const limit = level.backLimitX;
    // Roughly a screen of slack, not a pinhole.
    expect(p.x - limit).toBeGreaterThan(320);
  });

  it('keeps the void below every route', () => {
    const level = new Level(zone1);
    expect(level.voidY).toBeGreaterThan(level.map.pixelH);
    const p = new Player(level.startPos.x, level.voidY + 1);
    level.update(p);
    expect(p.dead).toBe(true);
  });
});
