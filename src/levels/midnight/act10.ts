import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { boardSprint, cartCanyon, hazardGauntlet, phaseCrossing, railCascade, runway, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { needleChute, pressHall, slagChute, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 10 — "Ore Cart Terminus"
 *
 * The marshalling yard where every ore line in the foundry ends, and it ends
 * at the bottom. The act is DOWNHILL ALL THE WAY: it leaves the highest gate
 * of the shift and never again stands as high as it has just been — no
 * lift wins back more than the lines before it spent. Four carts: one over a
 * canyon at the gate, one down an incline, one over the widest canyon, and
 * the terminus line itself, ten rows of track over the deepest channel. And
 * threaded between them, once each and at full strength, everything the
 * shift has taught: the press gauntlet, the Mag-Board, the press hall, the
 * hard-light crossing (under swinging tackle now), the needle chute, the
 * rails.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      apron — and a cart already waiting over the first canyon.
 *   valley    a vault, then the first fork.
 *   knot      the full press gauntlet, a duct under it (crystal, secret).
 *                                                          -- checkpoint
 *   board     two decks and a valley on the Mag-Board; it is taken back at
 *   incline   ore line 2: a cart down the slag chute (crystal over it).
 *   hill      over it or through the tally room (crystal, secret) — its far
 *   hall      slope is the run-up to the press hall (crystal on the bed).
 *   lift      the first lift,                              -- checkpoint
 *   knot      hard light under swinging tackle,
 *   chute     then the needle chute, a needle in every bay, running out
 *   rails     into two grinds down to the lower yard.
 *   knot      the widest canyon, a drone in its airspace.  -- checkpoint
 *   lift      the second, shorter lift, to the dock of
 *   TERMINUS  the last line (crystal over the track, crabs under it).
 *   buffers   and where a cart sets you down slow, a hill and a loop to
 *             finish fast.
 */
export const midnight10: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 10',
  title: 'Ore Cart Terminus',
  biome: 1,
  theme: 'gear',
  width: 711,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20, { drop: 2 }); // row 22
    const gate = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // ore line 1: a cart at the gate
    c = vault(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 1
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 6, crabs: 1, prize: 'rings10' }); // row 26
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 3, period: 130 });
    const g1 = c.endX;
    b.checkpoint(c.endX + 1, c.endRow);
    c = boardSprint(b, c.endX, c.endRow, { sections: 2, board: true }); // the yard's own Mag-Board
    c = valley(b, c.endX, c.endRow, { depth: 8, out: 8, crabs: 2, prize: 'shield' }); // flown on the board
    b.boardEnd(c.endX - 3); // off the board before the incline: a board cannot take a cart
    c = slagChute(b, c.endX, c.endRow, { drop: 8, bed: 10, line: 'cart', prize: 'crystal' }); // ore line 2; CRYSTAL 1; row 34
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 10, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2, secret 2; row 38
    c = pressHall(b, c.endX, c.endRow, { len: 30, swings: 2, traps: 1, hoppers: 1, period: 140, prize: 'crystal' }); // CRYSTAL 3
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // row 26
    b.checkpoint(c.endX - 4, c.endRow);
    const p0 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 });
    b.swingBall(p0 + 13, c.endRow - 11, 8, 150, 40); // tackle over the far lip: the light AND the ball
    c = needleChute(b, c.endX, c.endRow, { drop: 8, every: 1 }); // row 34
    const r0 = c.endX;
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 6, span: 8, dropEach: 3 }); // row 40
    const k0 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // ore line 3: the widest canyon
    b.drone(k0 + 9, c.endRow - 4, 2);
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 9, top: 6 }); // row 31
    c = slagChute(b, c.endX, c.endRow, { drop: 10, bed: 14, line: 'cart', prize: 'crystal', crabs: 2 }); // THE TERMINUS LINE; CRYSTAL 4; row 41
    c = loopHill(b, c.endX, c.endRow, { drop: 5, up: 0, roof: 'shield' }); // a cart sets you down slow: the hill is the speed back; row 46
    const home = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 28 });
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, gate + 4, gate + 34, { monitors: ['rings10'] }); // over the gate canyon and the vault
    highRoad(b, g0 - 2, g1 + 4, { droneEvery: 3, monitors: ['rings10'] }); // over the gauntlet
    droneBridge(b, h0 + 20, { drones: 2, prize: 'shoes' }); // off the hill's crown
    highRoad(b, p0 - 6, r0 + 30, { lift: 7, crumbleEvery: 3, monitors: ['rings10', 'shield'] }); // the crossing, the needle roof, the rails
    highRoad(b, k0 + 2, k0 + 34); // over the widest canyon and the second lift
    highRoad(b, home - 36, home + 26, { lift: 14, monitors: ['rings10'] }); // over the last loop, clear of its roof

    /* =============================== LOW ROAD ==============================
     * The duct under the press gauntlet.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 2, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
