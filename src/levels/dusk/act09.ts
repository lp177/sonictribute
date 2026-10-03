import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { glideRun, hazardGauntlet, rollersRun, runway, secretPocket, signpostFinish, stackedChoice } from '../motifs.ts';
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
  groundRow,
} from '../sections.ts';
import { crumbleSpan, reefBowl, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 9 — "Riptide Boardwalk"
 *
 * The high road's act. Below, the ground is cut by rip channels — a cliff, a
 * tide pool too wide to jump cold, a kicker valley, rotten decking, the
 * Riptide itself — and it is the meanest ground in the biome so far. Above
 * it, from the pier head to the far side of the Riptide, runs the
 * boardwalk: long planks that follow the ground, every third one rotten,
 * drones in the gaps to be used as stepping stones, two drone bridges where
 * the planks give out. Stay up and the act is a different, faster one — and
 * at its end the boardwalk hands you the wing and the widest rip to fly.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill,
 *   plunge    over the cliff,
 *   leap      and across the first rip, if you kept the speed: the first
 *             fork, with no boardwalk over it yet.
 *   knot      the pier head: a guarded road, and the sprung shelf that is
 *             the way up to the planks.                       -- checkpoint
 *   valley    the kicker valley; its ledges are the boardwalk here.
 *   knot      rotten decking over a channel with a crab in it.
 *   sandbar   a hill with the sea cave under it (crystal, secret room).
 *   knot      hopper, clocked traps, a pendulum; a gallery beneath
 *             (crystal, secret room).                         -- checkpoint
 *   bowl      the reef bowl: its fling tops out ON the boardwalk.
 *   loop      on its hill, under the planks.
 *   knot      two tide pools, two hoppers.
 *   riptide   the signature, three ways: the valley floor and its crabs;
 *             the kicker and its ledges; or, from the boardwalk's last
 *             perch, the wing and a full thermal — held through it, the
 *             wing tops out a screen over the water, where the crystal
 *             hangs, and comes down on the pier over the far bank.
 *                                                            -- checkpoint
 *   home      sprung up the far bank; a pocket, the last loop on its hill,
 *             swells, the signpost.
 *
 * ROADS: the high road is the star — three of the five crystals ride it. The
 * middle road is the rips; the low road is the pools and channel floors, the
 * sandbar's cave and the gallery under the last trap knot.
 */
export const act09: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 9',
  title: 'Riptide Boardwalk',
  biome: 0,
  theme: 'verdant',
  width: 703,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24, { drop: 4 }); // down to row 28
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 4 });
    c = longJump(b, c.endX, c.endRow, { gap: 16, fall: 2, pit: 'crab' });
    const k1 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 22 }); // the pier head: its sprung shelf is the way up
    b.checkpoint(c.endX - 2, c.endRow);
    const v1 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 8, crabs: 2, prize: 'rings10' });
    const deck = c.endX;
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 5, crab: true });
    const bar = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, down: 8, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 1 (cave), secret 1
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 2, period: 140 });
    b.swingBall(g0 + 22, c.endRow - 11, 8, 140, 30);
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const g1 = c.endX;
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 8, lift: 6, prize: 'shield' });
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 12 }); // a loop's landing is ground and rings
    c = tideFlats(b, c.endX, c.endRow, { pools: 2, depth: 2, prize: 'rings10' });
    const rt = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 12, out: 8, crabs: 2, prize: 'shield' });
    const bank = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 8, top: 4 });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 3
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 2, crown: 6, depth: 2, basin: 6 });
    signpostFinish(b, c.endX, c.endRow, { len: 28 });

    /* ============================= THE BOARDWALK ===========================
     * One road, laid in stretches so the set pieces show through it: long
     * planks, short gaps, every third plank rotten. It follows the ground a
     * jump at a time; where the ground falls away faster than a jump, a
     * drone bridge carries it across.
     */
    const planks = { span: 11, gap: 3, crumbleEvery: 3 };
    highRoad(b, k1 + 2, v1 + 2, { ...planks, droneEvery: 2, monitors: ['rings10'], onRamp: true }); // over the pier head, to the brink of the valley: a drop from here lands on its downhill, and its own ledges carry on
    c = droneBridge(b, deck - 12, { drones: 4, lift: 7, prize: 'rings10', onRamp: true }); // off the valley's upper ledge, over the rotten deck
    b.crystal(c.endX - 3, c.endRow - 3); // CRYSTAL 2 — the bridge's far plank
    highRoad(b, c.endX + 3, bar + 28, { ...planks, monitors: ['shield'], onRamp: true }); // up the sandbar
    droneBridge(b, bar + 32, { drones: 3, prize: 'rings10', onRamp: true }); // off its crown
    highRoad(b, g0 - 2, g1 + 20, { ...planks, droneEvery: 2, crystal: true, monitors: ['rings10'], onRamp: true }); // CRYSTAL 3 — over the trap knot, to the bowl
    highRoad(b, l0 - 8, rt - 2, { ...planks, droneEvery: 3, monitors: ['rings10'], onRamp: true }); // on from the bowl's shelf, over the loop and the pools
    // The last perch, the wing, and the Riptide under it. A wing held open
    // through the first thermal tops out a full screen over the water — that
    // is where the crystal hangs — and comes down on the pier over the far
    // bank, well past glideRun's own deck.
    const perch = groundRow(b, rt + 2) - 11;
    glideRun(b, rt + 2, perch, { len: 72, windTo: perch + 8 }); // the thermals stop well short of the valley: its kicker's arcs are the approach speed, not the wind
    b.crystal(rt + 56, perch - 11); // CRYSTAL 4 — the top of the glide
    b.platform(bank + 9, bank + 35, perch + 1);
    b.monitor(bank + 30, perch + 1, 'shoes');
    b.ringsH(bank + 14, bank + 24, perch - 1);
    highRoad(b, bank + 40, bank + 76, { ...planks, droneEvery: 2, onRamp: true }); // the last planks, over the home loop: its roof is a drop from here

    /* =============================== LOW ROAD ==============================
     * The gallery under the trap knot: in by the shaft at its head, out by
     * the springs past its end.
     */
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 5], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 2
  },
};
