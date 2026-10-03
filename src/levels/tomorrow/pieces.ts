import type { LevelBuilder } from '../../game/Level.ts';
import type { MonitorKind } from '../../game/entities.ts';
import { PHYS } from '../../physics/constants.ts';
import type { MotifEnd } from '../motifs.ts';
import { groundRow, tubeShot, type TubeShotOpts } from '../sections.ts';

/**
 * NOON TOMORROW's own relief pieces — the city built in the air. They follow
 * the conventions of sections.ts: `(b, x, row, opts) -> { endX, endRow }`, the
 * middle road is solid ground filled to bedrock, nothing is bottomless, and
 * every low road leaves by holding right. What they add is the biome's
 * vocabulary as TERRAIN rather than as props on a flat: rails that span a
 * valley, roofs with a street under them, hard light where a ledge would be.
 * Measured in tests/pieces-tomorrow.test.ts.
 */

const T = PHYS.tile;

type Prize = 'crystal' | MonitorKind | 'none';

function prize(b: LevelBuilder, kind: Prize, x: number, surfaceRow: number): void {
  if (kind === 'crystal') b.crystal(x, surfaceRow - 2);
  else if (kind !== 'none') b.monitor(x, surfaceRow, kind);
}

function need(ok: boolean, what: string): void {
  if (!ok) throw new Error(`tomorrow/pieces: ${what}`);
}

/** Ring line a little over a rail from (x0, row0) to (x1, row1). */
function grindLine(b: LevelBuilder, x0: number, row0: number, x1: number, row1: number): void {
  for (let x = x0 + 1; x < x1 - 2; x += 3) b.rings.push({ x: x * T + 8, y: (row0 + ((row1 - row0) * (x - x0)) / (x1 - x0)) * T - 22 });
}

export interface SkyRailOpts {
  /** Rows the ride descends, lip to far bank (4–14). */
  drop?: number;
  /** Columns the rail spans. */
  len?: number;
  /** Rows the valley floor lies below the lip (default drop + 4). */
  depth?: number;
  /** Hoppers on the valley floor, and what it pays whoever walks it. */
  hoppers?: number;
  prize?: Prize;
  /** Hang a crystal over the rail's midpoint: jump from the ride to take it. */
  crystal?: boolean;
  /** Flat columns of far bank. */
  runout?: number;
}

/**
 * skyRail — the biome's release. The road ends at a lip and a grind rail takes
 * over, running down across a whole valley to the far bank: run off the edge
 * and you are carried (9 px/frame at the least, more for the slope and for
 * what you brought). The valley under the ribbon is real ground — jump off
 * the ride and you are on it: hoppers, a prize, a gentle climb out, and the
 * rail still a jump overhead on its upper slope. The tip rests on the far
 * bank, so the ride sets you down on ground with nothing after it but rings.
 * FOOTPRINT: 6 + len + runout columns. NET: falls `drop` rows.
 */
export function skyRail(b: LevelBuilder, x: number, row: number, opts: SkyRailOpts = {}): MotifEnd {
  const { drop = 8, len = 40, hoppers = 1, prize: reward = 'rings10', crystal = false, runout = 10 } = opts;
  const depth = opts.depth ?? drop + 4;
  const down = depth - 3;
  const up = depth - drop;
  const basin = len - down * 2 - up * 2;
  need(up >= 1 && basin >= 4, `skyRail at column ${x}: a ${len}-column rail cannot span a valley ${depth} rows deep`);
  need(row + depth <= b.h - 4, `skyRail at column ${x}: row ${row} + depth ${depth} leaves no bedrock`);

  b.floor(x, x + 4, row);
  b.ringsH(x + 1, x + 4, row - 3);
  // A bevelled lip with the rail's head at its foot: whoever comes off the
  // edge, at a crawl or a sprint, is on the rail's line before he can fall
  // past it. Nobody misses this ride by accident.
  b.slopeDown(x + 5, row, 1);
  const r0 = x + 6;
  b.gentleDown(r0, row + 3, down);
  const c0 = r0 + down * 2;
  b.floor(c0, c0 + basin - 1, row + depth);
  b.gentleUp(c0 + basin, row + depth - 1, up);
  const e = r0 + len;
  b.floor(e, e + runout - 1, row + drop);

  b.rail(r0, row + 1, e, row + drop);
  grindLine(b, r0, row + 1, e, row + drop);
  if (crystal) b.crystal(r0 + Math.floor(len / 2), row + Math.floor(drop / 2) - 4);
  for (let i = 0; i < hoppers && i * 6 + 5 <= basin; i++) b.hopper(c0 + 1 + i * 6, row + depth);
  prize(b, reward, c0 + basin - 2, row + depth);
  b.ringsH(e + 2, e + Math.min(runout - 2, 7), row + drop - 3);
  return { endX: e + runout, endRow: row + drop };
}

/**
 * ribbon — a grind rail from the end of a high ledge at (x0, row0) to a
 * landing at (x1, row1), with its ring line: how the high road crosses what
 * the middle road has to climb through. Run off the ledge and it carries you;
 * uphill it still holds 9 px/frame. An overlay — stamp it AFTER the ground
 * chain. It refuses a line that passes within two rows of anything on the
 * way (a walker underneath would be snatched up), or a tip with nothing
 * under it to be set down on.
 */
export function ribbon(b: LevelBuilder, x0: number, row0: number, x1: number, row1: number): void {
  for (let x = x0; x < x1 - 4; x++) {
    const y = Math.floor(row0 + ((row1 - row0) * (x - x0)) / (x1 - x0));
    for (let r = y - 2; r <= y + 1; r++) need(b.grid[r]?.[x] === '.', `ribbon ${x0}..${x1} is not clear at column ${x}, row ${r}`);
  }
  need(b.grid[row1]?.[x1] !== '.', `ribbon ${x0}..${x1} has no landing at column ${x1}, row ${row1}`);
  b.rail(x0, row0, x1, row1);
  grindLine(b, x0, row0, x1, row1);
}

/**
 * roofedTube — the kit's tubeShot, with its kicker roofed over. The bluff
 * ends two columns short of its own kicker, which stands in open sky: a hero
 * who drops there — off the roof's edge, or off a catwalk that ended over it
 * — lands on the kicker's face with no run-up, and a 45° face cannot be
 * climbed from a standstill (measured: pinned up to 400 frames). A one-way
 * awning carries the roof on over the kicker instead and sets its walkers
 * down on the landing strip; the tunnel's own launch leaves from far below.
 */
export function roofedTube(b: LevelBuilder, x: number, row: number, opts: TubeShotOpts = {}): MotifEnd {
  const end = tubeShot(b, x, row, opts);
  const mouth = x + 2 + (opts.drop ?? 8) * 2 + 4; // first open column past the bluff
  b.platform(mouth, mouth + 9, groundRow(b, mouth - 1)); // level with the roof, whatever the kit makes it
  return end;
}

export interface RooftopsOpts {
  /** Row change of each roof against the one before it (negative = up; keep
   *  within -3..+4, a jump). One entry per tower block. */
  steps?: number[];
  /** Roof length and alley width, in columns. */
  width?: number;
  alley?: number;
  /** Rows from the entry road down to the street (roofs stay 5 over it). */
  depth?: number;
  /** Crabs patrolling the street. */
  crabs?: number;
  /** A drone over every n-th alley (0 = none): a stepping stone, or a slap. */
  droneEvery?: number;
  /** A back room off the first alley, against the direction of travel. */
  room?: Prize;
  /** Mark that room as one of the act's secrets. */
  secret?: boolean;
}

/**
 * rooftops — the city's own knot. Tower blocks stand in the road with alleys
 * between them; the roofs step up and down, so no two jumps are the same.
 * Miss one and you are in the STREET: a gallery that runs under every block
 * from the first alley to the last, crabs on it, and the springs at its far
 * wall put you back on the road. Turn left at the bottom of the first alley
 * instead and there is a back room.
 * FOOTPRINT: steps.length * (width + alley) + 4 columns. NET: the sum of
 * `steps` (the landing is level with the last roof).
 */
export function rooftops(b: LevelBuilder, x: number, row: number, opts: RooftopsOpts = {}): MotifEnd {
  const { steps = [0, -2, 1, -2, 3], width = 7, alley = 4, depth = 8, crabs = 1, droneEvery = 0, room = 'none', secret = false } = opts;
  const street = row + depth;
  let cur = row;
  let cx = x;
  steps.forEach((step, i) => {
    cur += step;
    need(cur <= street - 5 && cur >= 4, `rooftops at column ${x}: roof ${i} (row ${cur}) does not clear the street (row ${street})`);
    b.floor(cx, cx + width - 1, cur);
    if (i > 0) b.carve(cx, street - 4, cx + width - 1, street - 1); // the street runs under the block
    if (i % 2 === 1) b.ringsH(cx + 2, cx + width - 3, cur - 3);
    const a0 = cx + width;
    b.floor(a0, a0 + alley - 1, street);
    b.rings.push({ x: (a0 + alley / 2) * T, y: (cur - 3) * T }); // the hop, marked
    if (droneEvery > 0 && i % droneEvery === droneEvery - 1) b.drone(a0 + Math.floor(alley / 2), cur - 2, 1);
    cx = a0 + alley;
  });
  // The landing: solid ground level with the last roof, and the street's lift.
  b.floor(cx, cx + 3, cur);
  const lift = street - cur >= 11 ? 12 : street - cur >= 8 ? 11 : 10;
  b.spring(cx - 2, street, lift);
  b.spring(cx - 1, street, lift);
  const s0 = x + width;
  for (let i = 0; i < crabs; i++) b.enemy(s0 + Math.floor(((i + 1) * (cx - s0)) / (crabs + 1)), street, 2);
  b.ringsH(s0 + alley + 1, s0 + alley + width - 2, street - 2);
  if (room !== 'none' || secret) {
    b.carve(x + 1, street - 4, s0 - 1, street - 1);
    prize(b, room, x + 2, street);
    b.ringBox(x + 4, street - 2, 2, 1);
    if (secret) b.secret(x + 1, street - 4, s0 - 2, street - 1);
  }
  return { endX: cx + 4, endRow: cur };
}

export interface LightStairOpts {
  /** Hard-light steps, each `rise` rows over the last (3 is a relaxed jump). */
  steps?: number;
  rise?: number;
  /** Frames per blink cycle; neighbours run half a cycle apart. */
  period?: number;
  /** Length of the real ledge the stair arrives on, and what waits there. */
  ledge?: number;
  prize?: Prize;
}

/**
 * lightStair — the way up to the high road, in hard light: 4-column phase
 * platforms climbing from the road at (x, row), counter-phased so that of any
 * two neighbours one is always lit — the climb is a rhythm, not a wait. It
 * arrives on a real ledge with a prize. Fall, and you are back on the road
 * you left. An overlay: stamp it AFTER the ground chain, over clear air.
 * FOOTPRINT: steps*6 + ledge columns, up to (steps+1)*rise rows over `row`.
 */
export function lightStair(b: LevelBuilder, x: number, row: number, opts: LightStairOpts = {}): MotifEnd {
  const { steps = 3, rise = 3, period = 180, ledge = 8, prize: reward = 'rings10' } = opts;
  for (let i = 0; i < steps; i++) {
    const r = row - (i + 1) * rise;
    b.phasePlatform(x + i * 6, x + i * 6 + 3, r, period, i % 2 === 0 ? 0 : Math.floor(period / 2));
    b.ringsH(x + i * 6 + 1, x + i * 6 + 2, r - 2);
  }
  const top = row - (steps + 1) * rise;
  const l0 = x + steps * 6;
  need(top >= 4, `lightStair at column ${x}: its ledge would leave the top of the world`);
  b.platform(l0, l0 + ledge - 1, top);
  prize(b, reward, l0 + ledge - 2, top);
  return { endX: l0 + ledge, endRow: top };
}

export interface LightBridgeOpts {
  /** Rows the road dips under the bridge (4–8), and the flat at the bottom. */
  depth?: number;
  basin?: number;
  /** Frames per blink cycle; neighbouring spans run half a cycle apart. */
  period?: number;
  /** What sits on the pier, the one real ledge at mid-span. */
  prize?: Prize;
  /** Valley hazards: 0 none, 1 a hopper, 2 a hopper and clocked spikes. */
  hazards?: 0 | 1 | 2;
}

/**
 * lightBridge — a valley roofed in hard light. The road dips and comes back;
 * level with its rims a bridge of 4-column phase spans crosses the gap, lit
 * alternately, with one real pier at mid-span for the prize. Keep the rhythm
 * and you keep your height and skip whatever lives in the dip; lose it and
 * you are simply on the road, which was always there.
 * FOOTPRINT: 4 + depth*4 + basin + 4 columns (basin a multiple of 4). NET: 0.
 */
export function lightBridge(b: LevelBuilder, x: number, row: number, opts: LightBridgeOpts = {}): MotifEnd {
  const { depth = 6, basin = 12, period = 180, prize: reward = 'rings10', hazards = 1 } = opts;
  need(basin % 4 === 0 && row + depth <= b.h - 4, `lightBridge at column ${x}: basin ${basin} must be a multiple of 4, on rock`);
  b.floor(x, x + 3, row);
  const v0 = x + 4;
  b.gentleDown(v0, row, depth);
  const c0 = v0 + depth * 2;
  b.floor(c0, c0 + basin - 1, row + depth);
  b.gentleUp(c0 + basin, row + depth - 1, depth);
  const end = c0 + basin + depth * 2;
  b.floor(end, end + 3, row);
  const spans = (end - v0) / 4;
  for (let i = 0; i < spans; i++) {
    const sx = v0 + i * 4;
    if (i === Math.floor(spans / 2)) {
      b.platform(sx, sx + 3, row);
      prize(b, reward, sx + 2, row);
    } else {
      b.phasePlatform(sx, sx + 3, row, period, i % 2 === 0 ? 0 : Math.floor(period / 2));
      b.ringsH(sx + 1, sx + 2, row - 2);
    }
  }
  if (hazards >= 1) b.hopper(c0 + 1, row + depth);
  if (hazards >= 2) b.spikeTrap(c0 + basin - 2, row + depth, period, 30);
  b.ringsH(c0 + 5, c0 + basin - 4, row + depth - 2);
  return { endX: end + 4, endRow: row };
}
