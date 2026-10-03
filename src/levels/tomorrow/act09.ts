import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, phaseCrossing, signpostFinish, stalactiteGallery } from '../motifs.ts';
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
} from '../sections.ts';
import { lightStair, ribbon, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 710;

/**
 * NOON TOMORROW — ACT 9 — "Skyline Curfew"
 *
 * The hardest signpost act in the game, and the one where the high road is
 * the star. After curfew the streets belong to the traps: every knot on the
 * ground runs at full density on the fastest clocks. The way through is over
 * them — one catwalk from the first valley's ledge to the last tunnel, made
 * of crumbling ledges, drones to bounce on, a stair of light and three rails.
 * Hard here means hard to STAY UP: every fall from the skyline lands on the
 * ground road, which always goes on, and never on anything that bites at
 * once.
 *
 * BEATS:
 *   opening    a safe apron tips downhill.
 *   valley     roll it: the upper ledge's rail climbs to the skyline.
 *   knot       the first roofs, guarded.                        -- checkpoint
 *   drop       a plunge and the leap it feeds,
 *   lift       then a spring — or the stair of light beside it.
 *   knot       the full gauntlet on the fast clock.             -- checkpoint
 *   hill       over it or through its vault (crystal),
 *   knot       the awning: five spikes that fall as you pass.
 *   ribbon     the sky rail across the deep valley — and, far over it, the
 *              skyline's own express, which goes UP.
 *   lift       sprung to the far tower.                         -- checkpoint
 *   knot       the narrow roofs, the tightest hops in the biome,
 *   arch       the loop, with a bridge of drones over it,
 *   knot       hard light on the 2-second clock,
 *   drop       a plunge into the last yard,
 *   knot       and the cart at the bottom of it.                -- checkpoint
 *   home       sprung up one last time, and the tunnel out to the signpost.
 *
 * ROADS: the middle road is the ground and its knots. The high road is the
 * skyline — the longest in the campaign; the low road is the valley floors,
 * the two streets, the gallery under the gauntlet and the vault.
 */
export const act09: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 9',
  title: 'Skyline Curfew',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // → row 26
    const lip = c.endX + 43; // first column past the valley's kicker
    c = launchValley(b, c.endX, c.endRow, { depth: 12, crabs: 2, prize: 'shield' }); // → row 28
    const ra0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -2, 2, -3, 3], depth: 9, crabs: 2, droneEvery: 2, room: 'rings10', secret: true }); // secret 1
    b.checkpoint(c.endX - 2, c.endRow);
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 4 }); // → row 40
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 0, pit: 'crab' });
    const f1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 12 }); // → row 26
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 22, density: 3, period: 130 });
    const g1 = c.endX;
    b.checkpoint(c.endX - 1, c.endRow);
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 10, prize: 'crystal', hazards: 2 }); // CRYSTAL 1 (vault) → row 30
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 });
    const st1 = c.endX;
    c = skyRail(b, c.endX, c.endRow, { drop: 10, len: 56, depth: 16, hoppers: 3, prize: 'rings10', runout: 10 }); // → row 40
    const f2 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 6 }); // → row 26
    b.checkpoint(c.endX - 2, c.endRow);
    const rb0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -3, 2, -2, 3, 0], width: 5, depth: 10, crabs: 3, droneEvery: 3, room: 'crystal', secret: true }); // CRYSTAL 2, secret 2
    const rb1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'rings10' }); // → row 30
    const ph = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 });
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 8 }); // → row 40
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 });
    const cart1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // → row 28
    c = roofedTube(b, c.endX, c.endRow, { drop: 8, runout: 32, top: 'shield' }); // → row 36
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act09 chain ends at ${c.endX}, not ${W}`);

    /* ============================== THE SKYLINE ============================
     * One high road, west to east. Stations are solid; most of what joins
     * them is not.
     */
    // The valley's upper ledge (a rolled descent only) is the first station.
    b.platform(ra0 + 2, ra0 + 9, 19);
    b.crystal(ra0 + 6, 17); // CRYSTAL 3
    ribbon(b, lip + 37, 27, ra0 + 2, 19);
    highRoad(b, ra0 + 13, f1 - 18, { lift: 9, crumbleEvery: 2, droneEvery: 2, monitors: ['rings10'] }); // over the roofs, the plunge and the leap
    b.spring(ra0 + 1, 28, 10); // the walkers' way up, off the first roof
    // Light beside the lift, to a ledge seven rows over the tower.
    let s = lightStair(b, f1 - 16, 40, { steps: 6, period: 140, ledge: 6, prize: 'none' }); // to row 19
    highRoad(b, s.endX + 3, st1 - 2, { lift: 9, crumbleEvery: 3, droneEvery: 2, monitors: ['shield', 'rings10'] }); // over the gauntlet, the hill and the awning
    // The express: from the awning's far end, over the whole valley, UP to
    // the far tower.
    b.platform(st1, st1 + 5, 19);
    b.platform(f2 + 10, f2 + 16, 15);
    ribbon(b, st1 + 6, 19, f2 + 10, 15);
    s = droneBridge(b, rb1 + 2, { drones: 4, lift: 12, prize: 'crystal' }); // CRYSTAL 4 — over the loop, stone by stone
    highRoad(b, rb0 + 6, rb1 + 1, { lift: 9, crumbleEvery: 2, droneEvery: 2, crystal: true }); // CRYSTAL 5 — over the narrow roofs
    highRoad(b, ph + 2, cart1 - 4, { lift: 10, crumbleEvery: 3, droneEvery: 3, monitors: ['rings10'] }); // and down with the last plunge

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 2, prize: 'rings10', secret: true }); // secret 3
  },
};
