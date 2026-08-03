import type { LevelBuilder } from '../game/Level.ts';
import { tileCentre } from '../game/entities.ts';

/**
 * SECTION MOTIF KIT — the parameterised building blocks the campaign's ~40
 * acts are composed from. Each motif stamps a self-contained stretch of level
 * and returns where it ended, so an act is written as a left-to-right chain:
 *
 *   let c = { endX: 10, endRow: 24 };
 *   c = rollersRun(b, c.endX, c.endRow);
 *   c = corridorLoop(b, c.endX, c.endRow);
 *   ...
 *   arenaApproach(b, c.endX, c.endRow);
 *
 * CONVENTIONS (every motif obeys these):
 *  - `x` is the first (leftmost) column the motif writes; `row` is the surface
 *    row of the running lane at entry. The motif returns `endX` (the first
 *    FREE column — the next motif starts exactly there) and `endRow` (the
 *    surface row it left, always flush with its own last column of ground).
 *  - A motif lays ALL of its own ground (filling to bedrock) and CARVES any
 *    pit or room it needs, so it can be stamped over a flat base floor at the
 *    entry row and still come out right. That is what lets a test bench and
 *    an act author treat motifs as opaque stamps.
 *  - Terrain flow rules are baked in: height changes on the running lane use
 *    gentle ramps only, every pit has a spring escape, a launcher is never
 *    followed by a cliff a slow player can fall off, and clocked hazards are
 *    always telegraphed. 45° faces appear only inside quarter-pipes, where
 *    they curve away from the runner instead of standing in their way.
 *  - LANES (standard 40-row world): sky = rows 2–16, ground = 17–27, under =
 *    28–36. Ground motifs keep their running lane inside the ground band —
 *    callers should chain them with `row` between 21 and 24 so descents
 *    (rail cascades, leaps) bottom out at 27 at the deepest. `canopyRun` is
 *    the sky-lane overlay; stamp it AFTER the ground chain, at a row ≤ 16.
 *  - Deterministic by construction: no randomness anywhere, all hazard
 *    clocks take explicit period/offset parameters.
 *
 * Each motif's doc comment states its FOOTPRINT (columns used), its LANE and
 * its documented exceptions to the "no step > 8px per column" rule (gaps and
 * deliberate drops); tests/motifs.test.ts enforces exactly that contract.
 */

export interface MotifEnd {
  /** First free column after the motif — chain the next motif exactly here. */
  endX: number;
  /** Surface row of the running lane at the exit. */
  endRow: number;
}

/* ------------------------------- Connectors ------------------------------- */

export interface RunwayOpts {
  /** Flat columns after the optional ramp. */
  len?: number;
  /** Rows to climb (gentle ramp) before the flat. Mutually exclusive with drop. */
  rise?: number;
  /** Rows to descend (gentle ramp) before the flat. */
  drop?: number;
  rings?: boolean;
  checkpoint?: boolean;
  enemy?: boolean;
  dashPad?: boolean;
}

/**
 * runway — the glue: an optional gentle ramp, then a flat stretch that can
 * carry a checkpoint, a ring line, a patrolling crab or a dash pad.
 * FOOTPRINT: (rise|drop)*2 + len columns. LANE: ground. Exceptions: none —
 * the ramp is gentle in both directions.
 */
export function runway(b: LevelBuilder, x: number, row: number, opts: RunwayOpts = {}): MotifEnd {
  const { len = 10, rise = 0, drop = 0, rings = true, checkpoint = false, enemy = false, dashPad = false } = opts;
  let cx = x;
  let cur = row;
  if (rise > 0) {
    b.gentleUp(cx, cur - 1, rise);
    cx += rise * 2;
    cur -= rise;
  } else if (drop > 0) {
    // Carve the whole lowered band (ramp AND flat) first, so the descent
    // still reads over a pre-laid base floor at the entry row.
    b.carve(cx, cur, cx + drop * 2 + len - 1, cur + drop - 1);
    b.gentleDown(cx, cur, drop);
    cx += drop * 2;
    cur += drop;
  }
  b.floor(cx, cx + len - 1, cur);
  if (checkpoint) b.checkpoint(cx + 2, cur);
  if (dashPad) b.dashPad(cx + 3, cur, 1, 11);
  if (rings) b.ringsH(cx + 2, cx + Math.min(len - 2, 7), cur - 3);
  // Patrol range stays on the flat: a crab walks a fixed height and would
  // wander into a ramp face (or thin air) if the range spilled off the ends.
  if (enemy) b.enemy(cx + Math.floor(len / 2), cur, Math.max(1, Math.min(3, Math.floor((len - 2) / 2))));
  return { endX: cx + len, endRow: cur };
}

/* ------------------------------ Rhythm motifs ------------------------------ */

export interface RollersOpts {
  cycles?: number;
  rise?: number;
  crown?: number;
  depth?: number;
  basin?: number;
}

/**
 * rollersRun — the hills-and-dips rhythm section: gentle hill, breather, dip,
 * repeat. Pure momentum play; rolling in carries you through for free.
 * FOOTPRINT: cycles * (4 + rise*4 + crown + depth*4 + basin) + 2 columns.
 * LANE: ground. Exceptions: none (everything gentle).
 */
export function rollersRun(b: LevelBuilder, x: number, row: number, opts: RollersOpts = {}): MotifEnd {
  const { cycles = 2, rise = 2, crown = 4, depth = 2, basin = 4 } = opts;
  let cx = x;
  for (let c = 0; c < cycles; c++) {
    b.floor(cx, cx + 1, row);
    cx += 2;
    const crownRow = b.hill(cx, row, rise, crown);
    b.ringsH(cx + rise * 2, cx + rise * 2 + crown - 1, crownRow - 3);
    cx += rise * 4 + crown;
    b.floor(cx, cx + 1, row);
    cx += 2;
    // The dip carves its own bowl so it still exists over a base floor.
    b.carve(cx, row, cx + depth * 4 + basin - 1, row + depth - 1);
    const bottom = b.dip(cx, row, depth, basin);
    b.ringsH(cx + depth * 2, cx + depth * 2 + basin - 1, bottom - 2);
    cx += depth * 4 + basin;
  }
  b.floor(cx, cx + 1, row);
  return { endX: cx + 2, endRow: row };
}

export interface CorridorLoopOpts {
  /** Rows the corridor sits below the entry (gentle descent in, ascent out). */
  drop?: number;
  /** Flat corridor length; must leave >= 6 tiles clear either side of the loop. */
  corridor?: number;
}

/**
 * corridorLoop — gentle descent into a lower corridor, a dash pad feeding a
 * full 360° loop, a ring line and a crab beyond it, then a gentle ascent out.
 * FOOTPRINT: drop*2 + corridor + drop*2 columns (28 by default). LANE:
 * ground. Exceptions: none. NOTE: never cut a drop shaft through the
 * corridor — it is a loop's run-up (see AGENTS.md).
 */
export function corridorLoop(b: LevelBuilder, x: number, row: number, opts: CorridorLoopOpts = {}): MotifEnd {
  const { drop = 2, corridor = 20 } = opts;
  const low = row + drop;
  // Clear the descent band over any base floor, then rebuild.
  b.carve(x, row, x + drop * 4 + corridor - 1, low - 1);
  b.gentleDown(x, row, drop);
  const c0 = x + drop * 2;
  b.floor(c0, c0 + corridor - 1, low);
  // The pad guarantees any entry pace gets the loop boost — loops are a toy,
  // not a skill check.
  b.dashPad(c0 + 1, low, 1, 11);
  b.loop(c0 + 9, low);
  // Rewards live PAST the loop, >= 7 tiles from its centre, safely outside
  // the annulus wall (outerR is ~5.75 tiles).
  b.ringsH(c0 + corridor - 4, c0 + corridor - 1, low - 3);
  b.enemy(c0 + corridor - 3, low, 2);
  b.gentleUp(c0 + corridor, low - 1, drop);
  return { endX: c0 + corridor + drop * 2, endRow: row };
}

export interface StackedChoiceOpts {
  len?: number;
  /** Rows the platform lane floats above the running lane. */
  lift?: number;
  /** Put a crystal on the upper lane instead of a monitor. */
  crystal?: boolean;
}

/**
 * stackedChoice — two lanes, one choice: a guarded ground road, or a spring
 * up to a one-way platform lane above it with the rewards. FOOTPRINT: len
 * columns (22 default). LANE: ground + a platform lane `lift` rows up (at
 * the default row 24 / lift 8 the shelves land on row 16, the top of the
 * ground band; lift 9+ pushes them into the sky lane). Exceptions: none.
 */
export function stackedChoice(b: LevelBuilder, x: number, row: number, opts: StackedChoiceOpts = {}): MotifEnd {
  const { len = 22, lift = 8, crystal = false } = opts;
  const up = row - lift;
  const mid = x + Math.floor(len / 2);
  b.floor(x, x + len - 1, row);
  b.spring(x + 1, row, 10); // the lift into the platform lane
  b.platform(x + 2, mid - 1, up);
  b.platform(mid + 2, x + len - 2, up);
  b.ringsH(x + 3, mid - 2, up - 2);
  b.ringsH(mid + 3, x + len - 3, up - 2);
  if (crystal) b.crystal(mid + 4, up - 2);
  else b.monitor(x + len - 2, up, 'rings10');
  // The ground road is free but guarded — that is the trade.
  b.enemy(mid, row, 3);
  b.ringsH(x + 4, x + 7, row - 2);
  return { endX: x + len, endRow: row };
}

/* ------------------------------- Set pieces -------------------------------- */

export interface LeapOfFaithOpts {
  /** Rows the blind landing mesa sits below the entry row. */
  drop?: number;
  /** Length of the landing mesa. The launch arc outruns it at full speed, so
   *  ALWAYS chain more flat ground at endRow after this motif (~12+ tiles —
   *  an arenaApproach or runway does nicely). */
  glide?: number;
}

/**
 * leapOfFaith — a dash pad feeds a quarter-pipe lip and the ground simply
 * ends: the player is flung high on a steep diagonal with no landing in
 * sight, guided only by a ring trail. The landing is ALWAYS safe — a long
 * flat mesa a few rows down, plus whatever is chained after it. A slow
 * player can never fall off the blind edge: below launch speed the pipe is a
 * climbable curve that slides them back onto the dash pad, which re-fires
 * them. FOOTPRINT: 8 + glide columns. LANE: ground. Exceptions: columns
 * x+3..x+8 (the pipe's 45° curve and the blind lip drop).
 */
export function leapOfFaith(b: LevelBuilder, x: number, row: number, opts: LeapOfFaithOpts = {}): MotifEnd {
  const { drop = 3, glide = 30 } = opts;
  b.floor(x, x + 2, row);
  b.dashPad(x + 2, row, 1, 11); // guarantees launch speed at the lip
  b.quarterPipe(x + 3, row, 1); // columns x+3..x+7, lip tops out at row-4
  const land = row + drop;
  b.carve(x + 8, row - 4, x + 8 + glide - 1, land - 1);
  b.floor(x + 8, x + 8 + glide - 1, land);
  // The ring trail traces the opening of the arc — the promise that the leap
  // has a landing even though the landing cannot be seen.
  b.rings.push(
    ...[
      { c: 8, r: -7 },
      { c: 11, r: -10 },
      { c: 14, r: -12 },
      { c: 17, r: -13 },
      { c: 20, r: -13 },
      { c: 23, r: -12 },
    ]
      .filter((p) => p.c < 8 + glide)
      .map((p) => ({ x: tileCentre(x + p.c), y: tileCentre(row + p.r) })),
  );
  return { endX: x + 8 + glide, endRow: land };
}

export interface RailCascadeOpts {
  steps?: number;
  /** Flat shelf length before each rail lip. */
  run?: number;
  /** Horizontal span of each rail. */
  span?: number;
  /** Rows each rail descends. */
  dropEach?: number;
}

/**
 * railCascade — a staircase of grind rails: run off each shelf's lip to catch
 * the rail down (the classic "commit by running off the edge" boarding), or
 * jump the drops. A landing floor runs under every rail, so a missed catch
 * costs height, never a life. FOOTPRINT: steps*(run+span+1) + 3 columns;
 * descends steps*dropEach rows total (keep row + total <= 27 to stay in the
 * ground band). LANE: ground. Exceptions: the lip column of each step
 * (offset s*(run+span+1) + run) is a documented drop of dropEach rows.
 */
export function railCascade(b: LevelBuilder, x: number, row: number, opts: RailCascadeOpts = {}): MotifEnd {
  const { steps = 2, run = 6, span = 7, dropEach = 3 } = opts;
  // Clear the whole descent band first so the cascade reads over a base floor.
  b.carve(x, row, x + steps * (run + span + 1) + 2, row + steps * dropEach - 1);
  let cur = row;
  let cx = x;
  for (let s = 0; s < steps; s++) {
    b.floor(cx, cx + run - 1, cur);
    b.ringsH(cx + 1, cx + run - 2, cur - 3);
    const nr = cur + dropEach;
    const rx0 = cx + run;
    const rx1 = rx0 + span;
    // The safety floor under the rail: a rider who bails (or a jumper who
    // overshoots) lands on ground, and the rail's far tip rests exactly on it
    // so the ride sets you down at a defined spot.
    b.floor(rx0, rx1, nr);
    b.rail(rx0, cur, rx1, nr);
    b.ringsH(rx0 + 1, rx1 - 1, cur); // the grind line, marked in rings
    cx = rx1 + 1;
    cur = nr;
  }
  b.floor(cx, cx + 2, cur);
  return { endX: cx + 3, endRow: cur };
}

export interface CartCanyonOpts {
  /** Canyon width in columns (max 9 — the route-continuity limit). */
  gap?: number;
}

/**
 * cartCanyon — a minecart waits at the edge of a chasm with its crash buffer
 * visible on the far side: ride and bail before impact (jumping out keeps the
 * cart's momentum), or stay aboard and pay one hit at the buffer. The canyon
 * floor below has a consolation monitor and a spring escape — falling costs
 * time, never a life. FOOTPRINT: 20 columns. LANE: ground (the canyon dips
 * into the under band). Exceptions: columns x+5..x+4+gap (the canyon).
 */
export function cartCanyon(b: LevelBuilder, x: number, row: number, opts: CartCanyonOpts = {}): MotifEnd {
  const { gap = 7 } = opts;
  const g1 = x + 4 + gap; // last canyon column
  b.floor(x, x + 4, row); // boarding side
  b.carve(x + 5, row - 6, g1, row + 5);
  b.floor(x + 5, g1, row + 6); // the consolation ledge
  b.monitor(x + 6, row + 6, 'rings10');
  b.spring(g1 - 1, row + 6, 12);
  b.spring(g1, row + 6, 12);
  b.floor(g1 + 1, x + 19, row); // far side, carrying the buffer
  // Track from the boarding edge to a buffer standing on solid far ground —
  // the crash always sets the rider down on real floor.
  b.cartRide(x + 3, row, x + 15, row);
  b.ringsH(x + 5, g1, row - 3); // the flight line for bailers
  return { endX: x + 20, endRow: row };
}

export interface StalactiteGalleryOpts {
  len?: number;
  count?: number;
}

/**
 * stalactiteGallery — a run under a low roof strung with hanging spikes.
 * Passing beneath arms them: tremble (safe), fall (hurts), shatter (safe) —
 * a "keep moving" prompt, never an ambush. FOOTPRINT: len columns. LANE:
 * ground; the roof slab sits 7 rows up, so at row 24 it stays inside the
 * ground band (at higher rows it pokes into the sky band — fine, but know
 * it). Exceptions: none (the lane itself is flat).
 */
export function stalactiteGallery(b: LevelBuilder, x: number, row: number, opts: StalactiteGalleryOpts = {}): MotifEnd {
  const { len = 14, count = 3 } = opts;
  b.floor(x, x + len - 1, row);
  b.slab(x + 1, x + len - 2, row - 7, 2); // the roof the spikes hang from
  const step = count > 1 ? Math.floor((len - 6) / (count - 1)) : 0;
  for (let i = 0; i < count; i++) b.stalactite(x + 3 + i * step, row - 6);
  b.ringsH(x + 2, x + len - 3, row - 3);
  return { endX: x + len, endRow: row };
}

export interface PhaseCrossingOpts {
  /** Pit width in columns (max 9 — the route-continuity limit). */
  gap?: number;
  period?: number;
}

/**
 * phaseCrossing — hard-light platforms bridge a pit, counter-phased so one
 * half is always solid; below them a slow lower route walks the pit floor to
 * a spring escape at the far wall. FOOTPRINT: gap + 10 columns. LANE: ground
 * (pit floor in the under band). Exceptions: columns x+4..x+3+gap (the pit).
 */
export function phaseCrossing(b: LevelBuilder, x: number, row: number, opts: PhaseCrossingOpts = {}): MotifEnd {
  const { gap = 8, period = 180 } = opts;
  const g0 = x + 4;
  const g1 = x + 3 + gap;
  b.floor(x, x + 3, row);
  b.carve(g0, row - 6, g1, row + 4);
  b.floor(g0, g1, row + 5); // the slow lower route
  b.spring(g1 - 1, row + 5, 11);
  b.spring(g1, row + 5, 11);
  const half = Math.ceil(gap / 2);
  // Counter-phased halves: when one blinks out its partner is already lit,
  // so the crossing is a rhythm, not a wait.
  b.phasePlatform(g0, g0 + half - 1, row, period, 0);
  b.phasePlatform(g0 + half, g1, row, period, Math.floor(period / 2));
  b.ringsH(g0, g1, row - 2);
  b.floor(g1 + 1, x + gap + 9, row);
  return { endX: x + gap + 10, endRow: row };
}

export interface QuarterPipeBowlOpts {
  /** Flat basin columns between the two facing pipes. */
  basin?: number;
}

/**
 * quarterPipeBowl — two facing quarter-pipes sunk into the ground make a
 * half-pipe: drop in off either lip, and speed (a dash pad in the basin
 * guarantees it) flings you out of the far lip on a steep diagonal. Both
 * lips carry converting launchers, so a skilled skater can fling out of
 * either side. FOOTPRINT: basin + 10 columns; entry and exit are flush with
 * `row`. LANE: ground (basin dips one row into the under band). Exceptions:
 * the whole footprint (45° walls and the sunken basin are the point).
 */
export function quarterPipeBowl(b: LevelBuilder, x: number, row: number, opts: QuarterPipeBowlOpts = {}): MotifEnd {
  const { basin = 4 } = opts;
  const base = row + 4; // pipe tops sit exactly at the entry row
  b.carve(x, row, x + 9 + basin, base - 1); // scoop the bowl out of any base
  b.quarterPipe(x, base, -1); // left wall: x..x+4, lip flush with the entry
  b.floor(x + 5, x + 4 + basin, base);
  // The pad makes the rightward fling unmissable for anyone who rolls in too
  // slow to skate the bowl themselves.
  b.dashPad(x + 4 + Math.ceil(basin / 2), base, 1, 10);
  b.quarterPipe(x + 5 + basin, base, 1); // right wall: lip launches rightward
  b.ringsH(x + 5, x + 4 + basin, row + 1);
  return { endX: x + 10 + basin, endRow: row };
}

export interface BoardSprintOpts {
  sections?: number;
  /** Mount a Mag-Board at the start and dismount at the end. At most ONE
   *  board:true motif per act — a level has a single dismount line. */
  board?: boolean;
}

/**
 * boardSprint — the Mag-Board biome rhythm: dash-padded decks broken by pits
 * with spring escapes, so falling off the fast line costs time, never a
 * life. FOOTPRINT: sections*14 + 6 columns. LANE: ground (pit floors 5 rows
 * down — keep row <= 22 if the pits must stay inside the ground band).
 * Exceptions: each section's pit, columns s*14+7 .. s*14+13.
 */
export function boardSprint(b: LevelBuilder, x: number, row: number, opts: BoardSprintOpts = {}): MotifEnd {
  const { sections = 2, board = false } = opts;
  let cx = x;
  for (let s = 0; s < sections; s++) {
    b.floor(cx, cx + 6, row);
    if (s === 0 && board) b.boardPad(cx + 1, row);
    b.dashPad(cx + 3, row, 1, 11);
    b.ringsH(cx + 1, cx + 5, row - 3);
    const p0 = cx + 7;
    const p1 = cx + 13;
    b.carve(p0, row - 6, p1, row + 4);
    b.floor(p0, p1, row + 5);
    b.spring(p1 - 1, row + 5, 11);
    b.spring(p1, row + 5, 11);
    b.ringsH(p0, p1, row - 2); // the flight line over the gap
    cx = p1 + 1;
  }
  b.floor(cx, cx + 5, row);
  if (board) b.boardEnd(cx + 3);
  return { endX: cx + 6, endRow: row };
}

/* ----------------------------- Underworld doors ---------------------------- */

export interface SneakUnderOpts {
  /** Mark the pocket as one of the act's secret rooms. */
  secret?: boolean;
  /** Put a crystal in the pocket instead of a shield monitor. */
  crystal?: boolean;
}

/**
 * sneakUnder — a two-column shaft in the road drops into an underworld
 * pocket (rows +7..+10 below): loot, then spring back up the shaft. The
 * surface route runs straight over the top. FOOTPRINT: 12 columns. LANE:
 * ground over an under-lane pocket (at row 24 the pocket floor is row 34,
 * squarely in the under band). Exceptions: columns x+4..x+5 (the shaft).
 */
export function sneakUnder(b: LevelBuilder, x: number, row: number, opts: SneakUnderOpts = {}): MotifEnd {
  const { secret = false, crystal = false } = opts;
  b.floor(x, x + 11, row);
  b.ringsH(x + 1, x + 3, row - 3);
  b.carve(x + 4, row, x + 5, row + 9); // the drop shaft
  b.carve(x + 2, row + 7, x + 9, row + 9); // the pocket
  b.floor(x + 2, x + 9, row + 10);
  if (secret) b.secret(x + 2, row + 7, x + 9, row + 9);
  if (crystal) b.crystal(x + 8, row + 8);
  else b.monitor(x + 8, row + 10, 'shield');
  b.ringBox(x + 6, row + 8, 2, 1);
  // The way out, directly under the shaft — a pit is never a trap.
  b.spring(x + 4, row + 10, 12);
  b.spring(x + 5, row + 10, 12);
  return { endX: x + 12, endRow: row };
}

export interface SecretPocketOpts {
  /** What the room holds. */
  reward?: 'crystal' | 'shield' | 'rings10' | 'shoes';
}

/**
 * secretPocket — a carved secret room just under the road (the zone-1..3
 * pattern): a two-column shaft breaks the surface, the room holds a reward
 * and a ring box, springs lift you back out. Counts toward the act's three
 * secrets. FOOTPRINT: 10 columns. LANE: ground. Exceptions: columns
 * x+2..x+3 (the shaft).
 */
export function secretPocket(b: LevelBuilder, x: number, row: number, opts: SecretPocketOpts = {}): MotifEnd {
  const { reward = 'crystal' } = opts;
  b.floor(x, x + 9, row);
  b.carve(x + 2, row, x + 3, row + 3); // the shaft must break the surface row
  b.carve(x + 2, row + 1, x + 8, row + 3);
  b.secret(x + 2, row, x + 8, row + 3);
  if (reward === 'crystal') b.crystal(x + 6, row + 2);
  else b.monitor(x + 6, row + 4, reward);
  b.ringBox(x + 4, row + 2, 2, 1);
  b.spring(x + 2, row + 4, 12);
  b.spring(x + 3, row + 4, 12);
  return { endX: x + 10, endRow: row };
}

/* ------------------------------- Trials ----------------------------------- */

export interface HazardGauntletOpts {
  len?: number;
  /** 1 = a warm-up, 2 = adds a second trap and a hopper, 3 = adds a swinging
   *  ball and a third trap. Everything stays telegraphed and deterministic. */
  density?: 1 | 2 | 3;
  period?: number;
}

/**
 * hazardGauntlet — a flat stretch of mixed, telegraphed traps: pop-up spikes
 * on staggered clocks, a coiled hopper, and (at full density) a swinging
 * ball. A ring line above marks the jump route over the lot. FOOTPRINT: len
 * columns. LANE: ground. Exceptions: none (the lane itself is flat).
 */
export function hazardGauntlet(b: LevelBuilder, x: number, row: number, opts: HazardGauntletOpts = {}): MotifEnd {
  const { len = 16, density = 2, period = 150 } = opts;
  const mid = x + Math.floor(len / 2);
  b.floor(x, x + len - 1, row);
  b.spikeTrap(x + 3, row, period, 0);
  if (density >= 2) {
    // Staggered offsets so the gauntlet is a rhythm to read, not a wall of
    // simultaneous strikes.
    b.spikeTrap(mid, row, period, Math.floor(period / 3));
    b.hopper(x + len - 5, row);
  }
  if (density >= 3) {
    b.swingBall(mid + 1, row - 10, 8, period, 0);
    b.spikeTrap(x + len - 3, row, period, Math.floor((2 * period) / 3));
  }
  b.ringsH(x + 1, x + len - 2, row - 3);
  return { endX: x + len, endRow: row };
}

/* ------------------------------- Finishers --------------------------------- */

export interface ArenaApproachOpts {
  /** Total footprint; the arena proper is width-8 tiles wide. Min ~32. */
  width?: number;
}

/**
 * arenaApproach — the last stretch of a boss act: a checkpoint, a ring
 * top-up, then the flat arena with its trigger, gates span and goal. Chain
 * it last, sized so endX lands on the world edge. The act's LevelDef must
 * set `bossKind`. FOOTPRINT: width columns (36 default). LANE: ground.
 * Exceptions: none.
 */
export function arenaApproach(b: LevelBuilder, x: number, row: number, opts: ArenaApproachOpts = {}): MotifEnd {
  const { width = 36 } = opts;
  b.floor(x, x + width - 1, row);
  b.checkpoint(x + 2, row); // the fight retries from here, not the whole act
  b.ringsH(x + 4, x + 9, row - 3);
  b.boss(x + 10, x + 6, x + width - 2);
  b.goal(x + width - 6, row);
  return { endX: x + width, endRow: row };
}

export interface SignpostFinishOpts {
  len?: number;
}

/**
 * signpostFinish — the goal for acts without a boss: a checkpoint, a ring
 * line and the signpost on open ground. FOOTPRINT: len columns (16 default).
 * LANE: ground. Exceptions: none.
 */
export function signpostFinish(b: LevelBuilder, x: number, row: number, opts: SignpostFinishOpts = {}): MotifEnd {
  const { len = 16 } = opts;
  b.floor(x, x + len - 1, row);
  b.checkpoint(x + 2, row);
  b.ringsH(x + 4, x + 9, row - 3);
  b.goal(x + len - 6, row);
  return { endX: x + len, endRow: row };
}

/* ------------------------------ Sky overlay -------------------------------- */

export interface CanopyRunOpts {
  len?: number;
  /** Hang a crystal over the second platform (needs len >= 34). */
  crystal?: boolean;
}

/**
 * canopyRun — the sky-lane overlay: a chain of one-way catwalk platforms
 * (8 solid, 5 gap) with ring lines on alternating shelves. Stamp it AFTER
 * the ground chain, at a row <= 16 so it counts as the sky route; chain
 * several to cover an act (consecutive runs join with a 1-column seam).
 * FOOTPRINT: len columns at exactly `row` — it never touches the ground
 * lane. Exceptions (for its own lane): the 5-column gaps between platforms,
 * offsets 8k+8 .. 8k+12 of each 13-column stride.
 */
export function canopyRun(b: LevelBuilder, x: number, row: number, opts: CanopyRunOpts = {}): MotifEnd {
  const { len = 52, crystal = false } = opts;
  let cx = x;
  let i = 0;
  while (cx + 8 <= x + len) {
    b.platform(cx, cx + 7, row);
    if (i % 2 === 0) b.ringsH(cx + 1, cx + 6, row - 2);
    cx += 13;
    i++;
  }
  if (crystal && len >= 34) b.crystal(x + 17, row - 2);
  return { endX: x + len, endRow: row };
}
