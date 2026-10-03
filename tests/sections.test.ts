import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT, BOUNCE } from '../src/game/Player.ts';
import { PHYS } from '../src/physics/constants.ts';
import {
  WORLD_ROWS,
  HI,
  LO,
  kicker,
  groundRow,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  tubeShot,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../src/levels/sections.ts';
import { hazardGauntlet } from '../src/levels/motifs.ts';
import { runBot } from './bots.ts';
import { reach } from './reach.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

function bench(build: (b: LevelBuilder) => void, width = 260): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 0, theme: 'verdant', width, height: WORLD_ROWS, build };
}

type Style = 'run' | 'roll';

/**
 * Plays a bench from its start: 'run' holds the direction, 'roll' holds it
 * and curls up on the slopes. Returns where the hero first touched down
 * after leaving the ground past column `after`.
 */
function approach(def: LevelDef, style: Style, after: number) {
  const level = new Level(def);
  const p = new Player(level.startPos.x, level.startPos.y);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  let flying = false;
  let peak = Infinity;
  let lip = 0;
  for (let f = 0; f < 3000; f++) {
    const was = p.grounded;
    const down = style === 'roll' && p.grounded && !p.rolling && Math.abs(p.gsp) > 2.5;
    p.update(level.map, input({ right: true, down }));
    level.update(p);
    if (was && !p.grounded && !flying && p.x > after * T) {
      flying = true;
      lip = Math.hypot(p.xsp, p.ysp);
    }
    if (flying && !p.grounded) peak = Math.min(peak, (p.y + p.h) / T);
    if (flying && p.grounded) return { level, p, lip, peak, row: Math.round((p.y + p.h) / T), col: p.x / T };
  }
  throw new Error(`${style}: never left the ground past column ${after}`);
}

describe('Speed comes from the ground', () => {
  it('a kicker returns more height the faster you arrive — no launcher involved', () => {
    const def = bench((b) => {
      b.floor(0, 60, 40);
      b.start(4, 40);
      kicker(b, 61, 40);
      b.floor(66, 259, 60);
    });
    const level = new Level(def);
    expect(level.launchers).toHaveLength(0);
    const apex = (v: number) => {
      const p = new Player(40 * T, 40 * T - 21);
      for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
      p.gsp = v;
      let top = Infinity;
      for (let f = 0; f < 200; f++) {
        p.update(level.map, input({ right: true }));
        top = Math.min(top, (p.y + p.h) / T);
      }
      return 36 - top; // rows above the lip
    };
    const [slow, fast, flat] = [apex(8), apex(11), apex(14)];
    expect(slow).toBeGreaterThan(2);
    expect(fast).toBeGreaterThan(slow + 3);
    expect(flat).toBeGreaterThan(fast + 3);
  });

  it('a kicker in the road can be climbed from a short run-up', () => {
    const def = bench((b) => {
      b.floor(0, 60, 40);
      b.start(52, 40); // eight tiles before the foot
      kicker(b, 61, 40);
      b.floor(66, 259, 40);
      b.goal(200, 40);
    });
    const r = runBot(def, 'faller');
    expect(r.reached).toBe(true);
    expect(r.worstStall).toBeLessThan(60);
  });

  it('rolling a descent is worth about two px/frame over running it', () => {
    const exit = (roll: boolean) => {
      const def = bench((b) => {
        b.floor(0, 20, 20);
        b.start(4, 20);
        b.gentleDown(21, 20, 12);
        b.floor(45, 259, 32);
      });
      const level = new Level(def);
      const p = new Player(level.startPos.x, level.startPos.y);
      for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
      for (let f = 0; f < 900; f++) {
        const down = roll && p.grounded && !p.rolling && Math.abs(p.gsp) > 2.5;
        p.update(level.map, input({ right: true, down }));
        if (p.x > 47 * T) return p.gsp;
      }
      return 0;
    };
    expect(exit(false)).toBeGreaterThan(8);
    expect(exit(true)).toBeGreaterThan(exit(false) + 1.5);
  });

  it('anyone can walk up a hill from a standstill — a 45° face included, at a jog', () => {
    const climb = (steep: boolean) => {
      const def = bench((b) => {
        b.floor(0, 30, 40);
        b.start(29, 40); // parked at the foot: no run-up at all
        if (steep) b.slopeUp(31, 39, 8);
        else b.gentleUp(31, 39, 8);
        b.floor(steep ? 39 : 47, 259, 32);
      });
      const level = new Level(def);
      const p = new Player(level.startPos.x, level.startPos.y);
      for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
      for (let f = 0; f < 600; f++) p.update(level.map, input({ right: true }));
      return (p.y + p.h) / T;
    };
    expect(climb(false)).toBeLessThan(32.5); // on top
    expect(climb(true)).toBeLessThan(32.5); // and up the steep one too: no kicker is a trap
  });
});

describe('launchValley sorts players by how they came down', () => {
  const def = bench((b) => {
    let c = rollingStart(b, 0, 26);
    c = launchValley(b, c.endX, c.endRow, { depth: 12, crabs: 0, retrySpring: false, prize: 'crystal' });
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });
  // rollingStart ends at row 30, so the valley floor is row 42 and the lip row 38.
  const FLOOR = 42;
  const LOWER = 34;
  const UPPER = 31;

  it('with no descent behind you, you hop off the lip onto the valley floor', () => {
    // Parked at the foot of the slope: only the basin for a run-up.
    const r = runBot(def, 'faller', 2000, { col: 59, row: FLOOR });
    const floorCols = [...r.road].filter(([col, row]) => col > 73 && col < 100 && Math.round(row) === FLOOR);
    expect(floorCols.length).toBeGreaterThan(10); // walked the valley floor past the lip
    const under = [...r.road].filter(([col]) => col > 73 && col < 100).map(([, row]) => row);
    expect(Math.min(...under)).toBeGreaterThan(LOWER + 1); // never touched a ledge
    expect(r.reached).toBe(true); // and the climb-out still leads on
  });

  it('a running approach is thrown onto the lower ledge', () => {
    expect(approach(def, 'run', 60).row).toBe(LOWER);
  });

  it('a rolling approach reaches the upper ledge and its prize', () => {
    const r = approach(def, 'roll', 60);
    expect(r.row).toBe(UPPER);
    expect(r.lip).toBeGreaterThan(10.5);
    const crystal = r.level.crystals[0];
    expect(Math.abs(crystal.y / T - (UPPER - 2))).toBeLessThan(1);
  });

  it('uses no booster and no launcher', () => {
    const level = new Level(def);
    expect(level.dashPads).toHaveLength(0);
    expect(level.launchers).toHaveLength(0);
  });

  it('the climb-out is a clean slope: no ledge tile stamped into it', () => {
    for (const depth of [10, 12, 14]) {
      const b = new LevelBuilder(260, WORLD_ROWS);
      const c = rollingStart(b, 0, 24);
      const end = launchValley(b, c.endX, c.endRow, { depth });
      // Walk the surface from the valley floor to the exit: every column's top
      // tile is ground, and it never steps up more than half a tile's worth.
      for (let x = end.endX - 4 - (depth - 2) * 2; x < end.endX; x++) {
        const top = groundRow(b, x);
        expect(b.grid[top][x], `depth ${depth}, column ${x}`).not.toBe('=');
        for (let y = 0; y < top; y++) expect(b.grid[y][x] === '=' && y >= top - 1, `ledge on the slope at ${x}`).toBe(false);
      }
    }
    // And a hero parked on the valley floor walks out of it.
    const r = runBot(def, 'faller', 3000, { col: 95, row: FLOOR });
    expect(r.reached).toBe(true);
    expect(r.worstStall).toBeLessThan(40);
  });

  it('the lower ledge ends flush with the climb-out, so the roads rejoin', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    def.build(b);
    let last = 0;
    for (let x = 0; x < 260; x++) if (b.grid[LOWER][x] === '=') last = x;
    // One column past the ledge the ground itself is at (about) its height.
    expect(Math.abs(groundRow(b, last + 2) - LOWER)).toBeLessThanOrEqual(1);
  });
});

describe('Set pieces', () => {
  it('loopHill: a hero who starts at rest at the top completes the loop on the slope alone', () => {
    const def = bench((b) => {
      b.floor(0, 9, 24);
      b.start(4, 24);
      const c = loopHill(b, 10, 24, { drop: 6 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    const level = new Level(def);
    expect(level.dashPads).toHaveLength(0);
    expect(level.loops).toHaveLength(1);
    // The roof prize sits over the loop, one row clear of the annulus.
    const roof = level.monitors[0];
    expect(Math.abs(roof.x - level.loops[0].cx)).toBeLessThan(T);
    expect(roof.y).toBeLessThan(level.loops[0].cy - level.loops[0].outerR);
    const r = runBot(def, 'faller');
    expect(r.reached).toBe(true);
    expect(r.worstStall).toBeLessThan(60);
  });

  it('plunge: a cliff you run down, out at speed', () => {
    const def = bench((b) => {
      b.floor(0, 19, 20);
      b.start(4, 20);
      const c = plunge(b, 20, 20, { drop: 12, runout: 30 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    const r = runBot(def, 'roller');
    expect(r.reached).toBe(true);
    expect(r.topSpeed).toBeGreaterThan(10);
  });

  it('longJump: speed clears it, the lack of it costs a detour — never a life', () => {
    const def = bench((b) => {
      b.floor(0, 39, 30);
      b.start(4, 30);
      const c = longJump(b, 40, 30, { gap: 12, fall: 2 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    const fast = approach(def, 'run', 48);
    expect(fast.row).toBe(32); // the far bank
    expect(fast.col).toBeGreaterThan(64);
    // One tile of run-up: nowhere near enough. (From two he already comes
    // down ON the springs at the far wall — in the pit, but never on its floor.)
    const slow = runBot(def, 'faller', 3000, { col: 47, row: 30 });
    const pit = [...slow.road].filter(([col, row]) => col >= 52 && col <= 63 && Math.round(row) === 36);
    expect(pit.length).toBeGreaterThan(1); // came down on the pit floor...
    expect(slow.reached).toBe(true); // ...and the springs lifted it out
    expect(slow.player.dead).toBe(false);
  });

  it('undercroft: over the hill or through the cave under it, both come out the far side', () => {
    const def = bench((b) => {
      b.floor(0, 19, 28);
      b.start(4, 28);
      const c = undercroft(b, 20, 28, { rise: 8, prize: 'crystal', secret: true });
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    const over = runBot(def, 'naive');
    // Step into the shaft (a runner skims over it: the cave is a choice).
    const under = runBot(def, 'faller', 3000, { col: 23, row: 30 });
    expect(over.reached).toBe(true);
    expect(under.reached).toBe(true);
    expect(Math.min(...over.road.values())).toBeLessThan(21); // crossed the crown (row 20)
    expect(Math.max(...under.road.values())).toBeCloseTo(28 + LO, 0); // walked the cave floor
    expect(under.level.secrets[0].found).toBe(true);
  });

  it('springCliff and stairClimb win back height', () => {
    const def = bench((b) => {
      b.floor(0, 9, 44);
      b.start(4, 44);
      let c = springCliff(b, 10, 44, { rise: 12 });
      expect(c.endRow).toBe(32);
      c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4 });
      expect(c.endRow).toBe(20);
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
    }
  });

  it('tubeShot: fired out of the bluff onto a clear runway, through its ring cloud', () => {
    const def = bench((b) => {
      b.floor(0, 19, 24);
      b.start(4, 24);
      const c = tubeShot(b, 20, 24, { drop: 8, runout: 60 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(240, c.endRow);
    });
    const r = approach(def, 'roll', 44);
    expect(r.row).toBe(32);
    expect(r.col).toBeLessThan(110); // came down on the runway
    const level = new Level(def);
    // Nothing waits on the landing strip but ground.
    expect([...level.enemies, ...level.spikes, ...level.traps]).toHaveLength(0);
    expect(level.rings.length).toBeGreaterThan(15);
    // The tube is a tunnel: rock over the descent.
    const b = new LevelBuilder(260, WORLD_ROWS);
    def.build(b);
    expect(b.grid[24 - 5][28]).toBe('#');
  });
});

describe('The high and low roads', () => {
  const ground = (b: LevelBuilder) => {
    let c = rollingStart(b, 0, 24);
    c = undercroft(b, c.endX, c.endRow, { rise: 8 });
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 1 });
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 20 });
    b.floor(c.endX, 259, c.endRow);
    return c;
  };

  it('highRoad rides the ground beneath it, a jump at a time', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    ground(b);
    highRoad(b, 30, 200, { monitors: ['rings10'], crystal: true, onRamp: false });
    const ledges: { x: number; row: number }[] = [];
    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < 260; x++) if (b.grid[y][x] === '=' && b.grid[y][x - 1] !== '=') ledges.push({ x, row: y });
    }
    ledges.sort((a, c) => a.x - c.x);
    expect(ledges.length).toBeGreaterThan(8);
    for (const l of ledges) {
      const under = groundRow(b, l.x + 2);
      expect(under - l.row, `ledge at ${l.x}`).toBeGreaterThanOrEqual(HI - 1);
    }
    for (let i = 1; i < ledges.length; i++) {
      // Downward steps are never more than a jump; a bigger rise gets a spring.
      expect(ledges[i].row - ledges[i - 1].row).toBeLessThanOrEqual(4);
    }
    expect(b.crystals).toHaveLength(1);
    expect(b.monitors.some((m) => m.kind === 'rings10')).toBe(true);
  });

  it('onRamp: a stretch nothing else reaches gets stepping ledges, each a jump high', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    b.floor(0, 259, 40);
    highRoad(b, 60, 120, { onRamp: true });
    // From the ground (row 40) to the first ledge (row 29) no step is more than a jump.
    const rows = new Set<number>();
    for (let y = 0; y < 40; y++) for (let x = 48; x < 62; x++) if (b.grid[y][x] === '=') rows.add(y);
    const climb = [40, ...[...rows].sort((a, c) => c - a)];
    expect(climb[climb.length - 1]).toBe(40 - HI);
    for (let i = 1; i < climb.length; i++) expect(climb[i - 1] - climb[i]).toBeLessThanOrEqual(5);
    // Where a valley ledge already stands within a jump, it adds nothing.
    const v = new LevelBuilder(260, WORLD_ROWS);
    v.floor(0, 259, 40);
    v.platform(50, 58, 33);
    const before = v.grid.map((r) => r.join('')).join('').split('=').length;
    highRoad(v, 60, 60 + 8, { onRamp: true });
    const added = v.grid.map((r) => r.join('')).join('').split('=').length - before;
    expect(added).toBe(9); // the ledge itself, no steps
  });

  it('a loop hill offers a way onto its own roof', () => {
    const def = bench((b) => {
      b.floor(0, 19, 30);
      b.start(4, 30);
      const c = loopHill(b, 20, 30, { drop: 6, roof: 'shield' });
      b.floor(c.endX, 259, c.endRow);
      b.goal(200, c.endRow);
    });
    const level = new Level(def);
    const can = reach(level);
    expect(can.deadLedges).toEqual([]);
    expect(can.canTake(level.monitors[0].x, level.monitors[0].y)).toBe(true);
    // The step is outside the loop: nothing solid in the annulus's box.
    const loop = level.loops[0];
    for (let tx = Math.floor((loop.cx - loop.outerR) / T); tx <= Math.ceil((loop.cx + loop.outerR) / T); tx++) {
      for (let ty = Math.floor((loop.cy - loop.outerR) / T); ty < Math.floor((loop.cy + loop.innerR) / T); ty++) {
        expect(level.map.get(tx, ty, 0).heights.some((h) => h > 0)).toBe(false);
      }
    }
  });

  it('reach: a catwalk with nothing leading up to it is reported, and an on-ramp cures it', () => {
    const flat = (onRamp: boolean) =>
      new Level(
        bench((b) => {
          b.floor(0, 259, 40);
          b.start(4, 40);
          highRoad(b, 60, 120, { onRamp, monitors: ['rings10'] });
          b.goal(200, 40);
        }),
      );
    const dead = reach(flat(false));
    expect(dead.deadLedges.length).toBeGreaterThan(3);
    expect(dead.canTake(flat(false).monitors[0].x, flat(false).monitors[0].y)).toBe(false);
    const live = reach(flat(true));
    expect(live.deadLedges).toEqual([]);
    expect(live.canTake(flat(true).monitors[0].x, flat(true).monitors[0].y)).toBe(true);
  });

  it('highRoad never buries a prize that is already there', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    b.floor(0, 259, 40);
    const c = loopHill(b, 20, 40, { drop: 6, roof: 'shield' });
    highRoad(b, 10, c.endX);
    const roof = b.monitors[0];
    const tx = Math.floor(roof.x / T);
    for (let y = Math.floor(roof.y / T) - 1; y <= Math.floor(roof.y / T); y++) expect(b.grid[y][tx]).toBe('.');
  });

  it('highRoad never overwrites what a section already built', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    const c = rollingStart(b, 0, 26);
    launchValley(b, c.endX, c.endRow, { depth: 12 });
    const before = b.grid.map((r) => r.join('')).join('\n');
    highRoad(b, 60, 120);
    const after = b.grid.map((r) => r.join(''));
    before.split('\n').forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') expect(after[y][x]).toBe(row[x]);
    });
  });

  it('droneBridge: holding jump keeps the bounce, so a row of drones is a bridge', () => {
    const def = bench((b) => {
      b.floor(0, 259, 40);
      b.start(4, 40);
      droneBridge(b, 20, { drones: 3 });
      b.goal(200, 40);
    });
    const level = new Level(def);
    expect(level.drones).toHaveLength(3);
    const p = new Player(100, 100);
    p.grounded = false;
    p.ysp = 7;
    p.bounce();
    expect(p.ysp).toBe(-7); // the fall, reversed
    p.update(level.map, input({ jump: true }));
    expect(p.ysp).toBeLessThan(-6); // held: kept
    p.ysp = 7;
    p.bounce();
    p.update(level.map, input({}));
    expect(p.ysp).toBeGreaterThanOrEqual(-PHYS.jrel); // released: the usual small hop
    p.ysp = 20;
    p.bounce();
    expect(p.ysp).toBe(-BOUNCE.max);
  });

  it('lowRoad: a gallery under level ground, in by the shaft, out by the springs', () => {
    const def = bench((b) => {
      b.floor(0, 259, 30);
      b.start(4, 30);
      lowRoad(b, 40, 100, { shafts: [44], crabs: 0, secret: true });
      b.goal(200, 30);
    });
    const r = runBot(def, 'faller', 3000, { col: 45, row: 32 });
    expect(r.road.get(70)).toBeCloseTo(30 + LO, 0);
    expect(r.reached).toBe(true);
    expect(r.level.secrets[0].found).toBe(true);
  });

  it('lowRoad refuses to be dug under a slope, and says where', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    ground(b);
    expect(() => lowRoad(b, 20, 60)).toThrow(/level ground.*column/);
  });

  it('sections refuse geometry that does not fit the world', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    expect(() => launchValley(b, 0, 54, { depth: 12 })).toThrow(/bedrock/);
    expect(() => loopHill(b, 0, 6)).toThrow(/does not fit/);
  });
});
