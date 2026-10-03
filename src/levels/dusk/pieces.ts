import type { LevelBuilder } from '../../game/Level.ts';
import type { MonitorKind } from '../../game/entities.ts';
import { PHYS } from '../../physics/constants.ts';
import type { MotifEnd } from '../motifs.ts';
import { kicker, ringArc } from '../sections.ts';

/**
 * DUSKMERE PIECES — the coast's own relief, on top of the shared kit
 * (sections.ts). Same conventions: each piece lays the middle road plus the
 * ledges and pools of its own set piece, takes (b, x, row, opts) and returns
 * { endX, endRow }. No dash pads; nothing is bottomless; every pool has a
 * spring out that works by holding right.
 *
 * What the coast adds: sea wind (thermals lift anyone airborne, and carry an
 * open wing hard), reef bowls, the tide flats where the hoppers live, and
 * planking that does not wait for you.
 */

const T = PHYS.tile;

type Prize = 'crystal' | MonitorKind | 'none';

function prize(b: LevelBuilder, kind: Prize, x: number, surfaceRow: number): void {
  if (kind === 'crystal') b.crystal(x, surfaceRow - 2);
  else if (kind !== 'none') b.monitor(x, surfaceRow, kind);
}

export interface GliderBayOpts {
  /** Columns of open bay past the lip (44–60) / rows down to its floor (8–14). */
  width?: number;
  depth?: number;
  /** Rows the far shore climbs back (default depth - 2). */
  out?: number;
  /** Rows of gentle downhill the piece lays before its own brink (0–12):
   *  the speed for the throw, delivered where nothing upstream can spoil it. */
  feed?: number;
  /** What waits on the roost, the ledge only a wing reaches. */
  prize?: Prize;
  /** The mid-bay thermal that lifts a slow wing to the roost. Off = the
   *  earned version: the roost is for a run, and a stroll sinks to the floor. */
  thermal?: boolean;
  /** Adds the upper roost, six rows over the first, with this on it: where a
   *  ROLLED approach off a 12-row downhill comes down. */
  upper?: Prize;
  /** Crabs on the bay floor (0–2), for whoever came down without a wing. */
  crabs?: number;
}

/**
 * gliderBay — the wing's own set piece. The road hands you the hang glider,
 * curls into a kicker and stops: a bay lies open beyond, a long roost over
 * it that no jump reaches. Leave the lip with JUMP HELD and the wing opens
 * at the top of the throw (it only opens on a fall you did not jump into,
 * which is why the road ends in a kicker and not a wall). How high the
 * throw is, is the speed you arrived with — and the wing is what a slow
 * arrival has instead of speed:
 *  - a STROLL sinks toward the water, where the thermal in mid-bay lifts an
 *    open wing back onto the roost; with no wing it is the bay floor;
 *  - a RUN off a short downhill needs the wing to reach the roost, and off
 *    a long one (8 rows) the kicker alone throws it there;
 *  - a ROLL down 12 rows is thrown onto the `upper` roost, wing or none.
 * The bay floor is a road too: crabs, a sandbar, a gentle climb out. Keep
 * ledge ends and springs 16 columns clear of the kicker — a hero dropped
 * onto a 45° lip at rest crawls — and feed it from a GENTLE slope (`feed`),
 * not a cliff: off a brow a hopping runner overflies the run-up.
 * FOOTPRINT: feed*2 + 13 + width + out*2 + 4 columns (77 at the defaults).
 * NET: falls feed + depth - out rows (2). Needs row >= 16.
 */
export function gliderBay(b: LevelBuilder, x0: number, row0: number, opts: GliderBayOpts = {}): MotifEnd {
  const { width = 44, depth = 10, feed = 0, prize: reward = 'crystal', thermal = true, upper = 'none', crabs = 2 } = opts;
  const out = opts.out ?? depth - 2;
  if (feed > 0) b.gentleDown(x0, row0, feed);
  const x = x0 + feed * 2;
  const row = row0 + feed;
  const R = row + depth;
  b.floor(x, x + 7, row);
  b.glider(x + 3, row - 2);
  kicker(b, x + 8, row);
  const lip = x + 13;
  b.floor(lip, lip + width - 1, R);
  // A sandbar in mid-bay: the floor is a road too, and no road is level.
  const bar = lip + Math.floor(width / 2) - 6;
  b.hill(bar, R, 2, 4);
  if (crabs >= 1) b.enemy(lip + width - 9, R, 3);
  if (crabs >= 2) b.enemy(lip + 9, R, 3);
  b.ringsH(bar + 4, bar + 7, R - 5);
  const climb = lip + width;
  b.gentleUp(climb, R - 1, out);
  const end = climb + out * 2;
  b.floor(end, end + 3, R - out);
  // A gentle column with a low head: a full-strength thermal throws a wing a
  // hundred columns, and this one only has to give a slow one its height back.
  if (thermal) b.wind(lip + 12, row - 5, lip + 16, R - 4, 0.12);
  const roost = row - 3;
  // The roost ends over level ground — the bay floor or the far shore's top,
  // never the climb-out: whoever drops off its end must be able to walk on.
  b.platform(lip + 14, width >= 54 ? lip + 52 : end + 1, roost);
  prize(b, reward, lip + 48, roost);
  b.ringsH(lip + 22, lip + 28, roost - 2);
  if (upper !== 'none') {
    b.platform(lip + 14, lip + 34, roost - 6);
    prize(b, upper, lip + 30, roost - 6);
    ringArc(b, lip, row - 4, 6, -8, 4, 6);
  }
  ringArc(b, lip, row - 4, 6, -5, 4, 5);
  if (thermal) for (let i = 0; i < 4; i++) b.rings.push({ x: (lip + 14.5) * T, y: (row + 2 - i * 1.2) * T });
  return { endX: end + 4, endRow: R - out };
}

export interface ThermalCliffOpts {
  /** Rows the cliff rises (6–16) / flat columns on top. */
  rise?: number;
  top?: number;
  /** What sits on the perch, 6 rows over the clifftop in the same updraught. */
  prize?: Prize;
}

/**
 * thermalCliff — the coast's way back UP: sea wind piles against a cliff
 * face, and anyone who jumps into the column is carried to the top. Hold
 * right and you step off onto the clifftop; let go, ride the column to its
 * head, and it sets you on the perch above — a prize seen from below.
 * Slower than a spring, steered, and it sets you down ON the clifftop where
 * a spring's arc would carry you twenty columns past it.
 * FOOTPRINT: 8 + top columns. NET: rises `rise` rows.
 */
export function thermalCliff(b: LevelBuilder, x: number, row: number, opts: ThermalCliffOpts = {}): MotifEnd {
  const { rise = 12, top = 10, prize: reward = 'rings10' } = opts;
  const crest = row - rise;
  b.floor(x, x + 7, row);
  b.floor(x + 8, x + 8 + top - 1, crest);
  b.wind(x + 3, crest - 8, x + 7, row - 1, 0.45);
  for (let r = 3; r <= rise + 5; r += 2) b.rings.push({ x: (x + 6) * T, y: (row - r) * T });
  b.platform(x + 5, x + 11, crest - 6);
  prize(b, reward, x + 10, crest - 6);
  b.ringsH(x + 10, x + 8 + top - 2, crest - 3);
  return { endX: x + 8 + top, endRow: crest };
}

export interface ReefBowlOpts {
  /** Rows of downhill feeding the bowl (2–8) / flat columns across its basin. */
  drop?: number;
  basin?: number;
  /** Rows the far reef stands ABOVE the lip (0 = level ground, up to 10). */
  lift?: number;
  /** Clear columns of landing ground (the fling is ~30 columns long). */
  run?: number;
  /** What rides the shelf over the landing, where the fling tops out. */
  prize?: Prize;
}

/**
 * reefBowl — a quarter-pipe bowl fed by its hill, not by a pad. The road
 * tips downhill, drops in over one curved wall and comes up the other:
 * arrive at a run and the far lip turns your speed into a steep fling, out
 * over a tide pool and onto the reef beyond — which can stand up to ten rows
 * ABOVE the lip, so a bowl is also a way to climb. Arrive at a walk and the
 * lip is a curve to step over: into the pool, and a spring up the reef. The
 * shelf above the landing catches the top of the fling. Chain only
 * hazard-free ground after it, and keep ledge ends 16 columns clear of the
 * basin: dropped into it at rest, the far wall has to be walked back from.
 * FOOTPRINT: 2 + drop*2 + 10 + basin + 8 + run columns (66 at the defaults).
 * NET: falls drop - lift rows.
 */
export function reefBowl(b: LevelBuilder, x: number, row: number, opts: ReefBowlOpts = {}): MotifEnd {
  const { drop = 4, basin = 8, lift = 0, run = 30, prize: reward = 'rings10' } = opts;
  const L = row + drop; // both lips
  const base = L + 4;
  b.floor(x, x + 1, row);
  b.gentleDown(x + 2, row, drop);
  const p0 = x + 2 + drop * 2;
  b.quarterPipe(p0, base, -1);
  b.floor(p0 + 5, p0 + 4 + basin, base);
  b.ringsH(p0 + 5, p0 + 4 + basin, base - 2);
  b.quarterPipe(p0 + 5 + basin, base, 1);
  const lip = p0 + 10 + basin;
  // The tide pool under the fling, for those who stepped over the lip.
  b.floor(lip, lip + 7, L + 3);
  b.ringsH(lip + 1, lip + 4, L + 1);
  b.spring(lip + 6, L + 3, lift >= 6 ? 13 : 11);
  b.spring(lip + 7, L + 3, lift >= 6 ? 13 : 11);
  const reef = L - lift;
  b.floor(lip + 8, lip + 8 + run - 1, reef);
  const shelf = Math.min(reef - 5, L - 12);
  b.platform(lip + 16, lip + 28, shelf);
  prize(b, reward, lip + 25, shelf);
  ringArc(b, lip, L, 6, -10.6, 9, 7);
  return { endX: lip + 8 + run, endRow: reef };
}

export interface TideFlatsOpts {
  /** Number of pools (one hopper each) / rows each one dips (1–3). */
  pools?: number;
  depth?: number;
  /** What hangs over the middle pool, in its hopper's airspace. */
  prize?: Prize;
}

/**
 * tideFlats — where the hoppers live: shallow pools in the sand, one coiled
 * hopper leaping back and forth across each, its arc drawn in rings so the
 * rhythm can be read before it is met. Roll through and they pop; mistime a
 * walk and they sting. The prize hangs over the middle pool where its hopper
 * flies: to jump for it is to jump at the hopper — land on it with jump held
 * and the rebound carries you through. A knot, however gentle its ground.
 * FOOTPRINT: pools*(depth*4 + 8) + 2 columns. NET: level.
 */
export function tideFlats(b: LevelBuilder, x: number, row: number, opts: TideFlatsOpts = {}): MotifEnd {
  const { pools = 3, depth = 2, prize: reward = 'rings10' } = opts;
  let cx = x;
  for (let i = 0; i < pools; i++) {
    b.floor(cx, cx + 1, row);
    const bottom = b.dip(cx + 2, row, depth, 6);
    const h0 = cx + 2 + depth * 2 + 1;
    b.hopper(h0, bottom);
    for (let k = 0; k <= 3; k++) b.rings.push({ x: (h0 + k) * T + 8, y: bottom * T - 22 - 44 * (k === 0 || k === 3 ? 0.35 : 1) });
    if (i === Math.floor(pools / 2)) prize(b, reward, h0 + 2, bottom - 6);
    cx += depth * 4 + 8;
  }
  b.floor(cx, cx + 1, row);
  return { endX: cx + 2, endRow: row };
}

export interface CrumbleSpanOpts {
  /** Planks in the bridge, three columns each / rows down to the channel floor. */
  planks?: number;
  depth?: number;
  /** A crab in the channel. */
  crab?: boolean;
}

/**
 * crumbleSpan — a tide channel cut across the road and bridged by planking
 * that shakes loose behind you: keep running and it is a bridge, hesitate
 * and it is a trapdoor into the channel (rings, a spring at the far wall).
 * FOOTPRINT: 4 + planks*3 + 6 columns. NET: level.
 */
export function crumbleSpan(b: LevelBuilder, x: number, row: number, opts: CrumbleSpanOpts = {}): MotifEnd {
  const { planks = 3, depth = 6, crab = false } = opts;
  const g0 = x + 4;
  const g1 = g0 + planks * 3 - 1;
  b.floor(x, x + 3, row);
  b.carve(g0, row, g1, row + depth - 1);
  b.floor(g0, g1, row + depth);
  for (let i = 0; i < planks; i++) b.crumble(g0 + i * 3, g0 + i * 3 + 2, row);
  b.ringsH(g0, g1, row - 2);
  b.ringsH(g0 + 1, g0 + 3, row + depth - 2);
  if (crab) b.enemy(g0 + Math.floor((planks * 3) / 2), row + depth, 2);
  b.spring(g1 - 1, row + depth, 11);
  b.spring(g1, row + depth, 11);
  b.floor(g1 + 1, g1 + 6, row);
  return { endX: g1 + 7, endRow: row };
}
