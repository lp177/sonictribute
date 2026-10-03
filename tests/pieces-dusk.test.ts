import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { PHYS } from '../src/physics/constants.ts';
import { WORLD_ROWS } from '../src/levels/sections.ts';
import { gliderBay, thermalCliff, reefBowl, tideFlats, crumbleSpan } from '../src/levels/dusk/pieces.ts';
import { runBot } from './bots.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

function bench(build: (b: LevelBuilder) => void, width = 260): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 0, theme: 'verdant', width, height: WORLD_ROWS, build };
}

type Hands = (p: Player, level: Level) => { right?: boolean; down?: boolean; jump?: boolean; jumpPressed?: boolean };

/** Plays a bench from its start with scripted hands; reports every landing and what was picked up. */
function play(def: LevelDef, hands: Hands, frames = 1500) {
  const level = new Level(def);
  const p = new Player(level.startPos.x, level.startPos.y);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  const landings: { col: number; row: number }[] = [];
  let glided = 0;
  for (let f = 0; f < frames; f++) {
    const was = p.grounded;
    p.update(level.map, input(hands(p, level)));
    level.update(p);
    if (p.gliding) glided++;
    if (!was && p.grounded) landings.push({ col: Math.floor(p.x / T), row: Math.round((p.y + p.h) / T) });
  }
  return { level, p, landings, glided };
}

/** Holds right, and holds jump from the moment a fall starts: how the wing is flown. */
const pilot: Hands = (p) => ({ right: true, jump: !p.grounded && (p.ysp > 0 || p.gliding) });
const rollingPilot: Hands = (p) => ({ ...pilot(p, null as never), down: p.grounded && !p.rolling && Math.abs(p.gsp) > 2.5 });
const runner: Hands = () => ({ right: true });

describe('gliderBay: the height the wing opens at is the speed you arrived with', () => {
  const ROW = 30;
  const ROOST = ROW - 3;
  const UPPER = ROW - 9;
  /**
   * `feed` rows of gentle downhill before the bay; 0 = a standing start AT
   * the pickup, five columns from the kicker. (Two columns further back is
   * already a run-up: the hero is quick off the line.)
   */
  const bay = (feed: number, thermal: boolean) =>
    bench((b) => {
      b.floor(0, 9, ROW - feed);
      b.start(feed > 0 ? 4 : 13, ROW - feed);
      if (feed > 0) b.gentleDown(10, ROW - feed, feed);
      const x = 10 + feed * 2;
      const c = gliderBay(b, x, ROW, { width: 56, depth: 12, out: 8, thermal, upper: 'crystal', prize: 'rings10' });
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });
  const firstPastLip = (r: ReturnType<typeof play>, feed: number) => r.landings.find((l) => l.col > 10 + feed * 2 + 13)!;

  it('a stroll sinks toward the water and the thermal lifts it onto the roost', () => {
    const r = play(bay(0, true), pilot);
    expect(r.p.hasGlider).toBe(true);
    expect(r.glided).toBeGreaterThan(60);
    expect(firstPastLip(r, 0).row).toBe(ROOST);
  });

  it('without the thermal the same stroll comes down in the bay — and still walks out', () => {
    const r = play(bay(0, false), pilot);
    expect(firstPastLip(r, 0).row).toBeGreaterThan(ROW);
    expect(runBot(bay(0, false), 'faller').reached).toBe(true);
  });

  it('a run off a downhill reaches the roost with no thermal at all', () => {
    expect(firstPastLip(play(bay(8, false), pilot), 8).row).toBe(ROOST);
  });

  it('a roll off a real downhill opens high enough for the upper roost and its prize', () => {
    const r = play(bay(12, false), rollingPilot);
    expect(firstPastLip(r, 12).row).toBe(UPPER);
    expect(r.level.crystals[0].taken).toBe(true);
    // The run that reached the roost never gets this high.
    expect(play(bay(8, false), pilot).level.crystals[0].taken).toBe(false);
  });

  it('can lay its own downhill: a feed of 12 rows puts a rolled wing on the upper roost from a standing start', () => {
    const def = bench((b) => {
      b.floor(0, 9, ROW - 12);
      b.start(4, ROW - 12);
      const c = gliderBay(b, 10, ROW - 12, { feed: 12, width: 56, depth: 12, out: 8, thermal: false, upper: 'crystal', prize: 'rings10' });
      expect(c.endRow).toBe(ROW + 12 - 8);
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });
    const r = play(def, rollingPilot);
    expect(firstPastLip(r, 12).row).toBe(UPPER);
    expect(r.level.crystals[0].taken).toBe(true);
  });

  it('with no wing in hand it is a bay with a floor: every bot crosses it', () => {
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(bay(8, true), style);
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(120);
    }
    expect(new Level(bay(8, true)).dashPads).toHaveLength(0);
  });
});

describe('thermalCliff: the sea wind is the way up', () => {
  const def = bench((b) => {
    b.floor(0, 19, 44);
    b.start(14, 44);
    const c = thermalCliff(b, 20, 44, { rise: 12, prize: 'crystal' });
    expect(c.endRow).toBe(32);
    b.floor(c.endX, 259, c.endRow);
    b.goal(200, c.endRow);
  });

  it('jump into the column holding right and it sets you on the clifftop, not past it', () => {
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(140);
    }
    // The first ground touched after the foot is the clifftop itself (columns
    // 28-37) — a spring of the same height would land twenty columns on.
    const r = runBot(def, 'naive');
    const top = [...r.road].filter(([, row]) => Math.round(row) === 32).map(([col]) => col);
    expect(Math.min(...top)).toBeLessThanOrEqual(37);
  });

  it('let go of right, ride the column to its head, and it sets you on the perch with the prize', () => {
    // Walk to the wall, jump, and steer only once the column has let go of you.
    let jumped = false;
    const r = play(def, (p, level) => {
      const inWind = !p.grounded && level.winds.some((w) => w.contains(p.x, p.y));
      const press = p.grounded && !jumped && p.x > 26 * T;
      if (press) jumped = true;
      return { right: !inWind, jump: press || (!p.grounded && p.ysp < 0), jumpPressed: press };
    }, 900);
    expect(r.level.crystals[0].taken).toBe(true);
    expect(r.landings.some((l) => l.row === 32 - 6)).toBe(true);
  });
});

describe('reefBowl: a bowl fed by its hill', () => {
  const bowl = (lift: number) =>
    bench((b) => {
      b.floor(0, 9, 30);
      b.start(4, 30);
      b.gentleDown(10, 30, 4);
      const c = reefBowl(b, 18, 34, { drop: 4, basin: 8, lift, prize: 'crystal' });
      expect(c.endRow).toBe(38 - lift);
      b.floor(c.endX, 259, c.endRow);
      b.goal(240, c.endRow);
    });
  const LIP = 18 + 2 + 8 + 10 + 8; // first column past the far lip

  it('uses no booster: the speed is the downhill', () => {
    expect(new Level(bowl(0)).dashPads).toHaveLength(0);
  });

  it('a run is flung out over the pool onto the shelf above the landing', () => {
    const r = play(bowl(0), runner);
    const first = r.landings.find((l) => l.col > LIP)!;
    expect(first.row).toBe(38 - 12); // the shelf
    expect(first.col).toBeGreaterThan(LIP + 15);
    expect(r.level.crystals[0].taken).toBe(true);
  });

  it('the far reef can stand ten rows over the lip: a bowl is a way to climb', () => {
    const r = play(bowl(10), runner);
    const first = r.landings.find((l) => l.col > LIP + 8)!;
    expect(first.row).toBeLessThanOrEqual(28); // the reef (row 28) or its shelf
    expect(r.p.x).toBeGreaterThan((LIP + 30) * T);
  });

  it('a walker steps over the lip into the pool, and the spring still puts them up the reef', () => {
    // Parked in the basin: no descent behind them.
    const r = runBot(bowl(10), 'faller', 3000, { col: 18 + 2 + 8 + 5, row: 42 });
    expect(r.reached).toBe(true);
    expect(r.player.dead).toBe(false);
  });
});

describe('tideFlats: one hopper to a pool', () => {
  const def = bench((b) => {
    b.floor(0, 19, 30);
    b.start(4, 30);
    const c = tideFlats(b, 20, 30, { pools: 3, depth: 2, prize: 'crystal' });
    expect(c).toEqual({ endX: 20 + 3 * 16 + 2, endRow: 30 });
    b.floor(c.endX, 259, 30);
    b.goal(200, 30);
  });

  it('every pool has its hopper and a ring arc over its leap', () => {
    const level = new Level(def);
    expect(level.hoppers).toHaveLength(3);
    for (const h of level.hoppers) {
      const arc = level.rings.filter((r) => Math.abs(r.x - (h.x0 + 24)) < 40 && r.y < h.groundY - 20);
      expect(arc.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('a ball pops the hoppers it meets; walking through costs time, never the run', () => {
    // Curled the whole way (a hopper in mid-leap is over a ball's head, so
    // not every one has to go: at least one is on its pad when the ball comes).
    const ball = play(def, (p) => ({ right: true, down: p.grounded && !p.rolling && Math.abs(p.gsp) > 2.5 }), 900);
    expect(ball.p.x).toBeGreaterThan(70 * T);
    expect(ball.level.hoppers.some((h) => !h.alive)).toBe(true);
    expect(runBot(def, 'roller').reached).toBe(true);
    for (const style of ['naive', 'faller'] as const) {
      const r = runBot(def, style);
      expect(r.reached, style).toBe(true);
      expect(r.player.dead, style).toBe(false);
    }
  });
});

describe('crumbleSpan: planking that does not wait', () => {
  // Planks over columns 34-45, the channel floor on row 36.
  const span = (startCol: number) =>
    bench((b) => {
      b.floor(0, 29, 30);
      b.start(startCol, 30);
      const c = crumbleSpan(b, 30, 30, { planks: 4 });
      expect(c).toEqual({ endX: 30 + 4 + 12 + 6, endRow: 30 });
      b.floor(c.endX, 259, 30);
      b.goal(200, 30);
    });

  it('at a run it is a bridge: the channel floor is never touched', () => {
    const r = play(span(4), runner, 400);
    expect(r.p.x).toBeGreaterThan(52 * T);
    expect(r.landings.every((l) => l.row <= 30)).toBe(true);
  });

  it('under the planking is a channel with a floor and a way out: a fall costs time, never the run', () => {
    const level = new Level(span(4));
    expect(level.crumbles).toHaveLength(4);
    // Set down on the channel floor, as if a plank had let go.
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(span(4), style, 2000, { col: 36, row: 36 });
      expect(r.road.get(40), style).toBeCloseTo(36, 0); // walked the channel floor
      expect(r.reached, style).toBe(true); // and the spring at the far wall lifted it out
      expect(r.player.dead, style).toBe(false);
    }
  });
});
