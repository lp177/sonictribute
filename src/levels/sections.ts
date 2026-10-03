import type { LevelBuilder } from '../game/Level.ts';
import type { MonitorKind } from '../game/entities.ts';
import { PHYS } from '../physics/constants.ts';
import type { MotifEnd } from './motifs.ts';

/**
 * RELIEF KIT — the big-form sections that give an act its shape.
 *
 * The motif kit (motifs.ts) stamps gimmicks along a flat road, and an act made
 * only of those is three parallel lanes you cross by holding right: no hills,
 * no reason to roll, loops handed their speed by a dash pad. The classics are
 * built the other way round. Their roads rise and fall like a roller coaster,
 * speed is what a downhill GIVES you, and what you do with it decides which
 * road you are on a moment later: carry it over a ramp and you are thrown to
 * the high ledge, lose it and you are on the low road — slower, never dead.
 * Tight platforming knots are the tension; the long descents between them are
 * the release.
 *
 * These sections build that. Each one lays the MIDDLE road (solid ground with
 * real relief), plus whatever high ledges and low caves belong to its own
 * set piece, and returns where the middle road ended, exactly like a motif:
 *
 *   let c = rollingStart(b, 0, 26);
 *   c = launchValley(b, c.endX, c.endRow, { depth: 12 });
 *   c = hazardGauntlet(b, c.endX, c.endRow);   // a knot from motifs.ts
 *   c = loopHill(b, c.endX, c.endRow);
 *   ...
 *
 * The rhythm is knot, release, knot, release: the flat gimmicks of the motif
 * kit are the knots, and they chain with these sections because both speak
 * the same (x, row) -> { endX, endRow }.
 *
 * CONVENTIONS
 *  - World height 64 rows (WORLD_ROWS). The middle road wanders between rows
 *    MID_MIN and MID_MAX; chain sections so `endRow` stays inside that band
 *    (each section documents its net rise or fall).
 *  - The high road rides HI rows above the middle one, the low road's cave
 *    floor LO rows below it. Neither is continuous: they open and close as
 *    the sections fork and merge, which is the point.
 *  - Speed comes from the ground. No section here uses a dash pad, and the
 *    kickers are plain terrain with no launcher on the lip: what you get out
 *    is what you brought in. Measured (tests/sections.test.ts): a gentle
 *    descent of 12 rows leaves a runner at ~9 px/frame and a ROLLING hero at
 *    ~11.4; a kicker turns 9 / 11.5 / 14 px/frame into 4 / 8 / 12 rows of
 *    height over its lip.
 *  - A missed jump or a slow approach always lands on real ground, and every
 *    cave has a way out that works by holding right. Nothing here is
 *    bottomless.
 *  - Deterministic: no randomness, hazard clocks take explicit parameters.
 */

export const WORLD_ROWS = 64;
/** Rows between the middle road and the high road above it. */
export const HI = 11;
/** Rows between the middle road and the cave floor of the low road. */
export const LO = 9;
/** The band the middle road must stay in for both neighbours to fit. */
export const MID_MIN = 20;
export const MID_MAX = 46;

const T = PHYS.tile;

/* --------------------------------- Helpers -------------------------------- */

/** One solid column whose top tile is `ch`, filled to bedrock. */
function column(b: LevelBuilder, x: number, row: number, ch: string): void {
  b.set(x, row, ch);
  for (let y = row + 1; y < b.h; y++) b.set(x, y, '#');
}

const isAir = (b: LevelBuilder, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < b.w && y < b.h && b.grid[y][x] === '.';

/** Row of the topmost GROUND tile in a column (one-way ledges are not ground). */
export function groundRow(b: LevelBuilder, x: number): number {
  const cx = Math.max(0, Math.min(b.w - 1, x));
  for (let y = 0; y < b.h; y++) {
    const ch = b.grid[y][cx];
    if (ch !== '.' && ch !== '=') return y;
  }
  return b.h;
}

/**
 * Row of the ROAD in a column: the topmost ground with real depth under it.
 * A roof slab over a gallery is ground too, but nobody digs a cave from it —
 * anything thinner than four rows is passed over.
 */
export function roadRow(b: LevelBuilder, x: number): number {
  const cx = Math.max(0, Math.min(b.w - 1, x));
  const solid = (y: number) => y < b.h && b.grid[y][cx] !== '.' && b.grid[y][cx] !== '=';
  for (let y = 0; y < b.h; y++) {
    if (solid(y) && solid(y + 1) && solid(y + 2) && solid(y + 3)) return y;
  }
  return b.h;
}

/** Authoring errors are caught at build time, with the column that caused them. */
function need(ok: boolean, what: string): void {
  if (!ok) throw new Error(`sections: ${what}`);
}

/**
 * A kicker: five columns of ground curling up to a lip 4 rows above
 * `baseRow` — the quarter-pipe profile with NO launcher on it. Leaving the
 * lip is ordinary physics, so the arc is the approach speed: a walk hops off
 * the end, a full roll is thrown ten rows up. A hero set down at its foot
 * with no speed at all still walks up and over it (`CLIMB` in Player.ts) —
 * he just gets no flight for it — so a kicker can stand anywhere in the road.
 */
export function kicker(b: LevelBuilder, x: number, baseRow: number): void {
  column(b, x, baseRow - 1, '{');
  column(b, x + 1, baseRow - 1, ')');
  column(b, x + 2, baseRow - 2, '/');
  column(b, x + 3, baseRow - 3, '/');
  column(b, x + 4, baseRow - 4, '/');
}

/** A carved gallery: `head` rows of air over a floor at `floorRow`. */
export function cave(b: LevelBuilder, x0: number, x1: number, floorRow: number, head = 4): void {
  b.carve(x0, floorRow - head, x1, floorRow - 1);
  b.floor(x0, x1, floorRow);
}

/**
 * Rings along the flight path of a hero leaving tile corner (x, row) at
 * (vx, vy) px/frame: the promise that an arc has a landing. Rings that would
 * fall inside rock are skipped.
 */
export function ringArc(b: LevelBuilder, x: number, row: number, vx: number, vy: number, count: number, every = 6): void {
  let px = x * T;
  let py = row * T - 20;
  let v = vy;
  for (let f = 1; f <= count * every; f++) {
    px += vx;
    v += PHYS.grv;
    py += v;
    if (f % every !== 0) continue;
    if (isAir(b, Math.floor(px / T), Math.floor(py / T))) b.rings.push({ x: px, y: py });
  }
}

/**
 * Spring power that lifts a hero `rows` up a shaft with three rows to spare:
 * enough to clear the rim and come down beside it. (Every cave lift used to
 * be a 13, which threw him fifteen rows over the road and thirty columns on.)
 */
function liftPower(rows: number): number {
  return Math.min(13, Math.ceil(Math.sqrt(2 * PHYS.grv * (rows + 3) * T)));
}

/** Rings hugging a gentle descent — the line a rolling hero follows. */
function ringsDownSlope(b: LevelBuilder, x: number, row: number, pairs: number): void {
  for (let i = 1; i < pairs * 2 - 1; i += 2) {
    b.rings.push({ x: (x + i) * T + 8, y: (row + i / 2) * T - 24 });
  }
}

type Prize = 'crystal' | MonitorKind | 'none';

function prize(b: LevelBuilder, kind: Prize, x: number, surfaceRow: number): void {
  if (kind === 'none') return;
  if (kind === 'crystal') b.crystal(x, surfaceRow - 2);
  else b.monitor(x, surfaceRow, kind);
}

/* --------------------------------- Opening -------------------------------- */

export interface RollingStartOpts {
  /** Rows the first slope descends. */
  drop?: number;
}

/**
 * rollingStart — the act's first breath: a safe apron, then the ground simply
 * tips downhill with a ring line along it. Nothing can hurt here; the only
 * lesson is that slopes give speed. Sets the player start.
 * FOOTPRINT: 14 + drop*2 + 8 columns. NET: falls `drop` rows.
 */
export function rollingStart(b: LevelBuilder, x: number, row: number, opts: RollingStartOpts = {}): MotifEnd {
  const { drop = 4 } = opts;
  b.floor(x, x + 13, row);
  b.start(x + 4, row);
  b.ringsH(x + 8, x + 12, row - 3);
  b.gentleDown(x + 14, row, drop);
  ringsDownSlope(b, x + 14, row, drop);
  const end = x + 14 + drop * 2;
  b.floor(end, end + 7, row + drop);
  b.ringsH(end + 2, end + 6, row + drop - 3);
  return { endX: end + 8, endRow: row + drop };
}

/* ------------------------------ Release pieces ----------------------------- */

export interface LaunchValleyOpts {
  /** Rows the road drops into the valley (8–16). Deeper = faster = higher. */
  depth?: number;
  /** Flat columns between the slope and the kicker (the retry run-up). */
  basin?: number;
  /** Rows the road climbs back out; defaults to depth - 2 (the act sinks 2). */
  out?: number;
  /** What waits on the upper ledge, the one only a rolling approach reaches. */
  prize?: Prize;
  /** Crabs patrolling the valley floor for those who did not fly. */
  crabs?: number;
  /** A spring on the valley floor that lifts walkers back to the lower ledge. */
  retrySpring?: boolean;
}

/**
 * launchValley — the kit's signature release. The road tips into a long
 * descent, bottoms out, and curls into a kicker. What happens next is decided
 * by how you came down:
 *
 *  - WALKED it: you hop off the lip onto the valley floor — crabs, a slower
 *    climb back out. The low road.
 *  - RAN it: thrown onto the lower ledge, a catwalk that skips the floor.
 *  - ROLLED it (down held on the slope): thrown higher still, onto the upper
 *    ledge and its prize.
 *
 * Every arc comes down on ground, the ledges are one-way so you pass up
 * through them, and the ring trail shows the fast line.
 * FOOTPRINT: 4 + depth*2 + basin + 5 + 30 + out*2 + 4 columns (97 at the
 * defaults). NET: falls depth - out rows (2). Needs row + depth <= 58.
 */
export function launchValley(b: LevelBuilder, x: number, row: number, opts: LaunchValleyOpts = {}): MotifEnd {
  const { depth = 12, basin = 10, prize: reward = 'rings10', crabs = 2, retrySpring = true } = opts;
  const out = opts.out ?? depth - 2;
  const R = row + depth;
  need(R <= b.h - 6, `launchValley at column ${x}: row ${row} + depth ${depth} leaves no bedrock`);
  need(R - 15 >= 3, `launchValley at column ${x}: its upper ledge would leave the top of the world`);

  b.floor(x, x + 3, row);
  b.gentleDown(x + 4, row, depth);
  ringsDownSlope(b, x + 4, row, depth);
  const c0 = x + 4 + depth * 2;
  b.floor(c0, c0 + basin - 1, R);
  const k0 = c0 + basin;
  kicker(b, k0, R);
  const lip = k0 + 5; // first column past the lip
  const lipRow = R - 4;

  // The valley floor, for whoever did not fly.
  const FAR = 30;
  b.floor(lip, lip + FAR - 1, R);
  for (let i = 0; i < crabs; i++) b.enemy(lip + 10 + i * 9, R, 3);
  b.ringsH(lip + 2, lip + 5, R - 2);
  if (retrySpring) b.spring(lip + 3, R, 10);
  const climb = lip + FAR;
  b.gentleUp(climb, R - 1, out);
  const end = climb + out * 2;
  b.floor(end, end + 3, R - out);

  // Lower ledge: the height a running launch reaches. It ends where the
  // climb-out has risen to within two rows of it, so the two roads rejoin
  // with a short drop. No closer: a one-way tile on (or one row over) a ramp
  // tile is read by the ground sensors of whoever is walking UP the ramp, and
  // a hero leaving the valley on foot stops dead under it.
  b.platform(lip + 6, lip + 41, lipRow - 4);
  b.ringsH(lip + 20, lip + 28, lipRow - 6);
  // Upper ledge: only a rolling descent gets this high.
  b.platform(lip + 18, lip + 36, lipRow - 7);
  prize(b, reward, lip + 27, lipRow - 7);
  b.ringsH(lip + 22, lip + 25, lipRow - 9);

  // The fast line, traced from the lip.
  ringArc(b, lip, lipRow, 8, -8, 5, 5);
  return { endX: end + 4, endRow: R - out };
}

export interface LoopHillOpts {
  /** Rows of downhill feeding the loop (the loop's only source of speed). */
  drop?: number;
  /** Rows the road climbs after the loop (default drop - 2). */
  up?: number;
  /** What sits on the loop's roof — visible from the road, reached from above. */
  roof?: Prize;
}

/**
 * loopHill — a loop that is part of the hill it stands on. The run-up is a
 * descent, never a dash pad; the roof carries a prize you can see from the
 * road and reach only from the high road (drop onto it), and the exit climbs
 * away so the loop is a beat in a line, not a toy standing in a corridor.
 * FOOTPRINT: 2 + drop*2 + 24 + up*2 + 2 columns (48 at the defaults).
 * NET: falls drop - up rows (2). The corridor (the 24 flat columns) must
 * never be cut by a shaft or cave.
 */
export function loopHill(b: LevelBuilder, x: number, row: number, opts: LoopHillOpts = {}): MotifEnd {
  const { drop = 6, roof = 'rings10' } = opts;
  const up = opts.up ?? drop - 2;
  const L = row + drop;
  need(L - 13 >= 3 && L <= b.h - 4, `loopHill at column ${x}: the loop does not fit (corridor row ${L})`);
  b.floor(x, x + 1, row);
  b.gentleDown(x + 2, row, drop);
  ringsDownSlope(b, x + 2, row, drop);
  const c0 = x + 2 + drop * 2;
  b.floor(c0, c0 + 23, L);
  const cx = c0 + 10;
  b.loop(cx, L);
  // The roof: one row clear of the annulus.
  b.platform(cx - 3, cx + 3, L - 11);
  prize(b, roof, cx, L - 11);
  // And the way onto it, for whoever would rather have the prize than the
  // lap: a ledge out over the run-up, a jump from the top of the slope and a
  // jump short of the roof. Without it the roof is only ever reached from a
  // high road that happens to pass — and where none does, by nobody.
  const sx = c0 - 6;
  let free = true;
  for (let lx = sx; lx <= sx + 4; lx++) for (let y = L - 12; y <= L - 9; y++) if (!isAir(b, lx, y)) free = false;
  if (free && roof !== 'none') {
    b.platform(sx, sx + 4, L - 9);
    b.ringsH(sx + 1, sx + 3, L - 11);
  }
  b.ringsH(c0 + 18, c0 + 22, L - 3);
  const e0 = c0 + 24;
  b.gentleUp(e0, L - 1, up);
  b.floor(e0 + up * 2, e0 + up * 2 + 1, L - up);
  return { endX: e0 + up * 2 + 2, endRow: L - up };
}

export interface PlungeOpts {
  /** Total rows dropped (>= 6). */
  drop?: number;
  /** Flat columns at the bottom. */
  runout?: number;
}

/**
 * plunge — a cliff you run DOWN: a rounded brow, a 45° face, a rounded foot.
 * The fastest way to turn height into speed (a 12-row plunge rolls out at
 * ~11 px/frame) and the visual opposite of a long gentle hill. Chain a
 * kicker, a loop or a long jump straight after it.
 * FOOTPRINT: 2 + (drop-2) + 2 + runout columns. NET: falls `drop` rows.
 */
export function plunge(b: LevelBuilder, x: number, row: number, opts: PlungeOpts = {}): MotifEnd {
  const { drop = 12, runout = 8 } = opts;
  const steep = drop - 2;
  b.gentleDown(x, row, 1);
  b.slopeDown(x + 2, row + 1, steep);
  b.gentleDown(x + 2 + steep, row + 1 + steep, 1);
  const c0 = x + 4 + steep;
  b.floor(c0, c0 + runout - 1, row + drop);
  for (let i = 0; i < steep; i += 2) b.rings.push({ x: (x + 2 + i) * T + 8, y: (row + 1 + i) * T - 20 });
  b.ringsH(c0 + 1, c0 + Math.min(runout - 2, 5), row + drop - 3);
  return { endX: c0 + runout, endRow: row + drop };
}

export interface TubeShotOpts {
  /** Rows the tube descends inside the rock (6–12). */
  drop?: number;
  /** Flat columns of landing strip after the flight. */
  runout?: number;
  /** What sits on top of the bluff the tube runs through. */
  top?: Prize;
}

/**
 * tubeShot — a bluff stands across the road and the road goes THROUGH it: a
 * tunnel mouth at ground level, a downhill run in the dark, and a kicker just
 * outside the far mouth. You are fired out into open sky through a cloud of
 * rings and come down on a long clear runway. The classic act-closer; nothing
 * waits on the landing but ground. The bluff's top is five rows up (a jump
 * clears six, barely) and carries a prize for whoever climbs it instead of
 * taking the tube.
 * FOOTPRINT: 2 + drop*2 + 6 + 5 + runout columns. NET: falls `drop` rows.
 */
export function tubeShot(b: LevelBuilder, x: number, row: number, opts: TubeShotOpts = {}): MotifEnd {
  const { drop = 8, runout = 44, top = 'rings10' } = opts;
  const R = row + drop;
  b.floor(x, x + 1, row);
  const c0 = x + 2 + drop * 2;
  // The bluff first, then the tube carved through it: three rows of headroom
  // over the slope, so the renderer paints it as a tunnel with a back wall.
  const bluff = row - 5;
  b.floor(x + 2, c0 + 3, bluff);
  for (let i = 0; i < drop; i++) b.carve(x + 2 + i * 2, row + i - 3, x + 3 + i * 2, row + i);
  b.carve(c0, R - 3, c0 + 3, R - 1);
  b.gentleDown(x + 2, row, drop);
  b.floor(c0, c0 + 5, R);
  b.carve(c0 + 4, bluff, c0 + 5, R - 1); // open sky over the run-up to the kicker
  ringsDownSlope(b, x + 2, row, drop);
  prize(b, top, x + 6, bluff);
  b.ringsH(x + 9, x + 14, bluff - 3);
  const k0 = c0 + 6;
  kicker(b, k0, R);
  const lip = k0 + 5;
  b.floor(lip, lip + runout - 1, R);
  // The ring cloud: three arcs, one for each speed that can leave the mouth.
  ringArc(b, lip, R - 4, 6, -6, 6, 5);
  ringArc(b, lip, R - 4, 7.5, -7.5, 7, 5);
  ringArc(b, lip, R - 4, 9, -9, 8, 5);
  return { endX: lip + runout, endRow: R };
}

export interface LongJumpOpts {
  /** Width of the gap in columns (10–16). */
  gap?: number;
  /** Rows the far bank sits below the take-off (0–4). */
  fall?: number;
  /** What waits at the bottom of the gap. */
  pit?: 'rings' | 'crab' | 'trap';
}

/**
 * longJump — a low ramp and a wide gap. With speed you sail it on a flat arc
 * (the ring line shows where); without, you drop into the pit — rings and a
 * spring at the far wall, the low road for ten columns. A speed check that
 * costs time, never a life.
 * FOOTPRINT: 8 + 4 + gap + 12 columns. NET: falls `fall` rows.
 */
export function longJump(b: LevelBuilder, x: number, row: number, opts: LongJumpOpts = {}): MotifEnd {
  const { gap = 12, fall = 2, pit = 'rings' } = opts;
  b.floor(x, x + 7, row);
  b.ringsH(x + 2, x + 6, row - 3);
  b.gentleUp(x + 8, row - 1, 2);
  const g0 = x + 12;
  const g1 = g0 + gap - 1;
  const pitRow = row + 6;
  b.carve(g0, row - 12, g1, pitRow - 1);
  b.floor(g0, g1, pitRow);
  if (pit === 'crab') b.enemy(g0 + Math.floor(gap / 2), pitRow, 2);
  if (pit === 'trap') b.spikeTrap(g0 + Math.floor(gap / 2), pitRow, 150, 30);
  b.ringsH(g0 + 1, g0 + 4, pitRow - 2);
  b.spring(g1 - 1, pitRow, 12);
  b.spring(g1, pitRow, 12);
  const far = row + fall;
  b.floor(g1 + 1, g1 + 12, far);
  ringArc(b, g0, row - 2, 7.5, -3.6, 5, 5);
  return { endX: g1 + 13, endRow: far };
}

/* ------------------------------- Forks & hills ------------------------------ */

export interface UndercroftOpts {
  /** Rows the hill rises above the road (6–10). */
  rise?: number;
  /** Flat columns across the crown. */
  crown?: number;
  /** Rows the far side descends (default rise + 2: the hill ends lower than it began). */
  down?: number;
  /** What the cave under the hill holds. */
  prize?: Prize;
  /** Cave hazards: 0 none, 1 crab, 2 crab + clocked spikes. */
  hazards?: 0 | 1 | 2;
  /** Mark the cave's back room as one of the act's secrets. */
  secret?: boolean;
}

/**
 * undercroft — a hill with a road under it. The middle road climbs the hill
 * and comes off the far side as a long descent (speed for whatever follows).
 * At the foot, a visible shaft in the ground drops into the cave beneath: the
 * low road, with its own prize, a knot of hazards and a spring lift back out
 * past the hill. Run over the shaft and you never see it; drop in and you
 * trade the downhill for the loot.
 * FOOTPRINT: 6 + rise*2 + crown + down*2 + 10 columns (64 at the defaults).
 * NET: falls down - rise rows (2). Needs row + LO + 1 < b.h.
 */
export function undercroft(b: LevelBuilder, x: number, row: number, opts: UndercroftOpts = {}): MotifEnd {
  const { rise = 8, crown = 12, prize: reward = 'shield', hazards = 1, secret = false } = opts;
  const down = opts.down ?? rise + 2;
  b.floor(x, x + 5, row);
  b.gentleUp(x + 6, row - 1, rise);
  const c0 = x + 6 + rise * 2;
  const top = row - rise;
  b.floor(c0, c0 + crown - 1, top);
  b.ringsH(c0 + 2, c0 + crown - 3, top - 3);
  b.enemy(c0 + Math.floor(crown / 2), top, 3);
  const d0 = c0 + crown;
  b.gentleDown(d0, top, down);
  ringsDownSlope(b, d0, top, down);
  const end = d0 + down * 2;
  const endRow = top + down;
  b.floor(end, end + 9, endRow);

  // The cave: under the whole hill, floor LO rows below the entry road.
  const floor = row + LO;
  const cx1 = end + 5;
  cave(b, x + 1, cx1, floor);
  b.carve(x + 2, row, x + 4, floor - 1); // the way in, on the flat before the hill
  b.ringsH(x + 8, x + 16, floor - 2);
  if (hazards >= 1) b.enemy(c0 + 2, floor, 4);
  if (hazards >= 2) b.spikeTrap(c0 + crown, floor, 150, 50);
  prize(b, reward, d0 + 4, floor);
  b.ringBox(d0 + 8, floor - 2, 3, 1);
  if (secret) b.secret(d0, floor - 4, d0 + 12, floor - 1);
  // The way out: a shaft past the foot of the hill, springs under it.
  b.carve(cx1 - 2, endRow, cx1, floor - 1);
  b.spring(cx1 - 1, floor, liftPower(floor - endRow));
  b.spring(cx1, floor, liftPower(floor - endRow));
  return { endX: end + 10, endRow };
}

export interface SpringCliffOpts {
  /** Rows the cliff rises (6–14). */
  rise?: number;
  /** Flat columns on top. */
  top?: number;
}

/**
 * springCliff — a wall, and a spring at its foot: the classic way back UP.
 * The ring column over the spring shows the flight; steer right at the top.
 * Use it to win back the height the release pieces spend.
 * FOOTPRINT: 8 + top columns. NET: rises `rise` rows.
 */
export function springCliff(b: LevelBuilder, x: number, row: number, opts: SpringCliffOpts = {}): MotifEnd {
  const { rise = 10, top = 10 } = opts;
  b.floor(x, x + 7, row);
  b.spring(x + 5, row, rise >= 12 ? 12 : rise >= 9 ? 11 : 10);
  b.spring(x + 6, row, rise >= 12 ? 12 : rise >= 9 ? 11 : 10);
  for (let r = 3; r <= rise + 1; r += 2) b.rings.push({ x: (x + 6) * T, y: (row - r) * T });
  b.floor(x + 8, x + 8 + top - 1, row - rise);
  b.ringsH(x + 10, x + 8 + top - 3, row - rise - 3);
  return { endX: x + 8 + top, endRow: row - rise };
}

export interface StairClimbOpts {
  /** Number of terraces. */
  steps?: number;
  /** Rows each terrace rises (3–5: a standing jump clears 6). */
  rise?: number;
  /** Columns per terrace. */
  tread?: number;
  /** A crab on the middle terrace. */
  guard?: boolean;
}

/**
 * stairClimb — terraces to jump up, each one a jump high: the slow, aimed
 * way to gain height (a knot, where springCliff is a release).
 * FOOTPRINT: 4 + steps*tread columns. NET: rises steps*rise rows.
 */
export function stairClimb(b: LevelBuilder, x: number, row: number, opts: StairClimbOpts = {}): MotifEnd {
  const { steps = 3, rise = 4, tread = 7, guard = true } = opts;
  b.floor(x, x + 3, row);
  let cur = row;
  let cx = x + 4;
  for (let s = 0; s < steps; s++) {
    cur -= rise;
    b.floor(cx, cx + tread - 1, cur);
    b.ringsH(cx + 1, cx + 3, cur - 3);
    if (guard && s === Math.floor(steps / 2)) b.enemy(cx + tread - 3, cur, 2);
    cx += tread;
  }
  return { endX: cx, endRow: cur };
}

/* ------------------------------ The high road ------------------------------ */

export interface HighRoadOpts {
  /** Ledge length / gap between ledges, in columns. */
  span?: number;
  gap?: number;
  /** Rows the ledges ride above the ground beneath them. */
  lift?: number;
  /** Every n-th ledge is a crumbling one (0 = none). */
  crumbleEvery?: number;
  /** A drone guarding every n-th gap (0 = none). */
  droneEvery?: number;
  /** Hang a crystal over the middle ledge. */
  crystal?: boolean;
  /** Monitors, one per ledge from the second ledge on, every other ledge. */
  monitors?: MonitorKind[];
  /** Stepping ledges from the ground up to the first ledge when nothing else stands within a jump of it (default true). */
  onRamp?: boolean;
}

/**
 * highRoad — a stretch of the high road over columns x0..x1: one-way ledges
 * with jumpable gaps and ring lines, FOLLOWING the ground beneath them. Each
 * ledge rides `lift` rows over the highest ground under it, never more than
 * four rows off its neighbour (a jump); where the ground climbs faster than
 * that, the ledge before carries a spring. Crumbling ledges and drones knock
 * the careless back down to the middle road.
 *
 * Stamp it AFTER the ground chain. Ledges that would overlap something
 * already there (a valley's own ledges, a loop's roof) are skipped, so it is
 * safe to lay across a whole act and let the sections' set pieces show
 * through.
 *
 * A stretch nobody can get onto is scenery: a jump clears six rows and the
 * road rides eleven up. So unless something already stands within a jump of
 * its first ledge, the stretch gets its own way in: a couple of stepping
 * ledges up from the ground (`onRamp`, on by default; `tests/reach.ts` is
 * what checks that every ledge in an act can actually be stood on).
 */
export function highRoad(b: LevelBuilder, x0: number, x1: number, opts: HighRoadOpts = {}): void {
  const { span = 9, gap = 4, lift = HI, crumbleEvery = 0, droneEvery = 0, crystal = false, monitors = [], onRamp = true } = opts;
  const ledges: { x0: number; x1: number; row: number }[] = [];
  let entered = !onRamp;
  let prev: { x1: number; row: number } | null = null;
  let i = 0;
  for (let cx = x0; cx + 3 <= x1; cx += span + gap, i++) {
    const e = Math.min(x1, cx + span - 1);
    let top = b.h;
    for (let x = cx - 1; x <= e + 1; x++) top = Math.min(top, groundRow(b, x));
    let row = Math.max(4, top - lift);
    if (prev && row > prev.row + 4) row = prev.row + 4; // step down a jump at a time
    // Clear air only: four rows for the ledge and whoever stands on it —
    // and nothing already placed there. A ledge laid through a loop's roof
    // prize would bury the monitor in it.
    let clear = true;
    for (let x = cx; x <= e && clear; x++) for (let y = row - 3; y <= row; y++) if (!isAir(b, x, y)) clear = false;
    const inBox = (o: { x: number; y: number }) => o.x >= cx * T && o.x <= (e + 1) * T && o.y >= (row - 3) * T && o.y <= (row + 1) * T;
    if (b.monitors.some(inBox) || b.crystals.some(inBox) || b.springs.some(inBox)) clear = false;
    if (!clear) {
      prev = null;
      continue;
    }
    if (!entered) {
      stepsUp(b, cx, row);
      entered = true;
    }
    if (prev && row < prev.row - 5) b.spring(prev.x1, prev.row, prev.row - row >= 9 ? 12 : 11);
    const crumbling = crumbleEvery > 0 && i % crumbleEvery === crumbleEvery - 1;
    if (crumbling) b.crumble(cx, e, row);
    else b.platform(cx, e, row);
    // A ring that hung exactly where the ledge now is gives way to it.
    b.rings = b.rings.filter((r) => Math.floor(r.y / T) !== row || r.x < cx * T || r.x >= (e + 1) * T);
    if (i % 2 === 0) for (let x = cx + 1; x < e; x++) if (isAir(b, x, row - 2)) b.ringsH(x, x, row - 2);
    if (droneEvery > 0 && i % droneEvery === droneEvery - 1 && isAir(b, e + Math.ceil(gap / 2), row - 3)) {
      b.drone(e + Math.ceil(gap / 2), row - 3, 2);
    }
    if (!crumbling) ledges.push({ x0: cx, x1: e, row });
    prev = { x1: e, row };
  }
  monitors.forEach((kind, k) => {
    const l = ledges[1 + k * 2];
    if (l) b.monitor(l.x1 - 1, l.row, kind);
  });
  const mid = ledges[Math.floor(ledges.length / 2)];
  if (crystal && mid) b.crystal(Math.floor((mid.x0 + mid.x1) / 2), mid.row - 3);
}

/** A jump clears six rows; a step asks for four. */
const STEP = 4;

/** True when some surface stands within a jump below (x, row), a few columns either side. */
function reachable(b: LevelBuilder, x: number, row: number): boolean {
  for (let cx = x - 7; cx <= x + 2; cx++) {
    for (let y = row + 1; y <= row + 5; y++) {
      if (cx >= 0 && cx < b.w && y < b.h && b.grid[y][cx] !== '.' && isAir(b, cx, y - 1)) return true;
    }
  }
  return false;
}

/** Stepping ledges from the ground up to a ledge starting at (x, row). */
function stepsUp(b: LevelBuilder, x: number, row: number): void {
  let sx = x - 4;
  let sy = row + STEP;
  for (let i = 0; i < 3 && sx >= 1 && !reachable(b, sx + 3, sy - STEP); i++) {
    let clear = true;
    for (let cx = sx; cx <= sx + 2; cx++) for (let y = sy - 3; y <= sy; y++) if (!isAir(b, cx, y)) clear = false;
    // Never inside a loop: its channel is on the other collision layer, and
    // a ledge there would trap the rider.
    const inLoop = b.loops.some((l) => (sx + 3) * T > l.cx - l.outerR - T && sx * T < l.cx + l.outerR + T && (sy + 1) * T > l.cy - l.outerR - T && (sy - 3) * T < l.cy + l.outerR + T);
    if (!clear || inLoop) return;
    b.platform(sx, sx + 2, sy);
    // A ring that was hanging exactly there gives way to the step.
    const x0 = sx;
    b.rings = b.rings.filter((r) => Math.floor(r.y / T) !== sy || Math.floor(r.x / T) < x0 || Math.floor(r.x / T) > x0 + 2);
    sx -= 4;
    sy += STEP;
  }
}

export interface DroneBridgeOpts {
  /** Number of drones (each one a bounce). */
  drones?: number;
  /** Rows the bridge rides above the ground under its near ledge. */
  lift?: number;
  /** What waits on the far ledge. */
  prize?: Prize;
  /** Stepping ledges from the ground up to the near ledge when nothing else reaches it (default true). */
  onRamp?: boolean;
}

/**
 * droneBridge — badniks as stepping stones. A row of hovering drones crosses
 * a gap in the high road; land on each in turn (HOLD jump to keep the bounce)
 * and you reach the far ledge and its prize. Miss, and you are on the middle
 * road again. Like highRoad it rides over the ground beneath its near ledge;
 * `endRow` is the row it settled on.
 * FOOTPRINT: 6 + drones*5 + 9 columns.
 */
export function droneBridge(b: LevelBuilder, x: number, opts: DroneBridgeOpts = {}): MotifEnd {
  const { drones = 3, lift = HI, prize: reward = 'rings10', onRamp = true } = opts;
  const far = x + 7 + drones * 5;
  let top = b.h;
  for (let cx = x; cx <= far + 7; cx++) top = Math.min(top, groundRow(b, cx));
  const row = Math.max(5, top - lift);
  if (onRamp) stepsUp(b, x, row);
  b.platform(x, x + 5, row);
  b.ringsH(x + 1, x + 4, row - 2);
  for (let i = 0; i < drones; i++) b.drone(x + 9 + i * 5, row - 1, 1);
  b.platform(far, far + 7, row);
  prize(b, reward, far + 5, row);
  return { endX: far + 8, endRow: row };
}

/* -------------------------------- Low road --------------------------------- */

export interface LowRoadOpts {
  /** Rows the cave floor lies below the road above. */
  depth?: number;
  /** Columns (absolute) of 3-wide shafts dropping in from the road above. */
  shafts?: number[];
  /** Crabs patrolling the gallery. */
  crabs?: number;
  /** Clocked spike traps. */
  traps?: number;
  /** A grind rail along the middle third. */
  rail?: boolean;
  prize?: Prize;
  /** Mark the far end as a secret room. */
  secret?: boolean;
}

/**
 * lowRoad — a stretch of the low road under a FLAT span of the act (a knot,
 * a runway): a cave gallery entered by shafts from above and left by the
 * spring lift at its far end. Stamp it AFTER the ground chain. The road over
 * columns x0..x1 must be level (it throws otherwise, naming the column), and
 * must not be a loop corridor.
 * FOOTPRINT: columns x0..x1, `depth` rows under the road above.
 */
export function lowRoad(b: LevelBuilder, x0: number, x1: number, opts: LowRoadOpts = {}): void {
  const { depth = LO, shafts = [x0 + 3], crabs = 1, traps = 0, rail = false, prize: reward = 'none', secret = false } = opts;
  // The road, not whatever hangs over it: under a roofed knot the topmost
  // tile is the roof, and a cave dug from there would take the road with it.
  const roofRow = roadRow(b, x0);
  const floor = roofRow + depth;
  for (let x = x0; x <= x1; x++) {
    need(roadRow(b, x) === roofRow, `lowRoad ${x0}..${x1} needs level ground above it; column ${x} is at row ${roadRow(b, x)}, not ${roofRow}`);
  }
  need(floor < b.h - 2, `lowRoad floor row ${floor} is below the world`);
  cave(b, x0, x1, floor);
  for (const sx of shafts) b.carve(sx, roofRow, sx + 2, floor - 1);
  const len = x1 - x0;
  b.ringsH(x0 + 6, x0 + Math.min(len - 8, 14), floor - 2);
  for (let i = 0; i < crabs; i++) b.enemy(x0 + Math.floor(((i + 1) * len) / (crabs + 1)), floor, 3);
  for (let i = 0; i < traps; i++) b.spikeTrap(x0 + Math.floor(((i + 0.5) * len) / Math.max(1, traps)) + 3, floor, 150, 40 * i);
  if (rail && len >= 30) b.rail(x0 + Math.floor(len * 0.35), floor - 3, x0 + Math.floor(len * 0.65), floor - 2);
  prize(b, reward, x1 - 7, floor);
  if (secret) b.secret(x1 - 10, floor - 4, x1 - 3, floor - 1);
  // The lift out: a shaft over the last columns, springs beneath it.
  b.carve(x1 - 2, roofRow, x1, floor - 1);
  b.spring(x1 - 1, floor, liftPower(depth));
  b.spring(x1, floor, liftPower(depth));
}
