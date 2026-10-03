import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { STORY_HOUR_OF_NEVER } from '../../game/story.ts';
import { hazardGauntlet, rollersRun, secretPocket, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  tubeShot,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { railDescent, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 1 — "Glimmerdeep Gate"
 *
 * The way in. The Underwhen is a mine being drilled toward its own bottom,
 * and its opener is the long walk down to the gate: wide, shallow, every
 * hazard alone and in plain sight. It teaches the biome's one new verb — the
 * grind rail — in the first minute, with a soft landing whichever way it goes,
 * and its centrepiece sends you THROUGH the gate rather than up to it.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron that tips downhill to a lip.
 *   rail      the first fork, and the lesson: run off the lip and you grind;
 *             jump it for the catwalk; let go for the chasm floor.
 *   knot      one pop-up trap, one ring line over it.        -- checkpoint
 *   glimmer   the deep valley: walk the floor, run to the ledge, roll for
 *             the crystal that has been glinting over it since the lip.
 *   knot      a guarded road under a sprung shelf, a gallery under both.
 *                                                            -- checkpoint
 *   hill      a hill with a crystal cave under it, its far slope feeding
 *   loop      the loop, a shield on its roof.
 *   steps     the gate's own stair: three terraces up.       -- checkpoint
 *   THE GATE  the bluff across the road, and the tube through it: fired out
 *             over the dark, a crystal left behind on top for the high road.
 *   pocket    knot: a shaft in the landing strip, a shield under it.
 *   leap      a short plunge feeds the long jump.            -- checkpoint
 *   cliff     sprung up,
 *   rail 2    and the lesson again at full length: fifty columns of rail,
 *             a crab under it this time.
 *   home      the long swells, the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the catwalk over
 * each rail, the valley's ledges and the ledges stamped below, which run on
 * to the top of the gate; the low road is the chasm floors, the gallery under
 * the second knot and the cave under the hill.
 */
export const act01: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 1',
  title: 'Glimmerdeep Gate',
  biome: 2,
  theme: 'crystal',
  width: 674,
  height: WORLD_ROWS,
  intro: STORY_HOUR_OF_NEVER,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // 0–29, down to row 26
    c = railDescent(b, c.endX, c.endRow, { span: 28, drop: 7, pit: 4, crabs: 0, runout: 12 }); // the lesson: nothing on the floor but rings
    const k1 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 1 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 11, basin: 14, out: 10, crabs: 1, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    const k2 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 28 });
    b.checkpoint(c.endX - 2, c.endRow);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 9, prize: 'crystal', secret: true }); // CRYSTAL 2 (cave), secret 1
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 9, roof: 'shield' });
    const s0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 3, tread: 6 });
    b.checkpoint(c.endX - 3, c.endRow);
    const gate = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 10, runout: 36, top: 'crystal' }); // CRYSTAL 3 (on the gate)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 2 });
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2 });
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 10 });
    const r2 = c.endX;
    c = railDescent(b, c.endX, c.endRow, { span: 50, drop: 11, pit: 6, crabs: 1, prize: 'rings10', runout: 14 }); // the lesson, at full length
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 6, depth: 2, basin: 6 });
    signpostFinish(b, c.endX, c.endRow, { len: 34 });

    /* ============================== HIGH ROAD ==============================
     * Ledges that follow the ground, so height earned on the catwalk or the
     * valley's ledges can be kept. Falling off any of them is the middle road.
     */
    highRoad(b, k1 - 6, k1 + 24, { monitors: ['rings10'] }); // off the rail's landing, over the first knot
    highRoad(b, k2 + 2, hill + 4, { lift: 14, droneEvery: 2 }); // over the sprung shelf
    highRoad(b, hill + 8, l0 - 6, { droneEvery: 2, monitors: ['rings10'] }); // over the hill, its cave two roads below
    highRoad(b, l0 + 2, s0 - 4, { lift: 14, crystal: true, droneEvery: 3 }); // CRYSTAL 4 — over the loop; its roof is a drop from here
    highRoad(b, s0 + 4, gate + 2, { lift: 8, monitors: ['shield'] }); // up the stair and onto the gate
    highRoad(b, r2 + 60, r2 + 110, { lift: 5, droneEvery: 2 }); // low over the home straight: a jump up from the swells

    /* =============================== LOW ROAD ==============================
     * The gallery under the second knot: in by the shaft at its head, out by
     * the springs at its end.
     */
    lowRoad(b, k2 + 1, k2 + 26, { shafts: [k2 + 4], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
