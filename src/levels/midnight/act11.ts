import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, boardSprint, phaseCrossing, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
} from '../sections.ts';
import { pressHall, shiftBridge, slagChute, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 11 — "Last Shift Bell"
 *
 * The biome finale, and the bell hangs at the top. Where act 6 went down
 * into the pit this act is THE CLIMB: it starts on the yard floor, the
 * lowest gate of the shift, and every valley in it comes out higher than it
 * went in, until the arena on the bell deck. Every machine of the endless
 * shift is here, and none of them alone: hard light under swinging tackle,
 * the Mag-Board ridden across a bridge that is only half there, needles
 * over a hopper, and the last ore line — which carries you safely down to
 * the last press hall and, for exactly that reason, onto its floor. Leave
 * the cart on its dock and roll the channel instead, and the catwalk over
 * the machines is yours.
 *
 * BEATS (knot = tension, the rest is release):
 *   yard      apron, and the first lift off the yard floor.
 *   valley    a press line of hoppers on its floor; it climbs out two up.
 *   knot      hard light under tackle, then a vault (crystal).
 *                                                          -- checkpoint
 *   hill      the tallest in the biome, a cellar under it (crystal, secret).
 *   depot     the board, two decks,
 *   valley 2  twelve rows down and fourteen back up (crystal on the shelf),
 *   bridge    and the light, taken on the board (crystal over the middle).
 *                                                          -- checkpoint
 *   knot      the densest needle roof, a hopper under it.
 *   ore line  the cart down the last incline — or the channel under it —
 *   HALL      into the last press hall: two balls, two plates, two hoppers,
 *             a shield on the catwalk for whoever earned it.
 *   loop      a loop that climbs out ten rows,
 *   knot      and the bell tower's steps, needles overhead.
 *   bell      the Piston Press, enraged.
 */
export const midnight11: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 11',
  title: 'Last Shift Bell',
  biome: 1,
  theme: 'gear',
  width: 658,
  height: WORLD_ROWS,
  bossKind: 'press',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 42, { drop: 2 }); // the yard floor, row 44
    c = springCliff(b, c.endX, c.endRow, { rise: 8, top: 10 }); // row 36
    const v1 = c.endX;
    const press = c.endRow + 10; // the valley's floor
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 12, crabs: 0, prize: 'shield' }); // row 34
    b.hopper(v1 + 52, press); // a press line where the kit would put crabs, clear of the landing
    b.hopper(v1 + 61, press);
    const p0 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 130 });
    b.swingBall(p0 + 13, c.endRow - 11, 8, 130, 0); // the light AND the ball
    c = vault(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 1, secret 1
    b.checkpoint(c.endX - 1, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 10, crown: 12, down: 4, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2, secret 2; row 28
    const d0 = c.endX;
    c = boardSprint(b, c.endX, c.endRow, { sections: 2, board: true });
    c = valley(b, c.endX, c.endRow, { depth: 12, basin: 12, out: 14, crabs: 2, prize: 'crystal' }); // CRYSTAL 3 — the shelf over a board's reach; row 26
    c = shiftBridge(b, c.endX, c.endRow, { depth: 6, bed: 20, period: 180, prize: 'crystal', crabs: 2 }); // CRYSTAL 4 — over the light
    b.boardEnd(c.endX - 2);
    b.checkpoint(c.endX - 1, c.endRow);
    const n0 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 });
    b.hopper(n0 + 8, c.endRow);
    const k0 = c.endX;
    c = slagChute(b, c.endX, c.endRow, { drop: 8, bed: 10, line: 'cart', prize: 'crystal', crabs: 1 }); // the last ore line; CRYSTAL 5; row 34
    b.secret(k0 + 20, c.endRow + 1, k0 + 29, c.endRow + 3); // secret 3 — the channel under the line: the fast road to the catwalk
    c = pressHall(b, c.endX, c.endRow, { lead: 10, len: 36, swings: 2, traps: 2, hoppers: 2, period: 120, prize: 'shield' });
    b.checkpoint(c.endX, c.endRow);
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 10, roof: 'rings10' }); // out higher than in: row 30
    const t0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 4, tread: 8 }); // the bell deck, row 22
    b.slab(t0 + 3, t0 + 19, c.endRow - 7, 2); // one roof over both steps, needles over each
    b.stalactite(t0 + 7, c.endRow - 6);
    b.stalactite(t0 + 12, c.endRow - 6);
    b.stalactite(t0 + 16, c.endRow - 6);
    arenaApproach(b, c.endX, c.endRow, { width: 44 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, p0 - 2, h0 + 20, { droneEvery: 3, monitors: ['rings10'] }); // over the crossing and up the hill
    droneBridge(b, h0 + 28, { drones: 2, prize: 'rings10' }); // off the crown, towards the depot
    highRoad(b, d0 + 2, d0 + 34, { monitors: ['rings10'] }); // over the board decks
    highRoad(b, n0 - 2, k0 + 4, { lift: 6, crumbleEvery: 3, monitors: ['rings10'] }); // onto the needle roof
    highRoad(b, l0 + 30, t0 + 2, { lift: 13 }); // from the loop's exit towards the bell steps
  },
};
