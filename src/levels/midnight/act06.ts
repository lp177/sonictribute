import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, cartCanyon, hazardGauntlet, rollersRun, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { pressHall, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 6 — "Press Floor Foreman"
 *
 * Mid-shift inspection: the Piston Press walks the floor, and the floor is
 * at the bottom. The act is a DESCENT INTO THE PIT — it starts on a gate
 * ramp eight rows tall and ends in the biome's deepest arena — and its
 * machinery is the press hall: a sunken floor of swinging tackle, clocked
 * plates and hoppers, roofed by the press bed. A kicker stands in front of
 * each hall, so the fork is always the same honest one: bring a hill's speed
 * and you cross on the catwalk; arrive at a walk and you go through the
 * machines. Twice, the second time at full density.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      the longest opening ramp of the biome —
 *   hall 1    — because it is the run-up to the first press hall.
 *   hill      over it or through the scale pit beneath (crystal, secret).
 *                                                          -- checkpoint
 *   loop      fed by the hill's far slope.
 *   knot      the full press gauntlet, a duct under it (crystal).
 *                                                          -- checkpoint
 *   lift      sprung up to the charging deck:
 *   knot      a deck under swinging tackle, a sprung shelf over it.
 *   valley    Its floor is a press line of hoppers (crystal up top).
 *   knot      the ore cart, wider now.                     -- checkpoint
 *   heaps     a hill and a dip to breathe on,
 *   leap      a gap with a plate in its pit, and terraces under tackle.
 *   HALL 2    the plunge is the run-up to the great hall: two balls, two
 *             plates, two hoppers — or the catwalk over all of it (crystal).
 *   pit       a vault, the last plunge, and the foreman's floor.
 */
export const midnight06: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 6',
  title: 'Press Floor Foreman',
  biome: 1,
  theme: 'gear',
  width: 623,
  height: WORLD_ROWS,
  bossKind: 'press',
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20, { drop: 8 }); // row 28: eight rows of ramp, the first hall's run-up
    c = pressHall(b, c.endX, c.endRow, { lead: 4, len: 28, swings: 1, traps: 1, hoppers: 0, prize: 'rings10' });
    b.checkpoint(c.endX + 1, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, down: 12, prize: 'crystal', secret: true }); // CRYSTAL 1, secret 1; row 32
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'shield' }); // the hill's far slope runs straight into it; row 36
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 3, period: 140 }); // the full press line
    const g1 = c.endX;
    b.checkpoint(c.endX + 1, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 8 }); // the charging deck, row 26
    const s0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 24 });
    b.swingBall(s0 + 17, c.endRow - 10, 8, 150, 0); // tackle over the ground road: the shelf above it is the safe line
    const v0 = c.endX;
    const press = c.endRow + 12; // the valley's floor
    c = valley(b, c.endX, c.endRow, { depth: 12, out: 8, crabs: 0, prize: 'crystal' }); // CRYSTAL 2; row 30
    // The valley floor is a press line: hoppers where the kit would put crabs,
    // well past the lip so whoever missed the ledge still lands clear.
    b.hopper(v0 + 56, press);
    b.hopper(v0 + 64, press);
    b.spikeTrap(v0 + 60, press, 140, 20);
    const k0 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 3, crown: 6, depth: 3, basin: 6 }); // the slag heaps between the lines: a breath
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2, pit: 'trap' }); // row 32
    const t0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 4, tread: 8 }); // row 24
    b.swingBall(t0 + 12, c.endRow - 6, 7, 150, 30); // tackle over the upper terrace: time the last jump
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 2 }); // row 36: the great hall's run-up
    c = pressHall(b, c.endX, c.endRow, { len: 38, swings: 2, traps: 2, hoppers: 2, period: 130, prize: 'crystal' }); // CRYSTAL 3 — on the catwalk
    c = vault(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2: a shield for the fight
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 8 }); // into the pit, row 44
    arenaApproach(b, c.endX, c.endRow, { width: 44 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, h0 + 5, h0 + 22, { monitors: ['rings10'] }); // up the hill's near slope
    c = droneBridge(b, h0 + 24, { drones: 3, prize: 'rings10' }); // off the hill's crown
    highRoad(b, g0 - 10, g1 + 4, { monitors: ['rings10'] }); // over the gauntlet
    highRoad(b, s0 + 2, s0 + 24, { lift: 13, droneEvery: 2 }); // over the tackle deck's shelf
    highRoad(b, k0 - 2, t0 + 14, { crumbleEvery: 3, crystal: true, monitors: ['rings10', 'shoes'] }); // CRYSTAL 4 — over the cart, the leap, the terraces

    /* =============================== LOW ROAD ==============================
     * The duct under the press gauntlet.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 2, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
