import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, runway, signpostFinish, stackedChoice, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
  lowRoad,
  ringArc,
} from '../sections.ts';
import { lightBridge, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 755;

/**
 * NOON TOMORROW — ACT 4 — "Static Signal Yards"
 *
 * The maintenance district: flat yards where everything runs on a clock —
 * awning spikes, pop-up teeth, a crane hook, a cart on its buffer — joined by
 * the cuttings the trains used. The yards are the knots; the cuttings are the
 * speed. The silhouette is a W cut square: two deep yards, a plateau between.
 *
 * BEATS:
 *   opening    a safe apron tips downhill.
 *   cutting 1  a short ribbon across the first cutting.
 *   yard       the signal gantry: awning spikes that fall as you pass.
 *                                                               -- checkpoint
 *   embankment over the hill or through the vault (crystal), and the loop its
 *              far slope feeds.
 *   yard       the buffer stop: ride the cart and bail, or pay.
 *   lift       sprung up to the plateau.                        -- checkpoint
 *   yard       the trap line, a hopper at the end of it (a service gallery
 *              under it, a bridge of drones over it),
 *   bluff      and the tunnel through the signal bluff.
 *   yard       the signal bridge: hard light on the fast clock over a dip.
 *   cutting 2  THE DROP: twelve rows down the cutting wall and straight off a
 *              ramp — a rolled descent carries the sixteen-tile gap without a
 *              jump, and its arc passes through the crystal.    -- checkpoint
 *   yard       two decks in the deep yard (a gallery under them),
 *   heap       the slag heap, hollow underneath,
 *   lift       and sprung back out,
 *   sheds      the roofs of the engine sheds, a street between them,
 *   home       and the last cutting: a deep valley that never climbs back, and
 *              a straight to the signpost.
 *
 * ROADS: the middle road is the yards and cuttings. The high road is the
 * gantry catwalks and a bridge of drones over the plateau; the low road is
 * the galleries under the yards, the vault and the street.
 */
export const act04: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 4',
  title: 'Static Signal Yards',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // → row 26
    c = skyRail(b, c.endX, c.endRow, { drop: 4, len: 52, depth: 10, hoppers: 2, prize: 'shield', runout: 12 }); // → row 30
    const y1 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 26, count: 5 });
    b.checkpoint(c.endX - 2, c.endRow);
    const e0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 12, prize: 'crystal', hazards: 2 }); // CRYSTAL 1 (vault) → row 36
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 4, roof: 'rings10' }); // → row 38
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 });
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 12 }); // → row 24, the plateau (a long top: the spring's flight lands on it, not in the traps)
    b.checkpoint(c.endX - 2, c.endRow);
    const p0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 2, period: 150 });
    c = roofedTube(b, c.endX, c.endRow, { drop: 8, runout: 34, top: 'rings10' }); // → row 32
    const p1 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 16, period: 150, hazards: 2, prize: 'shield' }); // the signal bridge
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 9 }); // → row 44
    const jump = c.endX;
    c = longJump(b, c.endX, c.endRow, { gap: 16, fall: 0 });
    ringArc(b, jump + 12, c.endRow - 2, 6, -4.9, 8, 5); // the rolled line: it passes through the crystal
    b.crystal(jump + 20, c.endRow - 6); // CRYSTAL 2
    b.checkpoint(c.endX - 3, c.endRow);
    const d0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 24, crystal: true }); // CRYSTAL 3 (upper deck)
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 10, down: 8, prize: 'rings10', hazards: 1 }); // the slag heap
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 6 }); // → row 30
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, 2, -3, 1, -2, 2], width: 6, alley: 3, crabs: 2, room: 'crystal', secret: true }); // CRYSTAL 4, secret 1
    const r1 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 14, out: 4, crabs: 2, prize: 'shoes' }); // → row 40
    c = runway(b, c.endX, c.endRow, { len: 24 });
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act04 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, y1 + 2, y1 + 24, { lift: 6, monitors: ['rings10'] }); // the gantry catwalk: a jump over the awning's own roof
    b.spring(y1 - 2, 30, 11);
    highRoad(b, e0 + 4, e0 + 40, { crumbleEvery: 3 }); // and on over the embankment
    highRoad(b, l0 + 34, l0 + 60, { droneEvery: 2 }); // over the buffer stop
    c = droneBridge(b, p0 + 2, { drones: 4, lift: 8, prize: 'crystal' }); // CRYSTAL 5 — over the trap line, stone by stone
    b.spring(p0 - 4, 24, 11);
    highRoad(b, p1 - 4, p1 + 44, { monitors: ['shield'] }); // over the signal bridge, clear of the tunnel's ring cloud
    highRoad(b, h0 + 20, h0 + 44, { crumbleEvery: 2 }); // off the heap's crown
    b.spring(h0 + 23, 36, 11);
    highRoad(b, r0 - 2, r1 + 4, { lift: 9, droneEvery: 3, monitors: ['rings10'] }); // over the sheds
    b.spring(r0 - 3, 30, 10);

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, p0 + 1, p0 + 18, { shafts: [p0 + 2], crabs: 1, prize: 'rings10', secret: true }); // secret 2 — under the trap line
    lowRoad(b, d0 + 1, d0 + 22, { shafts: [d0 + 4], depth: 8, crabs: 1, traps: 2, prize: 'rings10', secret: true }); // secret 3
  },
};
