import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, quarterPipeBowl, rollersRun, runway, signpostFinish } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, launchValley, loopHill, plunge, undercroft, highRoad, droneBridge, lowRoad } from '../sections.ts';
import { reefBowl, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 5 — "Reefbowl Circuit"
 *
 * The quarter-pipe act. A reef bowl is a bowl the road drops into off its own
 * downhill: arrive at a run and the far lip flings you up to the reef shelf,
 * arrive at a walk and you step over it into the tide pool. The act meets
 * one alone, then learns that the far reef can stand ABOVE the lip — a bowl
 * is the coast's way of climbing — and closes on the deepest, fed by a
 * cliff. Two loops make it a circuit; between them sit the two skate bowls
 * with a pad in the basin, the act's whole allowance of boosters.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill
 *   bowl 1    straight into THE BOWL: alone, level reef, the shelf above.
 *   knot      hopper and two clocked traps, a gallery beneath. -- checkpoint
 *   loop 1    on its hill.
 *   knot      the skate bowl: drop in, the pad, the far lip.    -- checkpoint
 *   valley    the kicker valley its fling comes down in.
 *   bowl 2    the bowl as a climb: its far reef stands four rows over the
 *             lip.
 *   knot      two tide pools on top of it; the crystal hangs in the far arc.
 *   bowl 3    and higher: flung eight rows up the next reef (crystal on the
 *             shelf above it).                                -- checkpoint
 *   headland  the reef's own hill, the sea cave under it (crystal, secret).
 *   loop 2    fed by the headland's far slope.
 *   knot      the second skate bowl,                          -- checkpoint
 *   bowl 4    and the signature: down the cliff, through the deepest bowl,
 *             ten rows up onto the last reef (crystal over the landing).
 *   home      the reef's swells, the signpost.
 *
 * ROADS: the middle road is the bowls. The high road is the reef shelves the
 * flings top out on, joined by catwalks; the low road is the tide pools under
 * each lip, the gallery under the first knot, the headland's cave and the
 * hollow reefs.
 */
export const act05: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 5',
  title: 'Reefbowl Circuit',
  biome: 0,
  theme: 'verdant',
  width: 725,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24, { drop: 4 }); // down to row 28
    c = reefBowl(b, c.endX, c.endRow, { drop: 4, basin: 8, prize: 'rings10' }); // the debut: nothing else in sight
    const k0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 22, density: 2, period: 160 });
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const k1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    const q0 = c.endX;
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 });
    c = runway(b, c.endX, c.endRow, { len: 12, checkpoint: true });
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 8, crabs: 1, prize: 'rings10' });
    const f0 = c.endX;
    c = reefBowl(b, c.endX, c.endRow, { drop: 4, basin: 8, lift: 4, prize: 'shield' }); // the first step up: a reef four rows over the lip
    const p0 = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 2, depth: 2, prize: 'crystal' }); // CRYSTAL 1 (over the far pool)
    c = reefBowl(b, c.endX, c.endRow, { drop: 4, basin: 10, lift: 8, prize: 'crystal' }); // CRYSTAL 2 (reef shelf)
    b.checkpoint(c.endX - 4, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 8, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 1
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'rings10' });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 });
    c = runway(b, c.endX, c.endRow, { len: 12, checkpoint: true });
    const cl = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 4 });
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 12, lift: 10, run: 34, prize: 'crystal' }); // CRYSTAL 4 (last reef's shelf)
    const home = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 2, crown: 6, depth: 2, basin: 6 });
    signpostFinish(b, c.endX, c.endRow, { len: 26 });

    /* ============================== HIGH ROAD ==============================
     * Catwalks between the reef shelves: a fling that lands on one can be
     * carried to the next. The skate bowls throw this high too.
     */
    highRoad(b, k0 - 6, q0 - 16, { droneEvery: 3, monitors: ['rings10'], onRamp: true }); // off the first shelf, over the knot and the loop (its roof is a drop from here)
    highRoad(b, q0 + 18, f0 - 46, { crumbleEvery: 3, crystal: true, monitors: ['rings10', 'shield'], onRamp: true }); // CRYSTAL 5 — where the skate bowl's fling tops out; it runs on over the valley's kicker, so a drop off its end lands past the lip
    highRoad(b, p0 - 8, p0 + 30, { crumbleEvery: 3, droneEvery: 2, onRamp: true }); // off the second bowl's shelf, over the pools
    highRoad(b, h0 + 2, cl - 34, { droneEvery: 2, monitors: ['rings10'], onRamp: true }); // along the reef, over the headland and the second loop
    droneBridge(b, cl - 30, { drones: 3, prize: 'shield', onRamp: true }); // past the second loop
    highRoad(b, home + 2, home + 34, { crumbleEvery: 3, onRamp: true }); // over the swells

    /* =============================== LOW ROAD ==============================
     * The gallery under the first knot, and the caves inside the reefs. The
     * first and the last hold a secret room each.
     */
    lowRoad(b, k0 + 4, k1 - 1, { shafts: [k0 + 6], crabs: 1, prize: 'rings10', secret: true }); // secret 2
    lowRoad(b, p0 - 26, p0 - 3, { shafts: [p0 - 24], crabs: 1, prize: 'rings10' }); // the reefs the bowls throw you onto are hollow
    lowRoad(b, h0 - 26, h0 - 3, { shafts: [h0 - 24], crabs: 0, traps: 1, prize: 'shield' });
    lowRoad(b, home - 27, home - 3, { shafts: [home - 25], crabs: 0, prize: 'shoes', secret: true }); // secret 3 — the cave inside the last reef
  },
};
