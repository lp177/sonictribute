import type { LevelBuilder } from '../../game/Level.ts';
import type { MonitorKind } from '../../game/entities.ts';
import { PHYS } from '../../physics/constants.ts';
import { canopyRun, type MotifEnd } from '../motifs.ts';
import { groundRow, launchValley, lowRoad, ringArc, type LaunchValleyOpts } from '../sections.ts';

/**
 * UNDERWHEN PIECES — the cavern's own relief, in the conventions of
 * sections.ts: `(b, x, row, opts) -> { endX, endRow }`, fresh columns, every
 * fall lands on ground, nothing bottomless, no boosters, no randomness.
 *
 * The biome is a mine drilled toward its own bottom, so its toys are the
 * things that carry you: a grind rail slung across a chasm (or up a cliff), a
 * minecart that dives with you. Its knots are light that is not always there.
 */

const T = PHYS.tile;
type Prize = 'crystal' | MonitorKind | 'none';

function prize(b: LevelBuilder, kind: Prize, x: number, surfaceRow: number): void {
  if (kind === 'crystal') b.crystal(x, surfaceRow - 2);
  else if (kind !== 'none') b.monitor(x, surfaceRow, kind);
}

function need(ok: boolean, what: string): void {
  if (!ok) throw new Error(`never/pieces: ${what}`);
}

/** A chasm floor over g0..g1: rings at the foot of the near wall, `crabs` patrolling. */
function chasm(b: LevelBuilder, g0: number, g1: number, floor: number, crabs: number): void {
  b.floor(g0, g1, floor);
  b.ringsH(g0 + 1, g0 + 4, floor - 2);
  for (let i = 0; i < crabs; i++) b.enemy(g0 + 8 + i * 7, floor, 2);
}

/**
 * valley — the kit's launchValley with its climb-out repaired. The lower
 * ledge is drawn one tile too long: where it meets a climb-out that rises
 * past it (out >= 8) its last tile replaces a tile of the ramp, and the step
 * that leaves stops a slow walker dead (the faller bot never gets past it).
 * This puts the ramp tile back. Same footprint, same options.
 */
export function valley(b: LevelBuilder, x: number, row: number, opts: LaunchValleyOpts = {}): MotifEnd {
  const { depth = 12, basin = 10 } = opts;
  const end = launchValley(b, x, row, opts);
  if ((opts.out ?? depth - 2) >= 8) b.set(x + depth * 2 + basin + 53, row + depth - 8, '(');
  return end;
}

/**
 * alcove — a pocket in a chasm's NEAR wall, at floor level, under the lip you
 * left from: the reward for dropping in and walking back the way you came.
 * Counts as one of the act's secrets; the caller puts the prize in it.
 */
export function alcove(b: LevelBuilder, x0: number, x1: number, floor: number): void {
  b.carve(x0, floor - 3, x1, floor - 1);
  b.secret(x0, floor - 3, x1, floor - 1);
}

/**
 * loopWalk — the way onto a loopHill's roof, for a loop no other high road
 * reaches. A level catwalk leaves the top of the loop's own run-up, a jump
 * above the road, and stays level while the ground falls away under it, so
 * it arrives over the roof; one more shelf past the loop lets you down.
 * Give it the loopHill's own x, row and drop.
 */
export function loopWalk(b: LevelBuilder, x: number, row: number, drop = 6): void {
  canopyRun(b, x, row - 5, { len: 21 });
  canopyRun(b, x + 17 + drop * 2, row - 5, { len: 8 });
}

/**
 * onRamp — a sprung step: a short shelf a jump above the road with a spring
 * on it. The high road rides eleven rows up, out of reach of any jump, so
 * wherever a stretch of it has no other way on (a valley's ledges, a cave's
 * lift, a clifftop) it starts with one of these.
 */
export function onRamp(b: LevelBuilder, x: number): void {
  const row = groundRow(b, x + 1) - 5;
  b.platform(x, x + 2, row);
  b.spring(x + 1, row, 10);
}

export interface RailDescentOpts {
  /** Columns the chasm spans; rows the road falls across it (3+). Keep span > drop*2 + 6. */
  span?: number;
  drop?: number;
  /** Rows the chasm floor lies below the far bank, and the crabs on it. */
  pit?: number;
  crabs?: number;
  /** What waits at the end of the catwalk over the rail's first half. */
  prize?: Prize;
  /** Flat columns of far bank: the landing strip. */
  runout?: number;
}

/**
 * railDescent — the Underwhen's release: the road ends at a lip and a grind
 * rail carries on, slung down across a chasm to the far bank. RUN off the lip
 * and you land on it (9 px/frame at the least, faster the further it falls);
 * JUMP at the lip and you are on the catwalk above it, which keeps the height
 * the rail spends and ends over the rail's middle; let go of the direction
 * as you step off the lip and you drop straight past the rail's head to the
 * chasm floor: rings, crabs, a gentle climb out. (A rail cannot be left
 * downward — it catches whatever falls on it — so its head hangs four columns
 * out from the lip to leave that way open.)
 * The rail's tip rests on the far bank, so the ride sets you down on ground.
 * FOOTPRINT: 6 + span + runout columns. NET: falls `drop` rows.
 */
export function railDescent(b: LevelBuilder, x: number, row: number, opts: RailDescentOpts = {}): MotifEnd {
  const { span = 36, drop = 10, pit = 5, crabs = 1, prize: reward = 'rings10', runout = 12 } = opts;
  // A rail steeper than the climb-out would dive into it.
  need(span > drop * 2 + 6, `railDescent at column ${x}: a ${drop}-row rail needs more than ${span} columns`);
  const g0 = x + 6;
  const g1 = g0 + span;
  const bank = row + drop;
  b.floor(x, g0 - 1, row);
  b.ringsH(x + 1, x + 4, row - 3);
  // The climb-out tops out a column short of the rail's tip, so the rider is
  // set down on the flat (a landing on the ramp's crest would eat the speed).
  chasm(b, g0, g1 - pit * 2 - 2, bank + pit, crabs);
  b.gentleUp(g1 - pit * 2 - 1, bank + pit - 1, pit);
  b.floor(g1 - 1, g1 + runout - 1, bank);
  b.rail(g0 + 4, row + 2, g1, bank);
  // The grind line, drawn in rings a head above the rail.
  for (let i = 6; i < span - 1; i += 3) b.rings.push({ x: (g0 + i) * T + 8, y: (row + 2 + ((drop - 2) * (i - 4)) / (span - 4)) * T - 24 });
  const mid = g0 + Math.floor(span / 2);
  b.platform(g0 + 2, mid, row - 3);
  b.ringsH(g0 + 3, g0 + 7, row - 5);
  prize(b, reward, mid - 1, row - 3);
  b.ringsH(g1 + 2, g1 + Math.min(runout - 2, 6), bank - 3);
  return { endX: g1 + runout, endRow: bank };
}

export interface RailLiftOpts {
  /** Rows the cliff rises; columns the rail takes to climb it; flat columns on top. */
  rise?: number;
  span?: number;
  top?: number;
}

/**
 * railLift — a rail is a ride whichever way it tilts. This one runs UP, from
 * the road to a clifftop: the road simply walks onto it and is carried there
 * at rail speed. The spring at the foot of the cliff is for whoever jumped
 * off. The Underwhen's way back up (where the kit has springCliff).
 * FOOTPRINT: 4 + span + top columns. NET: rises `rise` rows.
 */
export function railLift(b: LevelBuilder, x: number, row: number, opts: RailLiftOpts = {}): MotifEnd {
  const { rise = 12, span = 20, top = 10 } = opts;
  const cliff = x + 4 + span;
  b.floor(x, cliff - 1, row);
  b.floor(cliff, cliff + top - 1, row - rise);
  b.rail(x + 4, row, cliff + 1, row - rise); // the tip rests a column onto the clifftop
  b.spring(cliff - 2, row, rise >= 12 ? 12 : 11);
  for (let i = 3; i < span; i += 3) b.rings.push({ x: (x + 4 + i) * T + 8, y: (row - (rise * i) / (span + 1)) * T - 24 });
  b.ringsH(cliff + 2, cliff + top - 3, row - rise - 3);
  return { endX: cliff + top, endRow: row - rise };
}

export interface CartDropOpts {
  /** Chasm width in columns. Under about 22 a hop out of a diving cart clears it whole. */
  span?: number;
  /** Rows the far bank lies below the boarding ledge (negative: the track climbs). */
  drop?: number;
  /** Rows the chasm floor lies below the far bank, and the crabs on it. */
  pit?: number;
  crabs?: number;
  /** What waits on the bail ledge past the buffer. */
  prize?: Prize;
  runout?: number;
}

/**
 * cartDrop — a minecart whose track dives: it waits on the brink, and its
 * rail runs down across the chasm to a buffer on the lower far bank. Stay
 * aboard and the crash costs a hit; hop out early and you are on the chasm
 * floor (crabs, springs at the far wall); jump out LATE, a full jump, and
 * the cart's momentum throws you onto the bail ledge past the buffer, where
 * the prize is. The track and its buffer are drawn, so the timing can be read.
 * FOOTPRINT: span + 12 + runout columns. NET: falls `drop` rows.
 */
export function cartDrop(b: LevelBuilder, x: number, row: number, opts: CartDropOpts = {}): MotifEnd {
  const { span = 16, drop = 8, pit = 6, crabs = 1, prize: reward = 'rings10', runout = 12 } = opts;
  const g0 = x + 5;
  const g1 = g0 + span - 1;
  const bank = row + drop;
  const buffer = g1 + 7; // far enough in that the crash's knockback lands on the bank
  b.floor(x, g0 - 1, row);
  chasm(b, g0, g1, bank + pit, crabs);
  b.spring(g1 - 1, bank + pit, pit > 8 ? 11 : 10);
  b.spring(g1, bank + pit, pit > 8 ? 11 : 10);
  b.floor(g1 + 1, buffer + runout, bank);
  b.cartRide(x + 3, row, buffer, bank);
  // The bail ledge: out of reach of a jump from the bank under it, so only the
  // cart's own height gets you there. (A climbing cart never rises above the
  // bank: its ledge is a plain jump up, for whoever left at the last moment.)
  const ledge = bank - (drop > 0 ? 8 : 5);
  b.platform(buffer + 2, buffer + 15, ledge);
  prize(b, reward, buffer + 10, ledge);
  ringArc(b, buffer - 5, bank - (5 * drop) / (buffer - x - 3) - 0.5, 5.5, -6.5, 5, 5);
  b.ringsH(buffer + 3, buffer + Math.min(runout, 8), bank - 3);
  return { endX: buffer + runout + 1, endRow: bank };
}

export interface LightBridgeOpts {
  /** Hard-light spans, four columns each, and their clock. */
  spans?: number;
  period?: number;
  /** Light the spans in sequence — a wave to walk with — instead of alternately. */
  sweep?: boolean;
  /** Rows the chasm floor lies below the bridge, and the crabs on it. */
  pit?: number;
  crabs?: number;
  /** What hangs over the middle of the bridge, a jump above a lit span. */
  prize?: Prize;
}

/**
 * lightBridge — a chasm bridged by hard light. Alternate spans are
 * counter-phased, so the crossing is a rhythm: stand on the lit span, step
 * when its neighbour comes on (with `sweep` the light travels the bridge
 * instead and you walk with it). The light that goes out drops you on the
 * chasm floor — the slow road, with springs at the far wall. A full running
 * jump covers about five spans: from six up, the light is the only way. A knot.
 * FOOTPRINT: 4 + spans*4 + 8 columns. NET: level.
 */
export function lightBridge(b: LevelBuilder, x: number, row: number, opts: LightBridgeOpts = {}): MotifEnd {
  const { spans = 4, period = 180, sweep = false, pit = 6, crabs = 1, prize: reward = 'none' } = opts;
  const g0 = x + 4;
  const g1 = g0 + spans * 4 - 1;
  b.floor(x, g0 - 1, row);
  chasm(b, g0, g1, row + pit, crabs);
  b.spring(g1 - 1, row + pit, pit > 8 ? 11 : 10);
  b.spring(g1, row + pit, pit > 8 ? 11 : 10);
  for (let i = 0; i < spans; i++) {
    const offset = sweep ? period - ((i * Math.floor(period / 4)) % period) : (i % 2) * Math.floor(period / 2);
    b.phasePlatform(g0 + i * 4, g0 + i * 4 + 3, row, period, offset);
  }
  b.ringsH(g0, g1, row - 2);
  // The prize hangs over the middle: a crystal in the air, a monitor on a shelf of its own.
  const mid = g0 + spans * 2;
  if (reward === 'crystal') b.crystal(mid, row - 4);
  else if (reward !== 'none') {
    b.platform(mid - 1, mid + 1, row - 3);
    b.monitor(mid, row - 3, reward);
  }
  b.floor(g1 + 1, g1 + 8, row);
  return { endX: g1 + 9, endRow: row };
}

export interface HollowHallOpts {
  len?: number;
  /** Hard-light panes let into the floor, four columns each, and their clock. */
  panes?: number;
  period?: number;
  /** Stalactites under the hall's roof (0 = an open hall, no roof). */
  spikes?: number;
  /** The lower hall: crabs, clocked traps, what it holds, whether it is a secret. */
  crabs?: number;
  traps?: number;
  prize?: Prize;
  secret?: boolean;
}

/**
 * hollowHall — two halls, one over the other, and a floor between them that
 * is only sometimes there. The upper hall's floor has panes of hard light
 * let into it: cross them lit, or fall through into the lower hall (its own
 * loot, crabs, a spring lift out at the far end). With a roof, stalactites
 * hang over the panes — the roof says hurry, the floor says wait. A knot.
 * FOOTPRINT: len columns, the lower hall's floor 9 rows down. NET: level.
 */
export function hollowHall(b: LevelBuilder, x: number, row: number, opts: HollowHallOpts = {}): MotifEnd {
  const { len = 34, panes = 2, period = 180, spikes = 0, crabs = 1, traps = 0, prize: reward = 'rings10', secret = false } = opts;
  const stride = Math.floor((len - 14) / panes);
  need(stride >= 6, `hollowHall at column ${x}: ${panes} panes do not fit in ${len} columns`);
  b.floor(x, x + len - 1, row);
  b.ringsH(x + 1, x + 3, row - 3);
  // The lower hall is dug before the roof goes on: lowRoad reads the road as
  // the topmost ground in each column.
  lowRoad(b, x + 2, x + len - 3, { shafts: [], crabs, traps, prize: reward, secret });
  for (let i = 0; i < panes; i++) {
    const px = x + 5 + i * stride;
    b.carve(px, row, px + 3, row + 4); // through the floor into the lower hall
    b.phasePlatform(px, px + 3, row, period, (i % 2) * Math.floor(period / 2));
    b.ringsH(px, px + 3, row - 2);
    if (spikes > i) b.stalactite(px + 2, row - 6);
  }
  if (spikes > 0) {
    b.slab(x + 3, x + len - 9, row - 7, 2); // stops short of the lift out, so that flight is free
    for (let i = panes; i < spikes; i++) b.stalactite(x + 3 + stride * (i - panes + 1), row - 6);
    b.ringsH(x + 5, x + len - 12, row - 9);
  }
  return { endX: x + len, endRow: row };
}

export interface HangingRoofOpts {
  /** Rows of air between the road and the roof. */
  clear?: number;
  /** Stalactites, spread evenly along it. */
  spikes?: number;
  /** What sits on top of the roof, at its far end. */
  prize?: Prize;
}

/**
 * hangingRoof — a cave roof over columns x0..x1 that FOLLOWS the road under
 * it, down a slope or over a hill, strung with stalactites. They are armed by
 * whoever passes beneath, so a roof says "keep moving" and nothing more —
 * until the road under it holds something that makes you stop. Its top is a
 * road of its own (a spring's height up; a drop from the high road).
 * Stamp it AFTER the ground chain, like highRoad, and never over a launch.
 */
export function hangingRoof(b: LevelBuilder, x0: number, x1: number, opts: HangingRoofOpts = {}): void {
  const { clear = 5, spikes = 3, prize: reward = 'none' } = opts;
  const top: number[] = [];
  for (let x = x0; x <= x1; x++) {
    const g = groundRow(b, x);
    const r = g - clear - 2;
    need(top.length === 0 || Math.abs(r - top[top.length - 1]) <= 1, `hangingRoof ${x0}..${x1}: the road steps at column ${x}`);
    top.push(r);
    // The roof's top copies the road's own profile, so it is as runnable as the road.
    b.set(x, r, b.grid[g][x]);
    b.set(x, r + 1, '#');
  }
  const step = spikes > 1 ? Math.floor((x1 - x0 - 4) / (spikes - 1)) : 0;
  for (let i = 0; i < spikes; i++) b.stalactite(x0 + 2 + i * step, top[2 + i * step] + 1);
  for (let i = 2; i < top.length - 2; i += 2) b.ringsH(x0 + i, x0 + i, top[i] - 2);
  prize(b, reward, x1 - 2, top[top.length - 3]);
}
