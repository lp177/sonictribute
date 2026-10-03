import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, phaseCrossing, railCascade, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { lightStair, ribbon, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 712;

/**
 * NOON TOMORROW — ACT 8 — "Vertigo Concourse"
 *
 * The most vertical act in the game, and the one where the city's toys stop
 * taking turns. The road swings between the roofline and the foundations
 * four times: each fall is as long as the world allows, each way back up is
 * a spring, and on the way the gimmicks arrive stacked — light beside a
 * spring cliff, a catwalk that IS the awning's roof, a rail down a cliff
 * face, a ribbon into a cascade.
 *
 * BEATS:
 *   opening    a safe apron on the roofline.
 *   fall 1     a sixteen-row valley that barely climbs back,
 *   knot       and a cart waiting at the bottom of it.
 *   lift       sprung up fourteen rows — or up the stair of light beside the
 *              spring.                                          -- checkpoint
 *   knot       the awning on the tower top: run under its spikes, or walk its
 *              roof.
 *   fall 2     THE DROP: twenty rows down the tower face. The roof's rail
 *              goes down it too, steeper than any ribbon before,
 *   arch       and both run out through the loop at the bottom.
 *   lift       two springs, one over the other, back to the summit.
 *                                                               -- checkpoint
 *   knot       the summit roofs, their catwalk crumbling.
 *   fall 3     the long steep ribbon off the summit (a crystal over it),
 *   knot       straight into a cascade of rails.
 *   lift       sprung up again.                                 -- checkpoint
 *   knot       the full gauntlet, a bridge of drones over it,
 *   fall 4     off the plateau,
 *   knot       hard light over the pit at the bottom,
 *   lift       and up once more;
 *   home       then over the last hill (a crystal vault under it) and down
 *              its long far slope into the tunnel out.
 *
 * ROADS: the middle road is the ground. The high road is hard light, the
 * awning's roof, rails and the catwalks they join; the low road is the valley
 * floors, the street under the summit, the gallery under the gauntlet and the
 * vault.
 */
export const act08: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 8',
  title: 'Vertigo Concourse',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20); // → row 24
    c = launchValley(b, c.endX, c.endRow, { depth: 16, out: 4, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge) → row 36
    const v1 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 });
    const t1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 8 }); // → row 22
    b.checkpoint(c.endX - 3, c.endRow);
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 });
    const drop = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 20, runout: 8 }); // → row 42
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 0, roof: 'rings10' }); // → row 46
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 6 }); // → row 32
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 6 }); // → row 20, the summit
    b.checkpoint(c.endX - 2, c.endRow);
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, 2, -1, 2, -2, 1], depth: 10, crabs: 2, droneEvery: 2, room: 'rings10', secret: true }); // secret 1 → row 22
    const r1 = c.endX;
    c = skyRail(b, c.endX, c.endRow, { drop: 14, len: 60, depth: 22, hoppers: 2, prize: 'shield', crystal: true, runout: 12 }); // CRYSTAL 2 → row 36
    const k0 = c.endX;
    c = railCascade(b, c.endX, c.endRow, { steps: 2 }); // → row 42
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 12 }); // → row 28
    b.checkpoint(c.endX - 3, c.endRow);
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 140 });
    const g1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 14, runout: 8 }); // → row 42
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 130 });
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 6 }); // → row 28
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 14, down: 14, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (vault), secret 2 → row 34
    c = roofedTube(b, c.endX, c.endRow, { drop: 8, runout: 36, top: 'shield' }); // → row 42
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act08 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ==============================
     * Light, then the awning's own roof, then rail: the stair beside the
     * first lift arrives four rows over the tower top, a hop from the slab
     * the spikes hang under, and the slab's far end is the station for the
     * rail down the tower face.
     */
    highRoad(b, v1 - 8, t1 - 22, { lift: 9 }); // over the cart, off the valley's ledge
    lightStair(b, t1 - 20, 36, { steps: 5, period: 150, ledge: 6, prize: 'none' }); // to row 18
    b.crystal(drop - 8, 13); // CRYSTAL 4 — on the awning's roof
    b.platform(drop - 1, drop - 1, 15); // the roof's last plank: the rail leaves from it
    ribbon(b, drop, 15, drop + 26, 42);
    highRoad(b, l0 + 2, l0 + 14); // a deck either side of the loop's roof, level with it
    highRoad(b, l0 + 27, l0 + 36);
    b.spring(l0 + 3, 42, 10);
    highRoad(b, r0 + 2, r1 + 4, { lift: 9, span: 10, crumbleEvery: 4, droneEvery: 3, monitors: ['rings10', 'shield'] }); // over the summit roofs
    b.spring(r0 - 3, 20, 10);
    highRoad(b, k0 - 10, g0 - 24, { droneEvery: 2 }); // over the ribbon's bank and the cascade, short of the lift's ring column
    b.spring(k0 - 9, 36, 11);
    c = droneBridge(b, g0, { drones: 4, prize: 'rings10' }); // over the gauntlet
    b.spring(g0 - 5, 28, 11);
    highRoad(b, g1 + 2, h0 - 16, { droneEvery: 3 }); // on down fall 4, over the hard light
    highRoad(b, h0 + 2, h0 + 44, { span: 11, gap: 3, droneEvery: 2, monitors: ['rings10'] }); // over the last hill, ending over its far slope: a fall from here must not land on the tunnel's kicker
    b.spring(h0 + 5, 28, 11);

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 2, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
