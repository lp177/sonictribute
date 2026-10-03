import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { RAIL } from '../src/game/entities.ts';
import { PHYS } from '../src/physics/constants.ts';
import { WORLD_ROWS, groundRow, tubeShot } from '../src/levels/sections.ts';
import { skyRail, ribbon, roofedTube, rooftops, lightStair, lightBridge } from '../src/levels/tomorrow/pieces.ts';
import { runBot } from './bots.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

function bench(build: (b: LevelBuilder) => void, width = 260): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 3, theme: 'neon', width, height: WORLD_ROWS, build };
}

/** A hero standing on the surface at (col, row), settled. */
function standAt(level: Level, col: number, row: number): Player {
  const p = new Player(col * T + T / 2, row * T - PHYS.heightRadius - 2);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  return p;
}

const feetRow = (p: Player) => Math.round((p.y + p.h) / T);

describe('skyRail: a rail that takes over where the road ends', () => {
  // Lip at row 24 (columns 40-44), rail head at column 46, far bank at row 32
  // from column 86.
  const def = bench((b) => {
    b.floor(0, 39, 24);
    b.start(4, 24);
    const c = skyRail(b, 40, 24, { drop: 8, len: 40, crystal: true });
    expect(c.endRow).toBe(32);
    expect(c.endX).toBe(96);
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('carries whoever leaves the lip, at any pace, and sets them down on the far bank', () => {
    for (const pace of [1, 3, 6, 9, 12]) {
      const level = new Level(def);
      const p = standAt(level, 42, 24);
      let rode = 0;
      let slowest = Infinity;
      let setDown: { col: number; row: number } | null = null;
      for (let f = 0; f < 900 && !setDown; f++) {
        if (p.grounded && !p.railing && p.x < 45 * T) p.gsp = pace; // hold the approach pace up to the lip
        p.update(level.map, input({ right: true }));
        level.update(p);
        if (p.railing) {
          // The catch frame still shows the approach pace; the rail's own
          // speed is whatever it holds from the next frame on.
          if (++rode > 1) slowest = Math.min(slowest, p.gsp);
        } else if (rode > 0 && p.grounded) setDown = { col: p.x / T, row: feetRow(p) };
      }
      expect(rode, `pace ${pace}: frames on the rail`).toBeGreaterThan(30);
      expect(slowest, `pace ${pace}`).toBeGreaterThanOrEqual(RAIL.min);
      expect(setDown!.row, `pace ${pace}`).toBe(32);
      expect(setDown!.col, `pace ${pace}`).toBeGreaterThanOrEqual(86);
    }
  });

  it('has a real road under the ribbon, and nothing on the far bank but ground', () => {
    // Dropped on the valley floor: out by holding right, never a dead end.
    const walker = runBot(def, 'faller', 3000, { col: 62, row: 36 });
    expect(walker.reached).toBe(true);
    expect(walker.worstStall).toBeLessThan(120);
    expect(Math.round(walker.road.get(64)!)).toBe(36);
    const level = new Level(def);
    expect(level.rails).toHaveLength(1);
    for (const h of level.hoppers) expect(h.x / T).toBeLessThan(80);
    expect([...level.enemies, ...level.traps, ...level.spikes]).toHaveLength(0);
    // The crystal hangs over the rail's midpoint, a jump above it.
    const rail = level.rails[0];
    const crystal = level.crystals[0];
    const over = (rail.yAt(crystal.x)! - crystal.y) / T;
    expect(over).toBeGreaterThan(3);
    expect(over).toBeLessThan(6);
  });
});

describe('ribbon: a rail between two ledges of the high road', () => {
  const build = (b: LevelBuilder) => {
    b.floor(0, 259, 44);
    b.start(4, 44);
    b.platform(20, 29, 30);
    b.platform(60, 69, 26); // the landing is HIGHER: the ride goes uphill
    ribbon(b, 30, 30, 60, 26);
    b.goal(250, 44);
  };

  it('carries a runner off the ledge to its landing, even uphill', () => {
    const level = new Level(bench(build));
    const p = standAt(level, 24, 30);
    let rode = 0;
    for (let f = 0; f < 400; f++) {
      p.update(level.map, input({ right: true }));
      level.update(p);
      if (p.railing) rode++;
      else if (rode > 0 && p.grounded) break;
    }
    expect(rode).toBeGreaterThan(20);
    expect(feetRow(p)).toBe(26);
    expect(p.x / T).toBeGreaterThanOrEqual(60);
  });

  it('never snatches a walker passing underneath', () => {
    const level = new Level(bench(build));
    const p = standAt(level, 10, 44);
    for (let f = 0; f < 700; f++) {
      p.update(level.map, input({ right: true }));
      level.update(p);
      expect(p.railing).toBe(false);
    }
    expect(p.x / T).toBeGreaterThan(70);
  });

  it('refuses a line with something in the way, or with nothing to land on', () => {
    const blocked = new LevelBuilder(260, WORLD_ROWS);
    blocked.floor(0, 259, 44);
    blocked.platform(60, 69, 26);
    blocked.platform(40, 44, 29);
    expect(() => ribbon(blocked, 30, 30, 60, 26)).toThrow(/not clear at column 4\d/);
    const nowhere = new LevelBuilder(260, WORLD_ROWS);
    nowhere.floor(0, 259, 44);
    expect(() => ribbon(nowhere, 30, 30, 60, 26)).toThrow(/no landing/);
  });
});

describe('roofedTube: the way off the bluff', () => {
  const make = (tube: typeof tubeShot) =>
    bench((b) => {
      b.floor(0, 19, 24);
      b.start(4, 24);
      const c = tube(b, 20, 24, { drop: 8, runout: 60 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(240, c.endRow);
    });
  // The bluff's last column is 41, the kicker stands at 44-48 and the strip
  // is row 32. The roof's own row is the kit's to choose.
  const grid = new LevelBuilder(260, WORLD_ROWS);
  make(roofedTube).build(grid);
  const ROOF = groundRow(grid, 41);

  it('catches whoever comes down over the kicker, and sets them on the strip', () => {
    for (let x = 42; x <= 51; x++) expect(grid.grid[ROOF][x]).toBe('='); // the awning, level with the roof
    // Off the roof's edge at a walk, and straight out of the sky over each
    // column of the kicker. (On the plain tube the last two pin a hero on the
    // kicker's face for 300-400 frames.)
    const drops = [{ col: 40, row: ROOF }, ...[42, 44, 46, 47, 48].map((col) => ({ col, row: ROOF - 8 }))];
    for (const spawn of drops) {
      const r = runBot(make(roofedTube), 'faller', 6000, spawn);
      expect(r.reached, `from column ${spawn.col}`).toBe(true);
      expect(r.worstStall, `from column ${spawn.col}`).toBeLessThan(30);
      const strip = [...r.road].filter(([, row]) => Math.round(row) === 32).map(([col]) => col);
      expect(Math.min(...strip), `from column ${spawn.col}`).toBeGreaterThan(49); // first touched the strip past the lip
    }
  });

  it('leaves the tunnel itself alone: the launch passes far under the awning', () => {
    for (const style of ['naive', 'roller'] as const) {
      const through = runBot(make(roofedTube), style);
      expect(through.reached, style).toBe(true);
      expect(through.worstStall, style).toBeLessThan(30);
      const up = [...through.road].filter(([col, row]) => col >= 42 && col <= 52 && Math.round(row) === ROOF);
      expect(up, style).toHaveLength(0);
    }
  });
});

describe('rooftops: tower blocks with a street under them', () => {
  // Roofs at rows 30, 28, 29, 27, 30; street at row 38; first alley 37-40.
  const def = bench((b) => {
    b.floor(0, 29, 30);
    b.start(4, 30);
    const c = rooftops(b, 30, 30, { droneEvery: 2, room: 'shield', secret: true });
    expect(c.endX).toBe(89);
    expect(c.endRow).toBe(30);
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('is crossed over the roofs or along the street, and the street lifts you out', () => {
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(120);
    }
    const street = runBot(def, 'faller');
    expect(Math.round(street.road.get(60)!)).toBe(38); // under the third block
    const after = [...street.road].filter(([col]) => col > 92).map(([, row]) => Math.round(row));
    expect(after.length).toBeGreaterThan(20);
    expect(new Set(after)).toEqual(new Set([30])); // and back on the road
  });

  it('hides a back room off the first alley, against the direction of travel', () => {
    const level = new Level(def);
    expect(level.secrets).toHaveLength(1);
    const p = standAt(level, 38, 38);
    for (let f = 0; f < 240; f++) {
      p.update(level.map, input({ left: true }));
      level.update(p);
    }
    expect(level.secrets[0].found).toBe(true);
    // ...and leaves by walking back out.
    const out = runBot(def, 'faller', 3000, { col: 33, row: 38 });
    expect(out.reached).toBe(true);
  });

  it('refuses a roof that would not clear the street', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    expect(() => rooftops(b, 30, 30, { steps: [0, 4], depth: 8 })).toThrow(/does not clear the street/);
  });
});

/** Every pair of neighbouring phase platforms has at least one lit, on every frame of a cycle. */
function neverBothDark(level: Level, period: number): void {
  const plats = [...level.phasePlats].sort((a, c) => a.x - c.x);
  for (let f = 0; f < period; f++) {
    for (const pl of plats) pl.update();
    for (let i = 1; i < plats.length; i++) {
      if (plats[i].x - (plats[i - 1].x + plats[i - 1].w) > 2 * T) continue; // not neighbours (the pier lies between)
      expect(plats[i].solid || plats[i - 1].solid, `frame ${f}, spans ${i - 1} and ${i}`).toBe(true);
    }
  }
}

describe('lightStair: the way up, in hard light', () => {
  const def = bench((b) => {
    b.floor(0, 259, 40);
    b.start(4, 40);
    const c = lightStair(b, 20, 40, { steps: 4, period: 160, prize: 'shield' });
    expect(c.endRow).toBe(25);
    expect(c.endX).toBe(52);
    b.goal(250, 40);
  });

  it('climbs a jump at a time and never leaves two neighbours dark', () => {
    const level = new Level(def);
    const steps = [...level.phasePlats].sort((a, c) => a.x - c.x);
    expect(steps).toHaveLength(4);
    steps.forEach((s, i) => {
      expect(s.y / T).toBe(40 - 3 * (i + 1)); // three rows a step: half a jump
      expect(s.w / T).toBe(4);
    });
    neverBothDark(level, 160);
    // It arrives on a real ledge, with the prize.
    const b = new LevelBuilder(260, WORLD_ROWS);
    def.build(b);
    for (let x = 44; x <= 51; x++) expect(b.grid[25][x]).toBe('=');
    expect(level.monitors[0].kind).toBe('shield');
  });

  it('carries a hero who lands on a lit step, and drops nobody anywhere but the road', () => {
    const level = new Level(def);
    const step = [...level.phasePlats].sort((a, c) => a.x - c.x)[0];
    const p = new Player(step.x + step.w / 2, step.y - 60);
    for (let f = 0; f < 40; f++) {
      p.update(level.map, NO_INPUT);
      level.update(p);
    }
    expect(p.grounded).toBe(true);
    expect((p.y + p.h) / T).toBeCloseTo(37, 0);
    for (const style of ['naive', 'faller'] as const) expect(runBot(def, style).reached, style).toBe(true);
  });
});

describe('lightBridge: a valley roofed in hard light', () => {
  // Rims at row 30 (columns 40-43 and 80-83), basin at row 36, pier 60-63.
  const def = bench((b) => {
    b.floor(0, 39, 30);
    b.start(4, 30);
    const c = lightBridge(b, 40, 30, { depth: 6, basin: 12, period: 160, hazards: 2, prize: 'shield' });
    expect(c.endRow).toBe(30);
    expect(c.endX).toBe(84);
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('spans the dip rim to rim, with one real pier and no two neighbours dark', () => {
    const level = new Level(def);
    expect(level.phasePlats).toHaveLength(8);
    for (const s of level.phasePlats) expect(s.y / T).toBe(30);
    neverBothDark(level, 160);
    const b = new LevelBuilder(260, WORLD_ROWS);
    def.build(b);
    for (let x = 60; x <= 63; x++) expect(b.grid[30][x]).toBe('=');
    expect(Math.abs(level.monitors[0].x / T - 62.5)).toBeLessThan(1);
  });

  it('is only ever a choice: the road under it leads on by itself', () => {
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(150);
    }
    // From the bottom of the dip, on foot.
    const low = runBot(def, 'faller', 3000, { col: 58, row: 36 });
    expect(low.reached).toBe(true);
    expect(Math.round(Math.max(...low.road.values()))).toBe(36);
    expect(() => lightBridge(new LevelBuilder(260, WORLD_ROWS), 40, 30, { basin: 10 })).toThrow(/multiple of 4/);
  });
});
