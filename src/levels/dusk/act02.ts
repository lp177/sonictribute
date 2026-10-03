import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, rollersRun, runway, secretPocket, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  undercroft,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { crumbleSpan, gliderBay, thermalCliff } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 2 — "Gullwing Causeway"
 *
 * The hang glider's debut, and nothing else is new: a broken causeway of
 * mesas with tide water between them, where every crossing can be flown.
 * The act teaches the wing in two steps — first a bay with a thermal in it,
 * which carries even a strolled wing to the roost, then one at the foot of
 * a long ramp with no thermal at all, where the speed you bring decides
 * which roost you come down on. Hazards stay at act-1 levels.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips into the biome's longest opening slope,
 *   leap      and that slope is what clears the first tide pool.
 *   knot      a guarded road under a sprung shelf.            -- checkpoint
 *   headland  a hill with the sea cave under it (crystal, secret room);
 *   bay 1     its far slope runs out at THE WING. Off the lip with jump
 *             held, up the thermal, onto the roost (crystal). Without it:
 *             the bay floor, a sandbar, a climb.              -- checkpoint
 *   knot      planking over a channel.
 *   valley    the kicker valley (shield on the upper ledge),
 *   cliff     and the sea wind up the face beyond it (crystal on the perch);
 *             a pocket in the clifftop.
 *   bay 2     The causeway crossing — the signature: twelve rows of ramp
 *             down the cliff's back, the lip, the wide bay; no thermal, two
 *             roosts. A run lands on the first; only a ROLL of the whole
 *             ramp is thrown high enough for the upper one (crystal).
 *                                                            -- checkpoint
 *   knot      one clocked trap, a gallery beneath (secret room).
 *   home      the loop on its hill (crystal on the roof), two swells, the
 *             long slope down, the signpost.
 *
 * ROADS: the middle road is the mesas and the bay floors. The high road is
 * the gulls' — both roosts, the catwalks that run on from them, the cliff
 * perch. The low road is the headland's cave and the gallery under the
 * last knot.
 */
export const act02: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 2',
  title: 'Gullwing Causeway',
  biome: 0,
  theme: 'verdant',
  width: 661,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 6 }); // down to row 28
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2 });
    const k1 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 24 });
    b.checkpoint(c.endX - 2, c.endRow);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 8, prize: 'crystal', secret: true }); // CRYSTAL 1 (cave), secret 1
    c = gliderBay(b, c.endX, c.endRow, { width: 48, depth: 10, crabs: 1, prize: 'crystal' }); // CRYSTAL 2 (roost)
    const shore1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 4 });
    const v0 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 6, crabs: 1, prize: 'shield' });
    c = thermalCliff(b, c.endX, c.endRow, { rise: 12, top: 4, prize: 'crystal' }); // CRYSTAL 3 (perch)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 2
    c = gliderBay(b, c.endX, c.endRow, { feed: 12, width: 56, depth: 12, out: 8, crabs: 2, thermal: false, prize: 'rings10', upper: 'crystal' }); // CRYSTAL 4 (upper roost)
    const shore2 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true });
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 22, density: 1 });
    const g1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'crystal' }); // CRYSTAL 5 (loop roof)
    const l1 = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 4, depth: 2, basin: 6 });
    c = runway(b, c.endX, c.endRow, { drop: 5, len: 14 });
    signpostFinish(b, c.endX, c.endRow, { len: 28 });

    /* ============================== HIGH ROAD ==============================
     * The roosts are where a wing sets you down; these catwalks are what it
     * was for. Walk off any ledge with jump held and the next gap is flown.
     */
    highRoad(b, k1 + 26, hill + 30, { crumbleEvery: 4, monitors: ['rings10'], onRamp: true }); // off the knot's shelf, up the headland
    droneBridge(b, hill + 34, { drones: 3, prize: 'shield', onRamp: true }); // and off its crown
    highRoad(b, shore1 - 2, v0 + 4, { monitors: ['rings10'], onRamp: true }); // on from the first roost, to the valley's brink (a drop from here lands on its downhill, never on its kicker)
    highRoad(b, shore2 + 2, l1 + 40, { droneEvery: 3, monitors: ['rings10'], onRamp: true }); // on from the bay, over the loop: its roof is a drop from here

    /* =============================== LOW ROAD ==============================
     * The gallery under the last knot: in by the shaft at its head, out by
     * the springs past its end. Holds the third secret.
     */
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 6], crabs: 0, prize: 'rings10', secret: true }); // secret 3
  },
};
