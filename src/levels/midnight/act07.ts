import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { boardSprint, hazardGauntlet, runway, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  longJump,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { slagChute, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 7 — "Skyhook Expressway"
 *
 * The expressway is strung, not built: skyhook rails zip from tower to tower
 * over the slag channels. The act's shape is a SAWTOOTH — a spring or a
 * stair hauls the road up a tower in a few columns, and a hook spends the
 * height over forty. Three hooks, each longer than the last; a rail always
 * hands you on faster than it took you, so what follows each is a release
 * (a loop, a valley), never a knot. The Mag-Board returns for the middle of
 * the act and rides the second hook. Under every hook the channel is the low
 * road: let go of the line and you are on it.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      apron, and the first tower: sprung up twelve rows.
 *   hook 1    the short line — and what a rail's exit speed is for:
 *   loop      the loop at its foot.
 *   knot      plates and a hopper, a cable duct under them. -- checkpoint
 *   tower 2   terraces up to the depot deck, and the board.
 *   valley    fourteen rows down on the board (crystal on the top shelf),
 *   hook 2    and straight onto the second line, board and all.
 *                                                          -- checkpoint
 *   knot      a guarded deck and its sprung shelf (crystal), a vault.
 *   tower 3   the tallest lift, a leap between its two heads,
 *   HOOK 3    and the long line: twelve rows over the widest channel
 *             (crystal perched over the middle — let go for it).
 *   valley    the line's speed, spent: thrown to a valley's top shelf,
 *   loop      then the last loop and the run home.
 */
export const midnight07: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 7',
  title: 'Skyhook Expressway',
  biome: 1,
  theme: 'gear',
  width: 697,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 34, { drop: 2 }); // row 36
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 10 }); // tower 1, row 24
    const k1 = c.endX;
    c = slagChute(b, c.endX, c.endRow, { drop: 8, bed: 10, line: 'rail', prize: 'rings10', crabs: 1 }); // hook 1; row 32
    b.monitor(k1 + 22, c.endRow + 4, 'shield'); // on the channel bed, for whoever let go
    b.secret(k1 + 20, c.endRow + 1, k1 + 29, c.endRow + 3); // secret 1 — the bed under the first hook
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'shield' }); // row 36
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 2 });
    const g1 = c.endX;
    b.checkpoint(c.endX + 1, c.endRow);
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4, tread: 7 }); // tower 2, row 24
    const d0 = c.endX;
    c = boardSprint(b, c.endX, c.endRow, { sections: 2, board: true });
    c = valley(b, c.endX, c.endRow, { depth: 14, out: 10, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 — the shelf over a board's reach; row 28
    c = slagChute(b, c.endX, c.endRow, { drop: 10, bed: 14, line: 'rail', prize: 'shoes', crabs: 1 }); // hook 2, on the board; row 38
    b.boardEnd(c.endX - 3);
    b.checkpoint(c.endX - 1, c.endRow);
    const s0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 24, crystal: true }); // CRYSTAL 2
    const s1 = c.endX;
    c = vault(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 2
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 8 }); // tower 3, row 24
    b.checkpoint(c.endX - 4, c.endRow);
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2 }); // between the tower's two heads; row 26
    const k3 = c.endX;
    c = slagChute(b, c.endX, c.endRow, { drop: 12, bed: 20, line: 'rail', prize: 'crystal', crabs: 2 }); // HOOK 3; CRYSTAL 3; row 38
    b.crystal(k3 + 30, c.endRow + 2); // CRYSTAL 4 — on the channel bed under the long line
    c = valley(b, c.endX, c.endRow, { depth: 8, out: 8, crabs: 1, prize: 'shield' }); // a rail's exit speed is a rolled hill's: the top shelf, for once, on foot
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 2, roof: 'rings10' }); // row 40
    const home = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 30 });
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, g0 - 40, g1 + 6, { droneEvery: 3, monitors: ['rings10'] }); // over the first loop and the plates
    highRoad(b, d0 - 22, d0 - 2, {}); // up tower 2
    droneBridge(b, d0 + 4, { drones: 3, lift: 9, prize: 'rings10' }); // over the board decks
    highRoad(b, s0 + 2, s1 + 12, { lift: 12, crumbleEvery: 3, monitors: ['shield'] }); // over the guarded deck, towards tower 3
    highRoad(b, k3 - 44, k3 - 2, { droneEvery: 2 }); // across tower 3's two heads
    highRoad(b, home - 38, home + 24, { monitors: ['rings10'] }); // over the last loop

    /* =============================== LOW ROAD ==============================
     * The cable ducts: one under the plates, one under the guarded deck.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
    lowRoad(b, s0 + 1, s1 - 3, { shafts: [s0 + 3], crabs: 1, prize: 'rings10' }); // and a second under the guarded deck
  },
};
