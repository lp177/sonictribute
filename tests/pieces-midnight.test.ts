import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { PHYS } from '../src/physics/constants.ts';
import { WORLD_ROWS, rollingStart } from '../src/levels/sections.ts';
import { slagChute, needleChute, pressHall, shiftBridge, vault, valley } from '../src/levels/midnight/pieces.ts';
import { midnight05 } from '../src/levels/midnight/act05.ts';
import { runBot } from './bots.ts';

const T = PHYS.tile;

function bench(build: (b: LevelBuilder) => void, width = 300): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 1, theme: 'gear', width, height: WORLD_ROWS, build };
}

/** Deepest and highest row a bot stood on between two columns. */
function rows(road: Map<number, number>, from: number, to: number): { top: number; bottom: number } {
  const seen = [...road].filter(([col]) => col >= from && col <= to).map(([, row]) => row);
  return { top: Math.min(...seen), bottom: Math.max(...seen) };
}

describe('slagChute: a channel, and a line strung over it', () => {
  // rollingStart ends at column 30, row 28: near dock 28, far dock 38, bed 42.
  const chute = (line: 'cart' | 'rail') =>
    bench((b) => {
      let c = rollingStart(b, 0, 24);
      c = slagChute(b, c.endX, c.endRow, { drop: 10, bed: 10, line, prize: 'crystal' });
      b.floor(c.endX, 299, c.endRow);
      b.goal(280, c.endRow);
    });

  it('the cart carries whoever stays aboard down to the far dock, and its buffer costs one hit', () => {
    const r = runBot(chute('cart'), 'faller');
    expect(r.reached).toBe(true);
    expect(r.level.carts).toHaveLength(1);
    expect(r.level.tookDamage).toBe(true); // rode it into the buffer
    expect(rows(r.road, 40, 70).bottom).toBeLessThan(39); // never touched the bed
  });

  it('bailing out early lands on the service catwalk over the bed, and still leads on', () => {
    const r = runBot(chute('cart'), 'naive'); // jumps out the moment the dock ends
    expect(r.reached).toBe(true);
    expect(rows(r.road, 53, 60).bottom).toBeCloseTo(38, 0); // the catwalk, level with the far dock
    expect(r.level.tookDamage).toBe(false); // the cart crashed without him
  });

  it('the bed walks out by holding right', () => {
    const r = runBot(chute('cart'), 'faller', 3000, { col: 54, row: 42 });
    expect(r.reached).toBe(true);
    expect(r.worstStall).toBeLessThan(60);
  });

  it('skipping the cart and rolling the slag face is the fast road', () => {
    const r = runBot(chute('cart'), 'roller', 3000, { col: 37, row: 28 }); // set down past the cart
    expect(r.reached).toBe(true);
    expect(r.topSpeed).toBeGreaterThan(10);
    expect(r.level.tookDamage).toBe(false); // it rolled through the bed's crab
  });

  it('the skyhook rail hands you on faster than it took you, unhurt', () => {
    const r = runBot(chute('rail'), 'faller');
    expect(r.reached).toBe(true);
    expect(r.level.rails).toHaveLength(1);
    expect(r.level.dashPads).toHaveLength(0);
    expect(r.topSpeed).toBeGreaterThan(9.5);
    expect(r.level.tookDamage).toBe(false);
    expect(r.frames).toBeLessThan(runBot(chute('cart'), 'faller').frames);
  });
});

describe('needleChute: the roof comes down behind you', () => {
  const def = bench((b) => {
    let c = rollingStart(b, 0, 24);
    c = needleChute(b, c.endX, c.endRow, { drop: 10, every: 1 });
    b.floor(c.endX, 299, c.endRow);
    b.goal(72, c.endRow); // just past the chute: the needles have not regrown yet
  });

  it('at a run or a roll every needle is armed and none lands on the hero', () => {
    for (const style of ['faller', 'roller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
      expect(r.level.stalactites).toHaveLength(5);
      expect(r.level.stalactites.filter((s) => s.state !== 'hanging').length, style).toBeGreaterThanOrEqual(4);
      expect(r.level.tookDamage, style).toBe(false);
    }
  });

  it('a hero who stands still under one is hit by it', () => {
    const level = new Level(def);
    const st = level.stalactites[2];
    const p = new Player(st.x + 4, 33 * T - 30); // set down on the slope under the third bay
    for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
    p.rings = 5;
    for (let f = 0; f < 120; f++) {
      p.update(level.map, NO_INPUT);
      level.update(p);
    }
    expect(level.tookDamage).toBe(true);
  });

  it('the roof steps down with the road: five rows of headroom in every bay', () => {
    const b = new LevelBuilder(300, WORLD_ROWS);
    const c = rollingStart(b, 0, 24);
    needleChute(b, c.endX, c.endRow, { drop: 10 });
    for (let i = 0; i < 5; i++) {
      const x = c.endX + 2 + i * 4;
      const surface = c.endRow + i * 2;
      expect(b.grid[surface - 6][x]).toBe('#'); // the slab's underside
      for (let y = surface - 5; y < surface; y++) expect(b.grid[y][x], `bay ${i} row ${y}`).toBe('.');
    }
  });
});

describe('pressHall: speed takes the catwalk, a walk takes the machines', () => {
  // An 8-row ramp is worth ~7.4 px/frame run and ~9 rolled; the press bed is a runner's arc over the lip.
  const hall = (drop: number) =>
    bench((b) => {
      let c = rollingStart(b, 0, 24, { drop });
      c = pressHall(b, c.endX, c.endRow, { lead: 4, len: 30, prize: 'crystal' });
      b.floor(c.endX, 299, c.endRow);
      b.goal(280, c.endRow);
    });

  it('a rolled ramp is thrown onto the press bed and crosses clean', () => {
    const r = runBot(hall(8), 'roller');
    expect(r.reached).toBe(true);
    expect(rows(r.road, 50, 72).top).toBeCloseTo(24, 0); // road row 32, bed eight rows over it
    expect(r.level.tookDamage).toBe(false);
  });

  it('a walked ramp hops off the lip into the hall, and the hall still leads on', () => {
    const r = runBot(hall(2), 'faller');
    expect(r.reached).toBe(true);
    expect(rows(r.road, 44, 66).bottom).toBeCloseTo(30, 0); // road row 26, hall floor four rows under it
  });

  it('has no booster and leaves its first ten columns clear of machinery', () => {
    const level = new Level(hall(8));
    expect(level.dashPads).toHaveLength(0);
    expect(level.launchers).toHaveLength(0);
    const firstHallCol = 38 + 4 + 5; // x + lead + kicker
    for (const t of level.traps) expect(t.x / T).toBeGreaterThan(firstHallCol + 10);
    for (const h of level.hoppers) expect(h.x / T).toBeGreaterThan(firstHallCol + 10);
    for (const s of level.swings) expect(s.pivotX / T).toBeGreaterThan(firstHallCol + 10);
  });
});

describe('shiftBridge: only there half the shift', () => {
  // The same bridge, reached a little later each time by lengthening the road before it.
  const bridge = (delay: number) =>
    bench((b) => {
      let c = rollingStart(b, 0, 24);
      b.floor(c.endX, c.endX + delay, c.endRow);
      c = shiftBridge(b, c.endX + delay + 1, c.endRow, { depth: 6, bed: 16, period: 200, prize: 'crystal' });
      b.floor(c.endX, 299, c.endRow);
      b.goal(280, c.endRow);
    });

  it('stepped onto as it lights, the hard light carries a runner rim to rim', () => {
    const r = runBot(bridge(50), 'faller');
    expect(r.reached).toBe(true);
    // Never in the trough (its bed is row 34). The last panels overlap the
    // top of the climb-out, so the feet may touch the ramp a few px under the
    // road there.
    expect(Math.max(...r.road.values())).toBeLessThan(29);
    expect(r.level.tookDamage).toBe(false);
  });

  it('caught by the dark it drops you in the trough, which climbs out by holding right', () => {
    const r = runBot(bridge(0), 'faller');
    expect(r.reached).toBe(true);
    expect(Math.max(...r.road.values())).toBeGreaterThan(31); // four rows under the road: in the trough
    expect(r.player.dead).toBe(false);
  });

  it('is hard light, not terrain: the trough under it is square-walled and solid-floored', () => {
    const b = new LevelBuilder(300, WORLD_ROWS);
    const c = shiftBridge(b, 40, 28, { depth: 6, bed: 16 });
    expect(c.endRow).toBe(28);
    expect(b.phaseDefs.length).toBe(7); // 28 columns of bridge in four-column panels
    expect(b.grid[28][44]).toBe('.'); // the ground really is gone under the first panel
    expect(b.grid[34][44]).toBe('#');
    for (let x = 40; x < c.endX; x++) expect(b.grid[WORLD_ROWS - 1][x]).toBe('#'); // never bottomless
  });
});

describe('vault and valley: what the shared kit gets wrong for a hold-right hero', () => {
  it('vault: fallen into from anywhere in the room, holding right lifts you out', () => {
    const def = bench((b) => {
      b.floor(0, 49, 30);
      b.start(10, 30);
      const c = vault(b, 50, 30, { reward: 'crystal' });
      b.floor(c.endX, 299, c.endRow);
      b.goal(280, c.endRow);
    });
    for (const col of [52, 54, 56, 57]) {
      const r = runBot(def, 'faller', 3000, { col, row: 34 });
      expect(r.reached, `from column ${col}`).toBe(true);
      expect(r.worstStall, `from column ${col}`).toBeLessThan(60);
      expect(r.level.secrets[0].found).toBe(true);
    }
    expect(runBot(def, 'faller', 3000, { col: 52, row: 34 }).level.crystals[0].taken).toBe(true);
  });

  it('valley: a slow walker on the valley floor can always climb out', () => {
    for (const out of [8, 10, 12, 14]) {
      const def = bench((b) => {
        let c = rollingStart(b, 0, 26);
        c = valley(b, c.endX, c.endRow, { depth: 12, out, crabs: 0, retrySpring: false });
        b.floor(c.endX, 299, c.endRow);
        b.goal(280, c.endRow);
      });
      // Set down at rest on the valley floor, a few columns before the climb.
      const r = runBot(def, 'faller', 3000, { col: 98, row: 42 });
      expect(r.reached, `out ${out}`).toBe(true);
      expect(r.worstStall, `out ${out}`).toBeLessThan(60);
    }
  });
});

describe('Coolant Undercroft: the coolant main', () => {
  // The contract's bots run straight over a three-column shaft, so the gate
  // never walks this gallery. Set a bot down inside it instead.
  const level = new Level(midnight05);
  const { w, h } = level.map;
  const air = (x: number, y: number) => !level.map.get(x, y, 0).heights.some((v) => v > 0);
  // The main is the one gallery six rows high: find its floor and its first column.
  let floor = 0;
  let head = 0;
  for (let y = h - 3; y > 40 && !floor; y--) {
    for (let x = 0; x < w && !floor; x++) {
      if (!air(x, y) && [1, 2, 3, 4, 5, 6].every((d) => air(x, y - d)) && !air(x, y - 7) && !air(x - 1, y - 1)) {
        floor = y;
        head = x;
      }
    }
  }

  it('is a gallery two hundred columns long under the road', () => {
    expect(floor).toBeGreaterThan(50);
    let len = 0;
    while (air(head + len, floor - 1)) len++;
    expect(len).toBeGreaterThan(190);
    expect(level.rails.filter((r) => r.y0 > 48 * T).length).toBe(2); // its two pipe runs
  });

  it('entered at its head, it walks out the far end by holding right', () => {
    for (const style of ['faller', 'roller'] as const) {
      const r = runBot(midnight05, style, 20000, { col: head + 3, row: floor });
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(120);
      // It came out through the store-room at the main's far end.
      expect(r.level.secrets.some((s) => s.found && s.y > 45 * T), style).toBe(true);
    }
  });
});
