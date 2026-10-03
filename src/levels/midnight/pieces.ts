import type { LevelBuilder } from '../../game/Level.ts';
import type { MonitorKind } from '../../game/entities.ts';
import { PHYS } from '../../physics/constants.ts';
import type { MotifEnd } from '../motifs.ts';
import { kicker, launchValley, type LaunchValleyOpts } from '../sections.ts';

/**
 * OTHERWHILE FOUNDRY — biome relief pieces. Same contract as the relief kit
 * (sections.ts): each lays the MIDDLE road plus the set piece that belongs to
 * it and returns where the road ended, `(b, x, row, opts) -> { endX, endRow }`.
 * A foundry is vertical and full of things that carry you, so these are the
 * shapes the shared kit lacks: a channel with a line strung over it, a road
 * under a roof that bites, a hall with a catwalk over the machines, a bridge
 * that is only there half the time. No dash pads, nothing bottomless, and
 * every low road walks out by holding right.
 */

const T = PHYS.tile;

type Prize = 'crystal' | MonitorKind | 'none';

/** A prize on a three-column ledge: seen from the road, taken from above. */
function perch(b: LevelBuilder, kind: Prize, x: number, row: number): void {
  if (kind === 'none') return;
  b.platform(x - 1, x + 1, row);
  if (kind === 'crystal') b.crystal(x, row - 2);
  else b.monitor(x, row, kind);
}

export interface SlagChuteOpts {
  /** Rows the far dock sits below the near one (6–12). */
  drop?: number;
  /** Flat columns of channel bed. */
  bed?: number;
  /** What is strung over the channel: an ore cart on its track, or a skyhook rail. */
  line?: 'cart' | 'rail';
  /** Perched over the middle of the line: leave the ride to take it. */
  prize?: Prize;
  /** Crabs on the channel bed. */
  crabs?: number;
}

/**
 * slagChute — a slag channel cut across the road, with a line strung dock to
 * dock over it. Run onto the line and it carries you down: an ore CART (slow,
 * and it crashes into its buffer — bail before it does, you keep its pace) or
 * a skyhook RAIL (a zip line: you leave it faster than you came). Hop over
 * the line's head instead and the road is the channel itself — a 45° slag
 * face to roll, the bed, and a gentle climb to the far dock. Jumping off the
 * ride for the perched prize drops you there too, or onto the service
 * catwalk over the bed.
 * FOOTPRINT: 12 + drop + bed + 16 columns. NET: falls `drop` rows.
 */
export function slagChute(b: LevelBuilder, x: number, row: number, opts: SlagChuteOpts = {}): MotifEnd {
  const { drop = 10, bed = 10, line = 'cart', prize: reward = 'rings10', crabs = 1 } = opts;
  const far = row + drop;
  const F = far + 4; // the channel bed
  b.floor(x, x + 5, row);
  b.gentleDown(x + 6, row, 1);
  b.slopeDown(x + 8, row + 1, drop + 2);
  b.gentleDown(x + 10 + drop, row + drop + 3, 1);
  const c0 = x + 12 + drop;
  b.floor(c0, c0 + bed - 1, F);
  b.ringsH(c0 + 1, c0 + Math.min(bed - 2, 5), F - 2);
  // A service catwalk over the bed, level with the far dock: the soft
  // landing for whoever leaves the line early.
  b.platform(c0 + 1, c0 + bed - 2, far);
  b.ringsH(c0 + 2, c0 + bed - 3, far - 2);
  for (let i = 0; i < crabs; i++) b.enemy(c0 + bed - 3 - i * 5, F, 2);
  b.gentleUp(c0 + bed, F - 1, 4);
  const d0 = c0 + bed + 8;
  b.floor(d0, d0 + 7, far);
  // The line. A cart needs solid dock under both ends of its track; a rail
  // stops a row short of the far dock so only its riders are carried by it.
  const l0 = line === 'cart' ? x + 4 : x + 6;
  const l1 = line === 'cart' ? d0 + 4 : d0;
  const r1 = line === 'cart' ? far : far - 1;
  if (line === 'cart') b.cartRide(l0, row, l1, r1);
  else b.rail(l0, row, l1, r1);
  const lineRow = (cx: number) => row + ((r1 - row) * (cx - l0)) / (l1 - l0);
  for (let cx = l0 + 3; cx < l1 - 2; cx += 3) b.rings.push({ x: cx * T, y: lineRow(cx) * T - 28 });
  const mid = Math.floor((l0 + l1) / 2);
  perch(b, reward, mid, Math.floor(lineRow(mid)) - 5);
  return { endX: d0 + 8, endRow: far };
}

export interface NeedleChuteOpts {
  /** Rows the road descends under the roof (even, 6–12). */
  drop?: number;
  /** A needle hangs in every n-th bay of the roof. */
  every?: number;
}

/**
 * needleChute — the road tips downhill under a gantry roof that steps down
 * with it, a steel needle hanging in its bays. Passing beneath arms them, so
 * at rolling pace the roof comes down BEHIND you and nothing touches you; it
 * is the hero who brakes, or jumps and bangs his head on a roof step, who is
 * still there when they land. The roof's top is a staircase of its own for
 * whoever arrives by the high road.
 * FOOTPRINT: 2 + drop*2 + 6 columns. NET: falls `drop` rows.
 */
export function needleChute(b: LevelBuilder, x: number, row: number, opts: NeedleChuteOpts = {}): MotifEnd {
  const { drop = 8, every = 2 } = opts;
  b.floor(x, x + 1, row);
  b.gentleDown(x + 2, row, drop);
  const c0 = x + 2 + drop * 2;
  b.floor(c0, c0 + 5, row + drop);
  // One bay per two rows of descent: five rows of headroom under each.
  for (let i = 0; i * 2 < drop; i++) {
    const bx = x + 2 + i * 4;
    const top = row + i * 2 - 7;
    b.slab(bx, bx + 3, top, 2);
    if (i % every === 0) b.stalactite(bx + 2, top + 1);
    b.rings.push({ x: (bx + 1) * T + 8, y: (row + i * 2) * T - 8 }, { x: (bx + 3) * T + 8, y: (row + i * 2 + 1) * T - 8 });
  }
  b.ringsH(c0 + 1, c0 + 4, row + drop - 3);
  return { endX: c0 + 6, endRow: row + drop };
}

export interface PressHallOpts {
  /** Flat columns before the kicker: the run-up for whoever arrives with none. */
  lead?: number;
  /** Length of the hall floor in columns (>= 24). */
  len?: number;
  /** Press tackle swinging under the roof / clocked traps / hoppers on the floor. */
  swings?: number;
  traps?: number;
  hoppers?: number;
  /** Clock of the tackle and the traps (frames). */
  period?: number;
  /** What waits on the catwalk over the hall. */
  prize?: Prize;
}

/**
 * pressHall — the press floor, and the catwalk over it. A kicker stands in
 * the road in front of a sunken hall. Arrive with a hill's worth of speed and
 * it throws you onto the press bed that roofs the hall: a clean catwalk, its
 * prize, and a drop off the far end. Arrive at a walk and you hop off the lip
 * into the hall itself — its first screen clear, then the machinery (tackle
 * swinging from the roof, clocked plates, hoppers) and a gentle climb out.
 * FOOTPRINT: lead + 5 + len + 10 columns. NET: level.
 */
export function pressHall(b: LevelBuilder, x: number, row: number, opts: PressHallOpts = {}): MotifEnd {
  const { lead = 10, len = 30, swings = 1, traps = 1, hoppers = 1, period = 150, prize: reward = 'rings10' } = opts;
  const F = row + 4; // hall floor
  const roof = row - 8; // the press bed: four rows over the kicker's lip, a runner's arc
  // A slow hero cannot climb a kicker from its foot, so the hall brings its
  // own run-up rather than trusting whatever was chained before it.
  b.floor(x, x + lead - 1, row);
  kicker(b, x + lead, row);
  const h0 = x + lead + 5;
  b.floor(h0, h0 + len - 1, F);
  b.ringsH(h0 + 2, h0 + 7, F - 2);
  b.gentleUp(h0 + len, F - 1, 4);
  const e0 = h0 + len + 8;
  b.floor(e0, e0 + 1, row);
  // A one-way apron catches the arc; the bed behind it is solid steel.
  b.platform(h0 + 3, h0 + 9, roof);
  b.slab(h0 + 10, h0 + len - 3, roof, 2);
  b.ringsH(h0 + 11, h0 + len - 5, roof - 2);
  if (reward === 'crystal') b.crystal(h0 + len - 6, roof - 2);
  else if (reward !== 'none') b.monitor(h0 + len - 6, roof, reward);
  // Machinery starts ten columns in: whoever missed the catwalk lands clear.
  const m0 = h0 + 10;
  const span = len - 14;
  for (let i = 0; i < swings; i++) b.swingBall(m0 + Math.floor(((i + 0.5) * span) / swings), roof + 2, 8, period, i * 50);
  for (let i = 0; i < traps; i++) b.spikeTrap(m0 + 2 + Math.floor((i * span) / Math.max(1, traps)), F, period, i * 40);
  for (let i = 0; i < hoppers; i++) b.hopper(m0 + span - 2 - i * 7, F);
  return { endX: e0 + 2, endRow: row };
}

export interface ShiftBridgeOpts {
  /** Rows the trough lies under the bridge (4–8). */
  depth?: number;
  /** Flat columns at the bottom of the trough; depth*2 + bed must be a multiple of 4. */
  bed?: number;
  /** Frames per shift: the bridge is lit for half of it. */
  period?: number;
  /** Perched over the middle of the bridge. */
  prize?: Prize;
  /** Crabs in the trough. */
  crabs?: number;
}

/**
 * shiftBridge — a trough cut square into the road and a hard-light catwalk
 * across it, rim to rim. The light sweeps on from the near rim and goes out
 * the same way, so the bridge is a question of pace: step on as it lights and
 * anyone crosses; arrive late in the shift and only speed gets you over
 * before it blinks out under you. Then you are in the trough — rings, a crab,
 * a gentle climb out the far side — never anywhere worse.
 * FOOTPRINT: 4 + bed + depth*2 + 4 columns. NET: level.
 */
export function shiftBridge(b: LevelBuilder, x: number, row: number, opts: ShiftBridgeOpts = {}): MotifEnd {
  const { depth = 6, bed = 16, period = 200, prize: reward = 'rings10', crabs = 1 } = opts;
  const bottom = row + depth;
  b.floor(x, x + 3, row);
  // A square near wall, not a slope: where the light is out the ground must
  // really be gone, or the feet stay on the hill and never find the bridge.
  const g0 = x + 4;
  b.floor(g0, g0 + bed - 1, bottom);
  b.ringsH(g0 + 2, g0 + bed - 3, bottom - 2);
  for (let i = 0; i < crabs; i++) b.enemy(g0 + bed - 4 - i * 5, bottom, 2);
  b.gentleUp(g0 + bed, bottom - 1, depth);
  const g1 = g0 + bed + depth * 2 - 1;
  b.floor(g1 + 1, g1 + 4, row);
  // Four-column panels, each lighting four frames after the one before it.
  for (let px = g0, i = 0; px + 3 <= g1; px += 4, i++) {
    b.phasePlatform(px, px + 3, row, period, -4 * i);
    if (i % 2 === 0) b.ringsH(px + 1, px + 2, row - 2);
  }
  perch(b, reward, Math.floor((g0 + g1) / 2), row - 5);
  return { endX: g1 + 5, endRow: row };
}

export interface VaultOpts {
  /** What the room holds. */
  reward?: Prize;
}

/**
 * vault — a secret room under the road whose shaft opens at its FAR end, the
 * springs right under it: whoever falls in holding right is lifted straight
 * back out, and the room itself — loot, rings — is a walk to the left. (The
 * shared kit's pockets open at the near end, which walls a hold-right hero
 * in.) Counts as one of the act's secrets.
 * FOOTPRINT: 10 columns. NET: level.
 */
export function vault(b: LevelBuilder, x: number, row: number, opts: VaultOpts = {}): MotifEnd {
  const { reward = 'crystal' } = opts;
  b.floor(x, x + 9, row);
  b.carve(x + 1, row + 1, x + 7, row + 3);
  b.carve(x + 6, row, x + 7, row); // the shaft must break the surface row
  b.secret(x + 1, row, x + 7, row + 3);
  if (reward === 'crystal') b.crystal(x + 2, row + 2);
  else if (reward !== 'none') b.monitor(x + 2, row + 4, reward);
  b.ringBox(x + 3, row + 2, 2, 1);
  b.spring(x + 6, row + 4, 10);
  b.spring(x + 7, row + 4, 10);
  return { endX: x + 10, endRow: row };
}

/**
 * valley — the kit's launchValley with its climb-out mended. When a valley
 * climbs out eight rows or more, the last tile of its lower ledge is stamped
 * over the ramp and leaves an 8 px wall standing in it: a hero who comes up
 * from the valley floor at a walk (hurt down there, say) runs into it and
 * cannot get out. This puts the ramp tile back; the ledge ends a column
 * short of the slope instead.
 */
export function valley(b: LevelBuilder, x: number, row: number, opts: LaunchValleyOpts = {}): MotifEnd {
  const end = launchValley(b, x, row, opts);
  const { depth = 12, basin = 10 } = opts;
  if ((opts.out ?? depth - 2) >= 8) b.set(x + depth * 2 + basin + 53, row + depth - 8, '(');
  return end;
}
