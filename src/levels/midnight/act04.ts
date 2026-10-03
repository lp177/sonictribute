import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, runway, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  stairClimb,
  tubeShot,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 4 — "Rivet Gantry Rush"
 *
 * The riveting yard is a gantry, and a gantry is climbed. The act's shape is
 * one long CLIMB, THEN ONE CHUTE: sixty percent of it wins height a lift at a
 * time — a valley that comes out higher than it went in, a loop whose exit
 * outclimbs its run-up, terraces, a hill — and the last forty percent spends
 * every row of it in a single unbroken rush to the yard floor. The high road
 * is the star: the catwalk runs the whole climb. First ore cart of the biome
 * (alone, with a crystal for whoever bails at the right moment), and the
 * first press tackle: one crane hook over the plates.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      apron, and a valley that climbs out two rows up.
 *   knot      the first ore cart, over a canyon (crystal over the track).
 *                                                          -- checkpoint
 *   loop      a loop on the way UP, and a vault past it.
 *   terraces  three jump-up steps, and a gap in the gantry to leap.
 *   knot      plates under the crane hook, the rivet store beneath
 *             (crystal).                                   -- checkpoint
 *   summit    the last hill (cellar: crystal, secret), and the top gantry:
 *             a guarded deck under a sprung shelf (crystal). -- checkpoint
 *   RUSH      the plunge, the great valley (crystal on its top shelf), the
 *             loop and the tube out through the yard wall — no knot, no
 *             stop, from the summit to the signpost.
 */
export const midnight04: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 4',
  title: 'Rivet Gantry Rush',
  biome: 1,
  theme: 'gear',
  width: 629,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 34, { drop: 2 }); // row 36
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 12, crabs: 1, prize: 'rings10' }); // out higher than in: row 34
    const v1 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // the first ore cart, alone
    b.crystal(v1 + 9, c.endRow - 6); // CRYSTAL 1 — over the track: jump out of the cart for it
    b.checkpoint(c.endX - 2, c.endRow);
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 8, roof: 'shield' }); // the exit outclimbs the run-up: row 32
    c = vault(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 1
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 3, tread: 8 }); // row 23
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 0, pit: 'crab' });
    c = runway(b, c.endX, c.endRow, { len: 8 }); // the leap lands on ground and rings
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 2 });
    b.swingBall(g0 + 17, c.endRow - 10, 8, 160, 0); // the crane hook: the biome's first press tackle
    const g1 = c.endX;
    b.checkpoint(c.endX + 1, c.endRow);
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 14, down: 4, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 2; row 21
    const top = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 22, crystal: true }); // CRYSTAL 2 — the top gantry's shelf
    b.checkpoint(c.endX - 2, c.endRow);
    // The rush: everything from here to the signpost is downhill.
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 4 }); // row 33
    c = valley(b, c.endX, c.endRow, { depth: 12, out: 6, crabs: 2, prize: 'crystal' }); // CRYSTAL 3 — a rolled plunge reaches the top shelf; row 39
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    c = tubeShot(b, c.endX, c.endRow, { drop: 6, runout: 44, top: 'shield' }); // out through the yard wall; row 45
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ==============================
     * The gantry catwalk: one line of ledges from the first valley's rim to
     * the summit, riding over the cart, the loop, the terraces and the hook.
     */
    highRoad(b, v1 - 4, top - 14, { droneEvery: 4, crumbleEvery: 5, monitors: ['rings10', 'shield', 'rings10', 'shoes'] });

    /* =============================== LOW ROAD ==============================
     * The rivet store under the plates.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 4, secret 3
  },
};
