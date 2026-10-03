import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, runway, secretPocket, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  undercroft,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { crumbleSpan, gliderBay, reefBowl, thermalCliff, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 10 — "Ebb-Light Ascent"
 *
 * The last ordinary act, and the hardest. Where act 7 climbed in steps, this
 * one climbs like a tide going out: two rows up, one back — every peak is
 * followed by an ebb that hands some of the height away again, and the next
 * lift has to win it back and more. Nothing here is new; everything is
 * combined, and the clocks run fast (140 frames). Pendulums swing in
 * counterpoint over a deck that will not wait for you, hoppers share their
 * pools with clocked traps, and the wing's roost has a pendulum of its own.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips down to the low-water line.
 *   headland  the first fork, and the first rise: over the hill or through
 *             the cave under it (crystal, secret room) — it ends higher.
 *   knot      the pendulum alley: a counter-phased pair, traps, a hopper;
 *             a gallery beneath (crystal, secret room).       -- checkpoint
 *   cliff     up on the sea wind (crystal on the perch);
 *   ebb       straight down the far side —
 *   bowl      and the bowl at its foot throws you higher than you fell.
 *                                                            -- checkpoint
 *   knot      three tide pools, a hopper in each and a clocked trap where
 *             its hop comes down.
 *   loop      on its hill; the exit climbs ten rows.
 *   valley    the kicker valley, climbing out past its own rim.
 *   knot      rotten decking under a pendulum pair: no standing still to
 *             read them — roll, and both pass over you.       -- checkpoint
 *   ebb       twelve rows back down, on the long ramp to
 *   bay       the signature: the wing, earned — no thermal, a pendulum over
 *             the roost, the upper roost (crystal) only for a roll — and the
 *             far shore stands four rows over the near one.   -- checkpoint
 *   terraces  the last wall,
 *   home      a pocket, the summit loop, the signpost.
 *
 * ROADS: the middle road is the ascent, row 46 to row 20. The high road is
 * the catwalks over each ebb, where height already won can be kept; the low
 * road is the headland's cave, the alley's gallery and the bay floor.
 */
export const act10: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 10',
  title: 'Ebb-Light Ascent',
  biome: 0,
  theme: 'verdant',
  width: 692,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 40, { drop: 6 }); // down to row 46: low water
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 10, down: 4, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 1 (cave), secret 1
    const a0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 32, density: 2, period: 140 });
    b.swingBall(a0 + 9, c.endRow - 11, 8, 140, 0); // the alley's pair: half a period apart, so the gap between them is the rhythm
    b.swingBall(a0 + 22, c.endRow - 11, 8, 140, 70);
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const a1 = c.endX;
    c = thermalCliff(b, c.endX, c.endRow, { rise: 12, top: 6, prize: 'crystal' }); // CRYSTAL 3 (perch)
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 4 });
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 8, lift: 10, prize: 'rings10' });
    b.checkpoint(c.endX - 4, c.endRow);
    const f0 = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 3, depth: 2, prize: 'shield' });
    for (let i = 0; i < 3; i++) b.spikeTrap(f0 + i * 16 + 11, c.endRow + 2, 140, i * 47); // and a trap at the far end of each pool floor, where its hop lands
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 10, roof: 'shield' });
    const v0 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 12, crabs: 2, prize: 'rings10' }); // an ebb that pays: it tops out two rows over where it began
    const d0 = c.endX;
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 6, crab: true });
    b.swingBall(d0 + 8, c.endRow - 11, 8, 140, 0); // over the rotten deck: the planks give you 34 frames, the pair wants 70
    b.swingBall(d0 + 17, c.endRow - 11, 8, 140, 70);
    b.checkpoint(c.endX - 2, c.endRow);
    const e0 = c.endX;
    // The bay lays its own ramp (a gentle one: off a cliff's brow a hopping
    // runner overflies the run-up and comes down dead on the kicker).
    const bay = c.endX + 24;
    const brink = c.endRow + 12;
    c = gliderBay(b, c.endX, c.endRow, { feed: 12, width: 56, depth: 10, out: 14, crabs: 2, thermal: false, prize: 'rings10', upper: 'crystal' }); // CRYSTAL 4 (upper roost)
    b.swingBall(bay + 47, brink - 14, 7, 140, 35); // hung over the far end of the upper roost: a hit costs the wing
    b.checkpoint(c.endX - 2, c.endRow);
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4, tread: 8 });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 3
    const top = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    signpostFinish(b, c.endX, c.endRow, { len: 28 });

    /* ============================== HIGH ROAD ==============================
     * Over each ebb: the height the last lift won, kept by not coming down.
     */
    highRoad(b, h0 + 4, a1 + 2, { droneEvery: 3, crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // up the headland, over the alley
    droneBridge(b, a1 + 18, { drones: 4, prize: 'rings10', onRamp: true }); // off the clifftop, over the first ebb
    highRoad(b, f0 - 8, l0 + 4, { crumbleEvery: 3, droneEvery: 2, crystal: true, monitors: ['shield'], onRamp: true }); // CRYSTAL 5 — off the bowl's shelf, over the pools
    highRoad(b, l0 + 20, v0 + 4, { crumbleEvery: 3, onRamp: true }); // over the loop: its roof is a drop from here
    highRoad(b, d0 - 12, e0 - 2, { crumbleEvery: 3, droneEvery: 2, monitors: ['rings10'], onRamp: true }); // over the rotten deck
    highRoad(b, bay + 80, top - 12, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // from the roost's end, up the far shore to the last wall
    highRoad(b, top + 2, top + 50, { crumbleEvery: 3, droneEvery: 3, onRamp: true }); // the summit: the loop's roof is a drop from here

    /* =============================== LOW ROAD ==============================
     * The gallery under the pendulum alley: the way to skip the rhythm, at
     * the price of its own trap. And a second, inside the reef.
     */
    lowRoad(b, a0 + 5, a1 - 1, { shafts: [a0 + 5], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 2, secret 2
    lowRoad(b, f0 - 26, f0 - 3, { shafts: [f0 - 24], crabs: 0, traps: 1, prize: 'rings10' }); // and the cave inside the reef the bowl throws you onto
  },
};
