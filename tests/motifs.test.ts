import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, WORLD_W, type LevelDef } from '../src/game/Level.ts';
import { PHYS } from '../src/physics/constants.ts';
import { checkAct } from './actContract.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  leapOfFaith,
  railCascade,
  cartCanyon,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  boardSprint,
  sneakUnder,
  secretPocket,
  hazardGauntlet,
  arenaApproach,
  signpostFinish,
  canopyRun,
  type MotifEnd,
} from '../src/levels/motifs.ts';

const T = PHYS.tile;
const ROW = 24; // the standard ground-lane entry row
const BENCH_W = 200;
const STAMP_X = 10;

/* ----------------------- The per-motif flow contract ----------------------- */

interface MotifSpec {
  name: string;
  stamp: (b: LevelBuilder, x: number, row: number) => MotifEnd;
  /**
   * Column offsets (relative to the stamp x, inclusive) where the motif
   * DOCUMENTS a gap or a deliberate drop. Everywhere else the running lane
   * must exist and never step more than 8px between adjacent columns.
   */
  allow?: [number, number][];
  /** Row the motif is stamped at (defaults to the ground lane's ROW). */
  row?: number;
  /** Sky overlays get no ground junction checks — they never touch the lane. */
  overlay?: boolean;
}

const specs: MotifSpec[] = [
  { name: 'runway (flat)', stamp: (b, x, r) => runway(b, x, r) },
  { name: 'runway (rise)', stamp: (b, x, r) => runway(b, x, r, { rise: 3, len: 8 }) },
  { name: 'runway (drop)', stamp: (b, x, r) => runway(b, x, r, { drop: 3, len: 8 }) },
  { name: 'rollersRun', stamp: (b, x, r) => rollersRun(b, x, r) },
  { name: 'corridorLoop', stamp: (b, x, r) => corridorLoop(b, x, r) },
  { name: 'stackedChoice', stamp: (b, x, r) => stackedChoice(b, x, r) },
  // The quarter-pipe curve and the blind lip are the documented exception.
  { name: 'leapOfFaith', stamp: (b, x, r) => leapOfFaith(b, x, r), allow: [[3, 8]] },
  // Each step's lip column is a documented drop of dropEach rows onto the
  // safety floor that runs under the rail.
  {
    name: 'railCascade',
    stamp: (b, x, r) => railCascade(b, x, r),
    allow: [
      [6, 6],
      [20, 20],
    ],
  },
  { name: 'cartCanyon', stamp: (b, x, r) => cartCanyon(b, x, r), allow: [[5, 11]] },
  { name: 'stalactiteGallery', stamp: (b, x, r) => stalactiteGallery(b, x, r) },
  { name: 'phaseCrossing', stamp: (b, x, r) => phaseCrossing(b, x, r), allow: [[4, 11]] },
  // The whole bowl is the documented exception: sunken basin, 45° walls.
  { name: 'quarterPipeBowl', stamp: (b, x, r) => quarterPipeBowl(b, x, r), allow: [[0, 13]] },
  {
    name: 'boardSprint',
    stamp: (b, x, r) => boardSprint(b, x, r),
    allow: [
      [7, 13],
      [21, 27],
    ],
  },
  { name: 'sneakUnder', stamp: (b, x, r) => sneakUnder(b, x, r), allow: [[4, 5]] },
  { name: 'secretPocket', stamp: (b, x, r) => secretPocket(b, x, r), allow: [[2, 3]] },
  { name: 'hazardGauntlet', stamp: (b, x, r) => hazardGauntlet(b, x, r) },
  { name: 'arenaApproach', stamp: (b, x, r) => arenaApproach(b, x, r) },
  { name: 'signpostFinish', stamp: (b, x, r) => signpostFinish(b, x, r) },
  {
    name: 'canopyRun',
    stamp: (b, x, r) => canopyRun(b, x, r, { len: 52 }),
    row: 10,
    overlay: true,
    allow: [
      [8, 12],
      [21, 25],
      [34, 38],
      [47, 51],
    ],
  },
];

/**
 * Stamps one motif over a pre-laid base floor (the harsh case: the motif must
 * carve everything it needs) and returns the level plus where the motif said
 * it ended.
 */
function bench(spec: MotifSpec): { level: Level; end: MotifEnd } {
  let end: MotifEnd = { endX: 0, endRow: 0 };
  const def: LevelDef = {
    name: `bench:${spec.name}`,
    act: 'bench',
    title: `Bench ${spec.name}`,
    biome: 2,
    theme: 'crystal',
    width: BENCH_W,
    height: 40,
    build(b) {
      b.floor(0, BENCH_W - 1, ROW); // the base floor every motif must survive
      b.start(2, ROW);
      end = spec.stamp(b, STAMP_X, spec.row ?? ROW);
      if (!spec.overlay) {
        // Chain flat ground at the exit, exactly as an act author would.
        if (end.endRow !== ROW) b.carve(end.endX, ROW, end.endX + 9, end.endRow - 1);
        b.floor(end.endX, end.endX + 9, end.endRow);
      }
      b.goal(BENCH_W - 6, ROW);
    },
  };
  return { level: new Level(def), end };
}

/** Topmost surface y (px) in the column, scanning down from `scanRow`. */
function surfaceY(level: Level, tx: number, scanRow: number): number | null {
  for (let ty = Math.max(0, scanRow); ty < level.map.h; ty++) {
    const tile = level.map.get(tx, ty, 0);
    const m = Math.max(...tile.heights);
    if (m > 0) return (ty + 1) * T - m;
  }
  return null;
}

const inAllowed = (spec: MotifSpec, off: number): boolean =>
  (spec.allow ?? []).some(([a, b]) => off >= a && off <= b);

describe('Section motif kit — running-lane flow contract', () => {
  it.each(specs)('$name: no step over 8px per column outside its documented gaps', (spec) => {
    const { level, end } = bench(spec);
    expect(end.endX, `${spec.name} did not advance`).toBeGreaterThan(STAMP_X);

    const row = spec.row ?? ROW;
    const scanRow = row - 5; // just above the lane, below any platform lane
    // Overlays are checked on their own lane only; ground motifs also prove
    // both junctions (entry and exit) are flush with the chained ground.
    const from = spec.overlay ? STAMP_X : STAMP_X - 1;
    const to = spec.overlay ? end.endX - 1 : end.endX;
    let prev = surfaceY(level, from, scanRow);
    for (let tx = from + 1; tx <= to; tx++) {
      const cur = surfaceY(level, tx, scanRow);
      const exempt = inAllowed(spec, tx - 1 - STAMP_X) || inAllowed(spec, tx - STAMP_X);
      if (!exempt) {
        expect(cur, `${spec.name}: lane missing at column ${tx} (offset ${tx - STAMP_X})`).not.toBeNull();
        expect(prev, `${spec.name}: lane missing at column ${tx - 1}`).not.toBeNull();
        const step = Math.abs((cur as number) - (prev as number));
        expect(
          step,
          `${spec.name}: ${step}px step at column ${tx} (offset ${tx - STAMP_X})`,
        ).toBeLessThanOrEqual(8);
      }
      prev = cur;
    }
  });

  it('every motif reports an exit flush with the ground it actually laid', () => {
    for (const spec of specs) {
      if (spec.overlay) continue;
      const { level, end } = bench(spec);
      // The column just inside the exit must top out exactly at endRow.
      expect(
        surfaceY(level, end.endX - 1, end.endRow - 5),
        `${spec.name}: last column does not surface at endRow`,
      ).toBe(end.endRow * T);
    }
  });
});

/* -------------------- A whole act chained from the kit --------------------- */

/**
 * The proof the kit composes: a full campaign-shaped act — three lanes, five
 * crystals, three secrets, a boss — written ONLY as a left-to-right chain of
 * motifs plus the sky overlay, passing the entire act contract.
 */
const sampler: LevelDef = {
  name: 'MOTIF SAMPLER',
  act: 'ACT S',
  title: 'Shardfall Proving Grounds',
  biome: 2,
  theme: 'crystal',
  bossKind: 'shard',
  build(b) {
    // Ground chain, left to right. Clocked hazards (phase, traps) sit far
    // past AMBIENT_RANGE of the start, so an idle hero hears nothing.
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: the start apron
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 10–39
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 40–61, crystal 1 (sky)
    c = corridorLoop(b, c.endX, c.endRow); // 62–89
    c = runway(b, c.endX, c.endRow, { len: 8, rise: 3, checkpoint: true }); // 90–103, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 104–134, down to row 27
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true, enemy: true }); // 135–146
    c = cartCanyon(b, c.endX, c.endRow); // 147–166
    c = stalactiteGallery(b, c.endX, c.endRow); // 167–180
    c = phaseCrossing(b, c.endX, c.endRow); // 181–198
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 199–210, crystal 2 (under), secret 1
    c = quarterPipeBowl(b, c.endX, c.endRow); // 211–224
    c = secretPocket(b, c.endX, c.endRow); // 225–234, crystal 3, secret 2
    c = secretPocket(b, c.endX, c.endRow); // 235–244, crystal 4, secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14 }); // 245–258
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 17 }); // 259–283, the blind drop to row 27
    const fin = arenaApproach(b, c.endX, c.endRow); // 284–319: boss + goal
    if (fin.endX !== WORLD_W) throw new Error(`sampler chain ends at ${fin.endX}, not ${WORLD_W}`);

    // Sky overlay, stamped after the ground chain per the build-order rule.
    const s = canopyRun(b, 44, 10, { len: 100, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 96 });
  },
};

describe('A full act chained from motifs', () => {
  it('passes the whole act contract (structure, routes, flow, idle silence)', () => {
    checkAct(sampler);
  });
});
