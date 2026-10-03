import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, secretPocket, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  tubeShot,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { STORY_HOUR_OF_DUSK } from '../../game/story.ts';

/**
 * DUSKMERE COAST — ACT 1 — "Tidebreak Run"
 *
 * The first level anyone plays, so it teaches the one thing the whole game
 * runs on: the ground gives you speed, and speed decides which road you are
 * on. No boss, no boosters — a golden-hour coast that rises and falls.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   a safe apron tips downhill: slopes give speed.
 *   valley 1  the first fork — walk it and you take the valley floor, run it
 *             and the kicker throws you to the ledge, roll it for the prize.
 *   knot      a ground road under a spring-fed shelf.
 *   headland  a hill with the sea cave under it (crystal, secret room).
 *   loop      fed by the hill's far slope; a shield on its roof.
 *   leap      a long jump over the tide pool.           -- checkpoint
 *   cliff     sprung up to the clifftop,
 *   knot      past the pendulum gauntlet,
 *   plunge    and straight back down it into valley 2 (crystal up top).
 *   terraces  a jump-up climb.                           -- checkpoint
 *   headland 2 and the tube that fires you out over the bay to the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the ledges over the
 * valleys plus the catwalks stamped below; the low road is the caves under
 * the two headlands and the gallery under the gauntlet.
 */
export const act01: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 1',
  title: 'Tidebreak Run',
  biome: 0,
  theme: 'verdant',
  width: 616,
  height: WORLD_ROWS,
  intro: STORY_HOUR_OF_DUSK,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // 0–29, down to row 26
    c = launchValley(b, c.endX, c.endRow, { depth: 10, crabs: 1, prize: 'rings10' }); // row 28
    const k1 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 22 }); // the first knot: a guarded road, a sprung shelf
    b.checkpoint(c.endX - 2, c.endRow);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, prize: 'crystal', secret: true }); // CRYSTAL 1 (cave), secret 1
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, roof: 'shield' });
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2 });
    const l1 = c.endX;
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 6 });
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 1 });
    b.swingBall(g0 + 12, c.endRow - 11, 8, 150, 0); // Duskmere's pendulum: time the run under it
    const g1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 2 });
    c = launchValley(b, c.endX, c.endRow, { depth: 12, crabs: 2, prize: 'crystal' }); // CRYSTAL 2 (upper ledge)
    const v2 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4 });
    b.checkpoint(c.endX - 3, c.endRow);
    c = secretPocket(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 3, secret 2
    const h2 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, prize: 'shoes', hazards: 2 });
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 40 });
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ==============================
     * Catwalks that follow the ground, so a player who earned the height can
     * keep it — each stretch with stepping ledges up to it, so it is a choice
     * and not a rumour. Falling off any of them lands on the middle road.
     */
    highRoad(b, k1 + 2, hill, { crumbleEvery: 3, monitors: ['rings10'] }); // over the first knot
    c = droneBridge(b, hill + 30, { drones: 3, prize: 'rings10', onRamp: true }); // off the headland's crown
    b.crystal(c.endX - 3, c.endRow - 3); // CRYSTAL 4 — past the drone bridge
    highRoad(b, l0 + 4, l1 - 6, { droneEvery: 3, onRamp: true }); // over the loop (its roof prize is a drop from here) and the leap
    highRoad(b, g0 + 2, g1 + 6, { droneEvery: 2, monitors: ['shield'], onRamp: true }); // over the gauntlet
    highRoad(b, v2 + 14, h2 + 30, { crumbleEvery: 2, crystal: true, monitors: ['rings10'], onRamp: true }); // CRYSTAL 5

    /* =============================== LOW ROAD ==============================
     * The gallery under the clifftop gauntlet: drop in through the shaft at
     * its head, spring out past its end. Holds the third secret.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'rings10', secret: true });
  },
};
