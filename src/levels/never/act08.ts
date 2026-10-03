import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, phaseCrossing, signpostFinish, stackedChoice } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, loopHill, undercroft, springCliff, highRoad, lowRoad } from '../sections.ts';
import { cartDrop, hollowHall, loopWalk, onRamp, railLift, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 8 — "Crystal Undertow"
 *
 * The act that turns the biome's roads upside down. Everywhere else the low
 * road is where you end up when something went wrong; here it is where the
 * act LIVES. The surface is the knots — trapped, patrolled, slow — and under
 * every one of them runs a gallery that is none of those things: rings, a
 * grind rail, and three of the act's five crystals. Every shaft in the road
 * is an invitation, and the further in you go the deeper the galleries lie,
 * down to the undertow itself: a cave under the floor of the deepest valley
 * in the biome, four roads stacked over each other.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a slope.
 *   hill      the first shaft: a cave with nothing in it but reward.
 *   knot      a trapped road — and under it a railed gallery and a crystal.
 *                                                            -- checkpoint
 *   valley    floor, ledge, upper ledge.
 *   cart      a track that dives, a crystal on the bail ledge.
 *   knot      a guarded road, a sprung shelf, a trapped gallery beneath.
 *                                                            -- checkpoint
 *   lift      hauled back up by a rail,
 *   loop      and through the loop.
 *   knot      a pit of light.
 *   hill      the second hill, the deep cave, a crystal.     -- checkpoint
 *   knot      a hall with panes of light in its floor (Act 7's toy, the
 *             other way up): let one go dark under you and you are where
 *             this act wants you — the lower hall.
 *   THE UNDERTOW
 *             sixteen rows down at a roll, thrown to the top ledge for a
 *             crystal — or walk the floor, find the shaft in it, and take
 *             the cave under the valley, whose lift throws you to the
 *             ledges anyway.                                 -- checkpoint
 *   home      sprung out of the deep, one last loop, the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the valleys'
 * ledges, the bail ledge and the catwalks stamped below. The low road is the
 * star: two galleries, two caves, a lower hall and the undertow.
 */
export const act08: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 8',
  title: 'Crystal Undertow',
  biome: 2,
  theme: 'crystal',
  width: 742,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24); // 0–29, down to row 28
    const h1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, down: 11, prize: 'rings10', hazards: 0 }); // the invitation
    const k1 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 40, density: 2 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 11, basin: 20, out: 9, crabs: 2, prize: 'shield' });
    c = cartDrop(b, c.endX, c.endRow, { span: 24, drop: 7, pit: 7, crabs: 2, prize: 'crystal', runout: 14 }); // CRYSTAL 1 (bail ledge)
    const k2 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 36 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = railLift(b, c.endX, c.endRow, { rise: 14, span: 20, top: 8 });
    loopWalk(b, c.endX, c.endRow, 6); // from the top of the lift onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 3, roof: 'rings10' });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 });
    const h2 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 12, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (cave), secret 1
    b.checkpoint(c.endX - 4, c.endRow);
    const k4 = c.endX;
    c = hollowHall(b, c.endX, c.endRow, { len: 40, panes: 3, period: 160, crabs: 1, traps: 1, prize: 'shield' }); // a floor of light: here falling through IS the way down
    const deep = c.endX;
    c = valley(b, c.endX, c.endRow, { depth: 16, basin: 14, out: 8, crabs: 0, prize: 'crystal' }); // THE UNDERTOW — CRYSTAL 3 (upper ledge)
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 10 });
    loopWalk(b, c.endX, c.endRow, 6); // from the clifftop onto the last loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    signpostFinish(b, c.endX, c.endRow, { len: 46 });

    /* ============================== HIGH ROAD ============================== */
    onRamp(b, h1 + 6);
    highRoad(b, h1 + 10, h1 + 60, { span: 12, gap: 3, droneEvery: 3, monitors: ['rings10'] }); // over the first hill
    highRoad(b, k1 + 2, k1 + 38, { droneEvery: 2, crumbleEvery: 3 }); // over the trapped road: the other way round it
    onRamp(b, h2 + 6);
    highRoad(b, h2 + 10, k4 + 38, { span: 10, gap: 4, droneEvery: 2, monitors: ['shield'] }); // over the second hill and the hall of light

    /* =============================== LOW ROAD ==============================
     * The star. Each gallery lies under a knot and is what the knot is not:
     * fast, quiet, and paid for in crystals.
     */
    lowRoad(b, k1 + 1, k1 + 32, { shafts: [k1 + 8], crabs: 0, rail: true, prize: 'crystal' }); // CRYSTAL 4 — the railed gallery
    lowRoad(b, k2 + 3, k2 + 33, { shafts: [k2 + 6], crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 2
    // The undertow: a cave under the floor of the deepest valley. Its shaft
    // is in the valley floor; its lift throws you up through the ledges.
    lowRoad(b, deep + 60, deep + 84, { shafts: [deep + 63], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
