import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { PHYS } from '../src/physics/constants.ts';
import {
  Stalactite,
  PhasePlatform,
  Hopper,
  CART,
  HOPPER,
} from '../src/game/entities.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;
const FLOOR_ROW = 30;
const FLOOR_Y = FLOOR_ROW * T; // 480

/**
 * A flat test bench: one long floor, start on the left, goal far right, and
 * whatever mechanic the test adds. Each mechanic lives well past the start so
 * nothing is within AMBIENT_RANGE of an idle player.
 */
function makeDef(build: (b: LevelBuilder) => void): LevelDef {
  return {
    name: 'mech2-bench',
    act: 'bench',
    title: 'Mechanics Bench',
    biome: 2,
    theme: 'crystal',
    width: 220,
    height: 40,
    build(b) {
      b.floor(0, 219, FLOOR_ROW);
      b.start(4, FLOOR_ROW);
      b.goal(216, FLOOR_ROW);
      build(b);
    },
  };
}

const makeLevel = (build: (b: LevelBuilder) => void) => new Level(makeDef(build));

/** A player settled on the bench floor at pixel x (player updates only). */
function standAt(level: Level, x: number): Player {
  const p = new Player(x, FLOOR_Y - PHYS.heightRadius - 2);
  for (let i = 0; i < 30 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  return p;
}

/** One full game frame: player update then level update; returns level events. */
function frame(level: Level, p: Player, inp = NO_INPUT): string[] {
  p.update(level.map, inp);
  return level.update(p);
}

/* -------------------------------- Stalactite ------------------------------- */

const stalBench = (b: LevelBuilder) => {
  b.slab(58, 70, 20, 2); // ceiling to hang from
  b.stalactite(64, 21);
};
const STAL_X = 64 * T + T / 2; // 1032

describe('Stalactite', () => {
  it('hangs quietly until the player passes beneath', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X - 300); // out of trigger range, within earshot
    const heard: string[] = [];
    for (let f = 0; f < 200; f++) heard.push(...frame(level, p));
    expect(heard).toEqual([]);
    expect(level.stalactites[0].state).toBe('hanging');
  });

  it('trembles with a positioned warn when the player passes beneath', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X - 20);
    const evs = frame(level, p);
    expect(evs).toContain('stalactite-warn');
    const src = level.eventSources.get('stalactite-warn');
    expect(src).toBeDefined();
    expect(src!.x).toBe(STAL_X);
    expect(level.stalactites[0].state).toBe('trembling');
  });

  it('is safe while merely trembling', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X);
    p.rings = 5;
    const heard: string[] = [];
    // The tremble is the whole warning window: no damage before the drop.
    for (let f = 0; f < Stalactite.TREMBLE; f++) heard.push(...frame(level, p));
    expect(heard).not.toContain('hurt');
    expect(p.rings).toBe(5);
  });

  it('falls after the tremble and the falling spike hurts', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X);
    p.rings = 5;
    const heard: string[] = [];
    for (let f = 0; f < 120 && !heard.includes('hurt'); f++) heard.push(...frame(level, p));
    expect(heard).toContain('stalactite-fall');
    expect(heard).toContain('hurt');
    expect(p.rings).toBe(0);
  });

  it('shatters on the floor and the shards do not hurt', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X);
    frame(level, p); // arm it
    p.x = STAL_X + 200; // step aside so it falls freely
    let guard = 0;
    while (level.stalactites[0].state !== 'shattered' && guard++ < 300) frame(level, p);
    expect(level.stalactites[0].state).toBe('shattered');
    // Walk back onto the shard pile: nothing happens.
    p.x = STAL_X;
    p.rings = 5;
    const heard: string[] = [];
    for (let f = 0; f < 60; f++) heard.push(...frame(level, p));
    expect(heard).not.toContain('hurt');
    expect(p.rings).toBe(5);
  });

  it('respawns about 300 frames after shattering', () => {
    const level = makeLevel(stalBench);
    const st = level.stalactites[0];
    const p = standAt(level, STAL_X);
    frame(level, p);
    p.x = STAL_X + 200; // out of trigger range while it regrows
    let guard = 0;
    while (st.state !== 'shattered' && guard++ < 300) frame(level, p);
    for (let f = 0; f < Stalactite.RESPAWN; f++) frame(level, p);
    expect(st.state).toBe('hanging');
    expect(st.y).toBe(st.homeY);
    // And it is re-armed: passing beneath again warns again.
    p.x = STAL_X;
    expect(frame(level, p)).toContain('stalactite-warn');
  });

  it('falls deterministically: two identical runs match frame for frame', () => {
    const a = makeLevel(stalBench);
    const b = makeLevel(stalBench);
    const pa = standAt(a, STAL_X);
    const pb = standAt(b, STAL_X);
    for (let f = 0; f < 200; f++) {
      frame(a, pa);
      frame(b, pb);
      expect(a.stalactites[0].y).toBe(b.stalactites[0].y);
      expect(a.stalactites[0].state).toBe(b.stalactites[0].state);
    }
  });

  it('stays silent once the player has dashed out of earshot', () => {
    const level = makeLevel(stalBench);
    const p = standAt(level, STAL_X);
    frame(level, p); // warn heard here, up close
    p.x = STAL_X + 1000; // gone before the drop
    const heard: string[] = [];
    for (let f = 0; f < 300; f++) heard.push(...frame(level, p));
    expect(heard.filter((e) => e.startsWith('stalactite'))).toEqual([]);
  });
});

/* -------------------------------- Quarter pipe ----------------------------- */

const pipeBench = (b: LevelBuilder) => b.quarterPipe(60, FLOOR_ROW, 1);
const PIPE_FOOT_X = 60 * T; // 960

describe('Quarter pipe', () => {
  it('builds real ground: the lip column is ordinary solid terrain', () => {
    const level = makeLevel(pipeBench);
    // Foot tile is the rounded join, lip column tops out four rows up.
    expect(level.map.get(60, FLOOR_ROW - 1, 0).heights.some((h) => h > 0)).toBe(true);
    expect(level.map.get(64, FLOOR_ROW - 4, 0).heights.some((h) => h > 0)).toBe(true);
    // And it planted exactly one launcher at the lip.
    expect(level.launchers).toHaveLength(1);
    expect(level.launchers[0].convert).toBe(true);
  });

  it('entered fast, converts the run into a steep diagonal launch', () => {
    const level = makeLevel(pipeBench);
    const p = standAt(level, PIPE_FOOT_X - 160);
    p.gsp = 10;
    p.xsp = 10;
    let launched = false;
    for (let f = 0; f < 90 && !launched; f++) {
      if (frame(level, p, input({ right: true })).includes('launch')) launched = true;
    }
    expect(launched).toBe(true);
    expect(p.grounded).toBe(false);
    expect(p.ysp).toBeLessThan(-9); // steep: mostly upward
    expect(p.xsp).toBeGreaterThan(0); // ...but still forward
  });

  it('launches harder the faster it is entered (speed conversion)', () => {
    const ride = (speed: number): number => {
      const level = makeLevel(pipeBench);
      const p = standAt(level, PIPE_FOOT_X - 160);
      p.gsp = speed;
      p.xsp = speed;
      for (let f = 0; f < 90; f++) {
        if (frame(level, p, input({ right: true })).includes('launch')) return p.ysp;
      }
      throw new Error(`never launched at entry speed ${speed}`);
    };
    expect(ride(15)).toBeLessThan(ride(8) - 1); // more entry speed, more height
  });

  it('entered slow it is a climbable curve, never a wall and never a launch', () => {
    const level = makeLevel(pipeBench);
    const p = standAt(level, PIPE_FOOT_X - 20);
    let maxX = p.x;
    let minFeet = p.y + p.h;
    const heard: string[] = [];
    for (let f = 0; f < 300; f++) {
      heard.push(...frame(level, p, input({ right: true })));
      maxX = Math.max(maxX, p.x);
      minFeet = Math.min(minFeet, p.y + p.h);
    }
    expect(heard).not.toContain('launch');
    // They got ONTO the curve (past the foot tile and visibly uphill), which
    // a wall would never allow, then slid back down alive.
    expect(maxX).toBeGreaterThan(PIPE_FOOT_X + 16);
    expect(minFeet).toBeLessThan(FLOOR_Y - 4);
    expect(p.dead).toBe(false);
  });
});

/* ---------------------------------- Minecart ------------------------------- */

const cartBench = (b: LevelBuilder) => b.cartRide(130, FLOOR_ROW, 150, FLOOR_ROW);
const CART_START_X = 130 * T; // 2080
const CART_END_X = 150 * T; // 2400

/** Walks the player right into the waiting cart; returns frames spent. */
function boardCart(level: Level, p: Player): string[] {
  const heard: string[] = [];
  for (let f = 0; f < 240 && !p.carting; f++) heard.push(...frame(level, p, input({ right: true })));
  expect(p.carting).toBe(true);
  return heard;
}

describe('Minecart', () => {
  it('touching the waiting cart boards it', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    const heard = boardCart(level, p);
    expect(heard).toContain('cart-board');
    expect(level.carts[0].state).toBe('running');
    expect(level.carts[0].rider).toBe(true);
  });

  it('reports the boarding at the cart, not out of thin air', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    let src: { x: number; y: number } | undefined;
    for (let f = 0; f < 240 && !src; f++) {
      if (frame(level, p, input({ right: true })).includes('cart-board')) {
        src = level.eventSources.get('cart-board');
      }
    }
    expect(src).toBeDefined();
    expect(Math.abs(src!.x - CART_START_X)).toBeLessThan(2 * T);
  });

  it('carries the rider along the track', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    boardCart(level, p);
    const x0 = p.x;
    for (let f = 0; f < 10; f++) {
      frame(level, p);
      expect(p.x).toBe(level.carts[0].x); // pinned to the tub
    }
    expect(p.x - x0).toBeCloseTo(10 * CART.speed, 4);
  });

  it('ignores steering: jump is the only control aboard', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    boardCart(level, p);
    for (let f = 0; f < 10; f++) {
      frame(level, p, input({ left: true, down: true }));
      expect(p.carting).toBe(true);
      expect(p.x).toBe(level.carts[0].x);
      expect(p.gsp).toBe(CART.speed);
    }
  });

  it('crashes into the buffer and the crash costs the rider one normal hit', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    p.rings = 5;
    boardCart(level, p);
    let crashEvents: string[] = [];
    for (let f = 0; f < 200; f++) {
      const evs = frame(level, p);
      if (evs.includes('cart-wreck')) {
        crashEvents = evs;
        break;
      }
    }
    expect(crashEvents).toContain('cart-wreck');
    expect(crashEvents).toContain('hurt'); // the level's damage path, same frame
    expect(level.eventSources.get('cart-wreck')!.x).toBe(CART_END_X);
    expect(p.rings).toBe(0);
    expect(level.tookDamage).toBe(true);
    expect(p.carting).toBe(false);
  });

  it('sets the rider down at the DEFINED buffer position when it crashes', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    p.rings = 5;
    boardCart(level, p);
    for (let f = 0; f < 200; f++) {
      if (frame(level, p).includes('cart-wreck')) break;
    }
    // Exactly at the end of the track, feet on the rail line — knockback
    // starts from a known spot, never from inside the buffer.
    expect(p.x).toBe(CART_END_X);
    expect(p.y + p.h).toBeCloseTo(FLOOR_Y, 4);
  });

  it('routes the crash through the normal damage path (a shield absorbs it)', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    p.rings = 5;
    p.shield = true;
    boardCart(level, p);
    const heard: string[] = [];
    for (let f = 0; f < 200 && !heard.includes('cart-wreck'); f++) heard.push(...frame(level, p));
    expect(heard).toContain('shield-lost');
    expect(p.rings).toBe(5); // the shield paid, not the rings
    expect(p.dead).toBe(false);
  });

  it('jumping out before impact keeps the momentum and dodges the crash', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    p.rings = 5;
    boardCart(level, p);
    for (let f = 0; f < 20; f++) frame(level, p); // ride a while
    frame(level, p, input({ jump: true, jumpPressed: true }));
    expect(p.carting).toBe(false);
    expect(p.jumping).toBe(true);
    expect(p.ysp).toBe(-PHYS.jmp);
    expect(p.xsp).toBe(CART.speed); // momentum earned from the cart
    expect(level.carts[0].rider).toBe(false);
    // The cart is committed: it still crashes — but hurts nobody.
    const heard: string[] = [];
    for (let f = 0; f < 200; f++) heard.push(...frame(level, p));
    expect(heard).toContain('cart-crash');
    expect(heard).not.toContain('hurt');
    expect(p.rings).toBe(5);
  });

  it('a wrecked cart respawns at the start and can be ridden again', () => {
    const level = makeLevel(cartBench);
    const cart = level.carts[0];
    const p = standAt(level, CART_START_X - 60);
    p.rings = 5;
    boardCart(level, p);
    for (let f = 0; f < 200 && cart.state !== 'crashed'; f++) frame(level, p);
    expect(cart.state).toBe('crashed');
    for (let f = 0; f < CART.respawn; f++) frame(level, p);
    expect(cart.state).toBe('waiting');
    expect(cart.x).toBe(CART_START_X);
    // Board it again.
    p.x = CART_START_X - 4;
    p.rings = 5;
    const heard: string[] = [];
    for (let f = 0; f < 30 && !p.carting; f++) heard.push(...frame(level, p));
    expect(p.carting).toBe(true);
    expect(heard).toContain('cart-board');
  });

  it('carting is cleared by a respawn, and the cart lets a dead rider go', () => {
    const level = makeLevel(cartBench);
    const p = standAt(level, CART_START_X - 60);
    boardCart(level, p);
    p.respawn(level.startPos.x, level.startPos.y);
    expect(p.carting).toBe(false);
    level.update(p);
    expect(level.carts[0].rider).toBe(false);

    // Death aboard also unpins: the corpse falls, the cart runs on.
    const level2 = makeLevel(cartBench);
    const q = standAt(level2, CART_START_X - 60);
    boardCart(level2, q);
    q.die();
    expect(q.carting).toBe(false);
    level2.update(q);
    expect(level2.carts[0].rider).toBe(false);
    expect(level2.carts[0].state).toBe('running');
  });
});

/* ------------------------------- Phase platform ---------------------------- */

const PHASE_ROW = 24;
const PHASE_Y = PHASE_ROW * T; // 384
const phaseBench = (b: LevelBuilder) => b.phasePlatform(170, 174, PHASE_ROW);
const PHASE_MID_X = 172 * T + T / 2;

/** Drops a player onto the (currently solid) platform and settles them. */
function standOnPlatform(level: Level): Player {
  const p = new Player(PHASE_MID_X, PHASE_Y - PHYS.heightRadius - 6);
  for (let f = 0; f < 12; f++) frame(level, p);
  expect(p.grounded).toBe(true);
  expect(p.y + p.h).toBeCloseTo(PHASE_Y, 4);
  return p;
}

describe('Phase platform', () => {
  it('carries a standing player while solid (standOn, not a tile)', () => {
    const level = makeLevel(phaseBench);
    const p = standOnPlatform(level);
    for (let f = 0; f < 20; f++) frame(level, p);
    expect(p.grounded).toBe(true);
    expect(p.y + p.h).toBeCloseTo(PHASE_Y, 4);
    // It is genuinely not terrain: the tile map is empty there.
    expect(level.map.get(172, PHASE_ROW, 0).heights.every((h) => h === 0)).toBe(true);
  });

  it('never turns off under a standing player without 20+ frames of visible warning', () => {
    const level = makeLevel(phaseBench);
    const ph = level.phasePlats[0];
    const p = standOnPlatform(level);
    const warning: boolean[] = [];
    let offAt = -1;
    for (let f = 0; f < ph.period && offAt < 0; f++) {
      frame(level, p);
      warning.push(ph.warning);
      if (!ph.solid) offAt = f;
    }
    expect(offAt).toBeGreaterThan(20);
    for (let f = offAt - 20; f < offAt; f++) {
      expect(warning[f], `no warning ${offAt - f} frames before cut-out`).toBe(true);
    }
  });

  it('announces the blink once, at the platform, within earshot only', () => {
    const level = makeLevel(phaseBench);
    const p = standAt(level, PHASE_MID_X); // on the floor right beneath it
    let blinks = 0;
    for (let f = 0; f < level.phasePlats[0].period; f++) {
      if (frame(level, p).includes('phase-blink')) {
        blinks++;
        const src = level.eventSources.get('phase-blink')!;
        expect(src.x).toBe(PHASE_MID_X);
        expect(src.y).toBe(PHASE_Y);
      }
    }
    expect(blinks).toBe(1);
  });

  it('stays silent from across the level', () => {
    const level = makeLevel(phaseBench);
    const p = standAt(level, level.startPos.x);
    const heard: string[] = [];
    for (let f = 0; f < 700; f++) heard.push(...frame(level, p));
    expect(heard).toEqual([]);
  });

  it('drops the player when off, shows a returning ghost, then comes back', () => {
    const level = makeLevel(phaseBench);
    const ph = level.phasePlats[0];
    const p = standOnPlatform(level);
    while (ph.solid) frame(level, p);
    expect(ph.ghost).toBeGreaterThan(0); // the telegraph of the return
    for (let f = 0; f < 60; f++) frame(level, p);
    expect(p.grounded).toBe(true);
    expect(p.y + p.h).toBeCloseTo(FLOOR_Y, 4); // fell to the floor below
    let guard = 0;
    while (!ph.solid && guard++ < 200) frame(level, p);
    expect(ph.solid).toBe(true); // the light comes back on schedule
  });

  it('is deterministic: offset shifts the cycle, short periods are clamped', () => {
    const half = new PhasePlatform(0, 0, 64, 180, 90);
    expect(half.solid).toBe(false); // starts mid off-phase
    const wrap = new PhasePlatform(0, 0, 64, 180, 180);
    expect(wrap.solid).toBe(true); // a whole period is a no-op
    // A period too short for the warning would break the blink promise.
    const tiny = new PhasePlatform(0, 0, 64, 30);
    expect(tiny.period).toBeGreaterThanOrEqual(PhasePlatform.WARN * 4);
    expect(PhasePlatform.WARN).toBeGreaterThanOrEqual(20);
  });
});

/* ---------------------------------- Hopper --------------------------------- */

const hopperBench = (b: LevelBuilder) => b.hopper(190, FLOOR_ROW);
const HOPPER_X = 190 * T + T / 2; // 3048

describe('Hopper', () => {
  it('leaps a deterministic arc on a fixed cycle', () => {
    const a = new Hopper(100, 200);
    const b = new Hopper(100, 200);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let f = 0; f < a.period * 2; f++) {
      a.update();
      b.update();
      expect(a.x).toBe(b.x); // twins never diverge
      expect(a.y).toBe(b.y);
      xs.push(a.x);
      ys.push(a.y);
    }
    // The double period repeats exactly.
    for (let f = 0; f < a.period * 2; f++) {
      a.update();
      expect(a.x).toBe(xs[f]);
      expect(a.y).toBe(ys[f]);
    }
  });

  it('hops between its two pads and actually leaves the ground mid-arc', () => {
    const h = new Hopper(100, 200);
    let peak = 200;
    for (let f = 0; f < h.period; f++) {
      h.update();
      peak = Math.min(peak, h.y);
    }
    expect(h.x).toBe(100 + HOPPER.hop); // landed on the far pad
    expect(peak).toBeLessThan(200 - HOPPER.height / 2); // a real leap, not a shuffle
    for (let f = 0; f < h.period; f++) h.update();
    expect(h.x).toBe(100); // ...and back
  });

  it('is stompable like a crab, with a positioned stomp event', () => {
    const level = makeLevel(hopperBench);
    const scoreBefore = level.score;
    const p = new Player(HOPPER_X, FLOOR_Y - 60);
    p.jumping = true; // ball form: attacking
    p.ysp = 4;
    const heard: string[] = [];
    for (let f = 0; f < 30 && level.hoppers[0].alive; f++) heard.push(...frame(level, p));
    expect(level.hoppers[0].alive).toBe(false);
    expect(heard).toContain('hopper-stomp');
    expect(level.eventSources.get('hopper-stomp')!.x).toBeCloseTo(HOPPER_X, 4);
    expect(level.score).toBeGreaterThan(scoreBefore);
    expect(p.ysp).toBeLessThan(0); // stomp bounce
  });

  it('hurts a player who walks into it, through the level damage path', () => {
    const level = makeLevel(hopperBench);
    const p = standAt(level, HOPPER_X);
    p.rings = 3;
    const evs = frame(level, p);
    expect(evs).toContain('hurt');
    expect(p.rings).toBe(0);
    expect(level.tookDamage).toBe(true);
    expect(level.hoppers[0].alive).toBe(true); // walking into it kills nobody but you
  });
});

/* ------------------------------- Idle silence ------------------------------ */

describe('Idle silence with every new mechanic present', () => {
  it('an idle hero at the start hears NOTHING for 600 frames', () => {
    // The full menagerie, all of it beyond AMBIENT_RANGE of the start.
    const level = makeLevel((b) => {
      b.slab(58, 70, 20, 2);
      b.stalactite(64, 21);
      b.quarterPipe(90, FLOOR_ROW, 1);
      b.cartRide(130, FLOOR_ROW, 150, FLOOR_ROW);
      b.phasePlatform(170, 174, PHASE_ROW);
      b.hopper(190, FLOOR_ROW);
    });
    const p = new Player(level.startPos.x, level.startPos.y);
    for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
    const heard: string[] = [];
    for (let f = 0; f < 600; f++) {
      p.update(level.map, NO_INPUT);
      heard.push(...level.update(p));
    }
    expect(heard, `idle hero triggered: ${[...new Set(heard)].join(', ')}`).toEqual([]);
  });
});
