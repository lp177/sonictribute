import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, railCascade, rollersRun, runway, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  plunge,
  undercroft,
  tubeShot,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { crumbleSpan, thermalCliff } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 3 — "Undertow Gallery"
 *
 * The act that only goes one way: down. It starts high, and every release
 * leaves it lower than the last, until the road runs out at the waterline —
 * the undertow has you. And under each stretch of level ground there is a
 * sea-cave gallery: the low road is the fast one here, two of the galleries
 * carry a grind line, and three of the five crystals are below. The
 * pendulum from act 1 comes back twice — once alone, to roll under, then as
 * a pair in counterpoint over a crumbling shelf.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill; one swell before the pull.
 *   headland  the first fork: over the hill, or down the shaft at its foot
 *             into the first sea cave.
 *   knot      one pendulum over a long flat — roll and it passes over you.
 *             Gallery 1 runs beneath, with the first rail.   -- checkpoint
 *   plunge    down the cliff, over planking that will not wait, into
 *   valley    the kicker valley (crystal on the upper ledge, for a roll).
 *   knot      a guarded road, a sprung shelf; gallery 2 beneath (crystal,
 *             secret room, the second rail).                  -- checkpoint
 *   loop      on its hill,
 *   rails     and a cascade of grind rails down the far side,
 *   leap      whose speed clears the sump at the bottom.
 *   headland 2 the deep cave: crystal, secret room, clocked spikes.
 *   knot      the pendulum pair over a crumbling shelf; gallery 3 beneath
 *             (crystal, secret room).                         -- checkpoint
 *   cliff     the one mercy — the sea wind, back up the face — which only
 *             loads
 *   tube      the signature: through the bluff in the dark and out over the
 *             bay (crystal on the bluff's roof, a full jump over the mouth),
 *   home      and the last valley, down to the water.
 *
 * ROADS: the middle road is the ground, sinking from row 22 to row 46. The
 * low road is the star — two headland caves and three galleries. The high
 * road is the catwalks over the knots, ending on the tube's bluff.
 */
export const act03: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 3',
  title: 'Undertow Gallery',
  biome: 0,
  theme: 'verdant',
  width: 726,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 4 }); // down to row 26
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 2, crown: 6, depth: 2, basin: 6 }); // the swell before the pull
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 14, down: 8, prize: 'rings10', hazards: 1 });
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 42, density: 1, period: 160 });
    b.swingBall(g0 + 24, c.endRow - 11, 8, 160, 0); // one pendulum, alone: standing it hits, rolling it clears
    const g1 = c.endX;
    b.checkpoint(g1 - 2, c.endRow);
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 2 });
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 4, crab: true });
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 12, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    const s0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 38 });
    const s1 = c.endX;
    b.checkpoint(s1 - 2, c.endRow);
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    c = railCascade(b, c.endX, c.endRow, { steps: 2, dropEach: 3 });
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2 }); // the rails' speed is what clears it
    const h2 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 8, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (deep cave), secret 2
    // The pendulum pair: counter-phased, a crumbling shelf between them for
    // whoever would rather jump the gap in the rhythm than read it.
    const p0 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 38, rings: false });
    b.swingBall(p0 + 8, c.endRow - 11, 8, 150, 0);
    b.swingBall(p0 + 25, c.endRow - 11, 8, 150, 75);
    b.crumble(p0 + 15, p0 + 18, c.endRow - 4);
    b.ringsH(p0 + 15, p0 + 18, c.endRow - 6);
    b.ringsH(p0 + 3, p0 + 10, c.endRow - 2);
    const p1 = c.endX;
    b.checkpoint(p1 - 2, c.endRow);
    c = thermalCliff(b, c.endX, c.endRow, { rise: 12, top: 6, prize: 'rings10' }); // the wind, not a spring: a spring's arc lands on the bluff's roof and misses the tunnel
    const t0 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 36, top: 'crystal' }); // CRYSTAL 4 (bluff roof)
    c = launchValley(b, c.endX, c.endRow, { depth: 8, out: 4, crabs: 1, prize: 'shoes' });
    signpostFinish(b, c.endX, c.endRow, { len: 26 });

    /* ============================== HIGH ROAD ==============================
     * Catwalks over the knots, for whoever kept the height a kicker or a
     * shelf gave them. The last stretch sets you down on the tube's bluff.
     */
    highRoad(b, g0 - 4, g1 + 2, { droneEvery: 2, monitors: ['rings10', 'shield'], onRamp: true }); // over the first pendulum
    highRoad(b, s1 + 2, h2 - 34, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // over the loop (its roof is a drop from here) and the rails
    highRoad(b, p0 - 6, p1 + 2, { droneEvery: 3, onRamp: true }); // over the pendulum pair
    droneBridge(b, t0 - 22, { drones: 3, lift: 6, prize: 'rings10', onRamp: true }); // off the clifftop, onto the bluff

    /* =============================== LOW ROAD ==============================
     * The undertow: a gallery under every knot, each with its grind line.
     * In by the shaft at its head, out by the springs past its end.
     */
    // (No crabs under a rail: a knock-back lands the walker on it, and the
    // rail carries him the wrong way.)
    lowRoad(b, g0 + 4, g1 - 1, { shafts: [g0 + 6], crabs: 0, rail: true, prize: 'rings10' });
    lowRoad(b, s0 + 3, s1 - 1, { shafts: [s0 + 8], crabs: 0, rail: true, prize: 'crystal', secret: true }); // CRYSTAL 2, secret 1
    lowRoad(b, p0 + 1, p1 - 4, { shafts: [p0 + 2], crabs: 0, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
