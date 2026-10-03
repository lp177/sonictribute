import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { canopyRun, cartCanyon, hazardGauntlet, railCascade, signpostFinish, stalactiteGallery } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, loopHill, undercroft, highRoad, lowRoad } from '../sections.ts';
import { alcove, loopWalk, onRamp, railDescent, railLift, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 6 — "The Long Grind"
 *
 * The ride act. A rail carries you at nine pixels a frame whichever way it
 * tilts, so here the rails are not a toy on the road: they ARE the road.
 * They take you down, they haul you back up, one hangs off the valley's top
 * ledge and one runs in the dark under the trapped workings. The act starts
 * higher than any other in the biome and ends at its floor, and the last
 * third of it is a single line: three rails end to end, each longer than the
 * last, twelve columns of ground between them to catch your breath.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron at the top of the mine.
 *   knot      a staircase of three short rails: ride them or jump them —
 *             or jump UP at its head, to the catwalk that stays level while
 *             the stair falls away, and the crystal at its far end.
 *   rail      the first long one, across its chasm.          -- checkpoint
 *   knot      the trapped workings — and under them a gallery with a rail
 *             of its own, the quiet way through.
 *   lift      a rail that runs UP: the road walks onto it and is hauled to
 *             the clifftop.
 *   valley    floor, ledge, crystal ledge — and off the end of the top
 *             ledge, a rail out over the climb.              -- checkpoint
 *   knot      a gallery of hanging spikes, a shelf over its roof.
 *   loop      through the loop,
 *   hill      and over the hill, a crystal cave beneath.     -- checkpoint
 *   rail      down again, crabs under the line,
 *   knot      a cart, a canyon, a buffer,
 *   lift      and the second haul, to the very top.          -- checkpoint
 *   THE LONG GRIND
 *             thirty columns of rail; forty-two; fifty-eight. An alcove
 *             under the second lip (step off it), a crystal over the third
 *             rail (jump at it).
 *   home      the floor of the mine, the signpost.
 *
 * ROADS: the middle road is the ground and the rails. The high road is the
 * catwalk over each rail's first half, the valley's ledges and the ledges
 * stamped below; the low road is every chasm floor, the railed gallery and
 * the cave under the hill.
 */
export const act06: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 6',
  title: 'The Long Grind',
  biome: 2,
  theme: 'crystal',
  width: 747,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20, { drop: 3 }); // 0–27, down to row 23
    const k0 = c.endX;
    const shelf = c.endRow - 5; // a jump above the top of the rail stair
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 5, span: 9, dropEach: 2 });
    c = railDescent(b, c.endX, c.endRow, { span: 36, drop: 9, pit: 5, crabs: 1, prize: 'rings10', runout: 12 });
    b.checkpoint(c.endX - 3, c.endRow);
    const k1 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 44, density: 2 });
    c = railLift(b, c.endX, c.endRow, { rise: 16, span: 24, top: 8 });
    const v = c.endX;
    const rim = c.endRow;
    c = valley(b, c.endX, c.endRow, { depth: 12, out: 10, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    b.rail(v + 80, rim + 1, v + 95, rim + 2); // off the end of the top ledge, out over the climb, down to the exit
    b.checkpoint(c.endX - 2, c.endRow);
    canopyRun(b, c.endX + 4, c.endRow - 12, { len: 10 }); // a shelf over the gallery's roof: three roads here, with the spikes between two of them
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 });
    loopWalk(b, c.endX, c.endRow, 6); // off the gallery's doorstep onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 14, down: 9, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (cave), secret 1
    b.checkpoint(c.endX - 4, c.endRow);
    c = railDescent(b, c.endX, c.endRow, { span: 34, drop: 10, pit: 6, crabs: 2, prize: 'rings10', runout: 12 }); // down to the cart level
    const k3 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 });
    c = railLift(b, c.endX, c.endRow, { rise: 16, span: 22, top: 8 }); // and hauled back to the top of the mine
    b.checkpoint(c.endX - 3, c.endRow);
    // THE LONG GRIND: each rail's landing is the next one's lip.
    c = railDescent(b, c.endX, c.endRow, { span: 30, drop: 7, pit: 5, crabs: 0, prize: 'rings10', runout: 6 });
    const r2 = c.endX;
    c = railDescent(b, c.endX, c.endRow, { span: 42, drop: 8, pit: 6, crabs: 1, prize: 'shield', runout: 6 });
    alcove(b, r2 + 1, r2 + 5, c.endRow + 6); // secret 2: step off the second lip instead of running it
    b.crystal(r2 + 2, c.endRow + 4); // CRYSTAL 3
    c = railDescent(b, c.endX, c.endRow, { span: 58, drop: 9, pit: 5, crabs: 2, prize: 'crystal', runout: 16 }); // CRYSTAL 4 (catwalk)
    signpostFinish(b, c.endX, c.endRow, { len: 30 });

    /* ============================== HIGH ROAD ============================== */
    canopyRun(b, k0, shelf, { len: 47, crystal: true }); // CRYSTAL 5 — level over the rail stair, a jump up from its top shelf: the ground steps away under it
    highRoad(b, k1 + 11, k1 + 44, { span: 14, gap: 2, droneEvery: 2, monitors: ['rings10'] }); // over the trapped workings
    highRoad(b, k3 + 2, k3 + 34, { droneEvery: 2, monitors: ['shield'] }); // over the cart canyon and the foot of the lift
    onRamp(b, hill + 4);
    highRoad(b, hill + 8, hill + 58, { span: 12, gap: 3, droneEvery: 2, monitors: ['rings10'] }); // over the hill

    /* =============================== LOW ROAD ==============================
     * The gallery under the workings carries a rail of its own: the low road
     * here is the FAST one.
     */
    lowRoad(b, k1 + 1, k1 + 36, { shafts: [k1 + 8], crabs: 0, rail: true, prize: 'rings10', secret: true }); // secret 3
  },
};
