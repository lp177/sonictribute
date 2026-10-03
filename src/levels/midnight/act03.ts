import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { boardSprint, runway, signpostFinish, stackedChoice, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 3 — "Mainline Mag-Board"
 *
 * The Mag-Board is issued at the depot and the mainline opens under it. A
 * board never drops below a run and cannot curl up, so the act is built from
 * what a board does best: THREE GREAT VALLEYS, each deeper than the last,
 * whose kickers throw the rider from rim to ledge. The widest act so far,
 * and the one with the fewest knots — the ride is the point. The teaser is
 * the second valley's top shelf: only a ROLLED descent reaches it, so its
 * crystal belongs to whoever leaves the board on its pad.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      apron and a first valley on foot: roll it, and remember.
 *   knot      the depot yard, a store-room under it.       -- checkpoint
 *   depot     the board, and two decks to learn it on (crystal on the line).
 *   valley 2  fourteen rows down: the board is thrown to the running ledge
 *             (crystal on the shelf above it).
 *   mainline  a loop on the board, the plunge, the long leap at its foot, and
 *             the spring back up.
 *                                                          -- checkpoint
 *   valley 3  the great one, sixteen rows: the board's last and longest
 *             flight. The ride ends on its far rim.         -- checkpoint
 *   knot      needles over the buffer stops,
 *   sidings   a hill with the cable cellar under it (crystal, secret) feeds
 *   loop      the mainline loop, a vault and the run home.
 */
export const midnight03: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 3',
  title: 'Mainline Mag-Board',
  biome: 1,
  theme: 'gear',
  width: 715,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 2 }); // row 24
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 8, crabs: 1, prize: 'rings10' }); // on foot; row 26
    const d0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 26 }); // the depot yard
    const d1 = c.endX;
    b.checkpoint(c.endX - 1, c.endRow);
    c = boardSprint(b, c.endX, c.endRow, { sections: 2, board: true }); // the board, and two decks to learn it on
    b.crystal(d1 + 24, c.endRow - 4); // CRYSTAL 1 — on the flight line over the second pit
    const m0 = c.endX;
    c = valley(b, c.endX, c.endRow, { depth: 14, basin: 12, out: 12, crabs: 2, prize: 'crystal' }); // CRYSTAL 2 — the shelf a board cannot reach; row 28
    c = loopHill(b, c.endX, c.endRow, { drop: 5, up: 5, roof: 'rings10' }); // a loop taken on the board
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 4 }); // row 38
    c = longJump(b, c.endX, c.endRow, { gap: 16, fall: 2, pit: 'crab' }); // row 40
    const m1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 12 }); // row 28
    b.checkpoint(c.endX - 6, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 16, basin: 14, out: 13, crabs: 2, prize: 'shield' }); // the great valley; row 31
    b.boardEnd(c.endX - 3); // the ride ends on the far rim, where the roads merge
    b.checkpoint(c.endX - 1, c.endRow);
    const n0 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 });
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 9, prize: 'crystal', secret: true }); // CRYSTAL 3, secret 1; row 33
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shoes' }); // on foot this time; row 35
    c = vault(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2
    const l1 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 38 });
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, d0 + 2, m0 + 2, { droneEvery: 3, monitors: ['rings10'] }); // over the yard and the decks
    c = droneBridge(b, m1 - 34, { drones: 3, prize: 'crystal' }); // CRYSTAL 4 — drones over the long leap
    highRoad(b, n0 - 4, l1, { crumbleEvery: 3, crystal: true, monitors: ['rings10', 'shield'] }); // CRYSTAL 5 — needle roof, hill, loop

    /* =============================== LOW ROAD ==============================
     * The store-room under the depot yard.
     */
    lowRoad(b, d0 + 1, d1 - 2, { shafts: [d0 + 3], crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
