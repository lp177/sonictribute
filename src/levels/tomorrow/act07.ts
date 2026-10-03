import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { boardSprint, hazardGauntlet, rollersRun, runway, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  springCliff,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { lightBridge, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 758;

/**
 * NOON TOMORROW — ACT 7 — "Rush Hour Forever"
 *
 * The Mag-Board act. The board is handed over at the first knot and kept
 * almost to the end; on it the hero never drops under 7 px/frame and cannot
 * curl up, so the act is built the way a freeway is: valleys wide enough to
 * fly, long wavelengths, and only four knots — each one a question asked at
 * speed. Nothing here is a booster but the pad that starts the ride; the
 * traffic is the terrain.
 *
 * BEATS:
 *   opening    a safe apron tips downhill.
 *   knot       the on-ramp: the board, one pad, one pit to clear. The ride
 *              begins.
 *   valley 1   the deepest valley of the biome: the board always makes the
 *              ledge,
 *   arch       the loop its climb-out feeds,
 *   freeway    and the widest gap in the game — the board carries it.
 *   lift       a spring back to the rooftops.                   -- checkpoint
 *   knot       the roofs at 7 px/frame: you cannot stop, only time the hops
 *              (the street under them is empty: a miss costs the line, never
 *              the board).
 *   rollers    two waves to pump,
 *   valley 2   and a long ribbon over the second valley (a crystal over it).
 *                                                               -- checkpoint
 *   knot       hard light at speed: the bridge blinks faster than you cross
 *              it.
 *   tunnel     the tunnel out; the ride ends on its landing strip.
 *                                                               -- checkpoint
 *   lift       sprung up on foot,
 *   knot       the full gauntlet, slowly, after all that,
 *   home       and the last long slope to the signpost.
 *
 * ROADS: the middle road is the freeway. The high road is the valley's ledge
 * and the catwalks over the loop, the roofs, the rollers and the bridge; the
 * low road is the valley floors, the street under the roofs, the dip under
 * the bridge and the galleries under the landing strip and the gauntlet.
 */
export const act07: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 7',
  title: 'Rush Hour Forever',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // → row 26
    c = boardSprint(b, c.endX, c.endRow, { sections: 1, board: true }); // the on-ramp
    c = launchValley(b, c.endX, c.endRow, { depth: 16, basin: 12, out: 12, crabs: 2, prize: 'shield' }); // → row 30
    const f0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 0, roof: 'rings10' }); // → row 34
    c = longJump(b, c.endX, c.endRow, { gap: 16, fall: 2 }); // → row 36
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 6 }); // → row 26
    b.checkpoint(c.endX - 2, c.endRow);
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, 1, -2, 2, -1, 1, 1], width: 8, depth: 9, crabs: 0, room: 'crystal', secret: true }); // CRYSTAL 1, secret 1 → row 28
    const r1 = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 3, depth: 3, crown: 6, basin: 6 });
    const w1 = c.endX;
    c = skyRail(b, c.endX, c.endRow, { drop: 10, len: 72, depth: 16, hoppers: 2, prize: 'rings10', crystal: true, runout: 12 }); // CRYSTAL 2 → row 38
    b.checkpoint(c.endX - 3, c.endRow);
    const lb = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 16, period: 140, hazards: 1, prize: 'rings10' });
    c = roofedTube(b, c.endX, c.endRow, { drop: 6, runout: 44, top: 'crystal' }); // CRYSTAL 3 (on the bluff) → row 44
    const strip = c.endX;
    b.boardEnd(strip - 4); // the ride ends where the tunnel's flight comes down
    b.checkpoint(strip - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 12 }); // → row 30
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 22, density: 3, period: 140 });
    const g1 = c.endX;
    c = runway(b, c.endX, c.endRow, { drop: 12, len: 40 }); // → row 42
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act07 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, f0 - 8, f0 + 12, { monitors: [] }); // the upper deck: the loop's roof is a drop from here
    b.spring(f0 - 2, 30, 11);
    highRoad(b, f0 + 28, f0 + 46); // and on from the roof, as far as the gap's ramp
    highRoad(b, r0 - 2, r1 + 4, { lift: 9, monitors: ['rings10'] }); // over the roofs
    b.spring(r0 - 4, 26, 10);
    highRoad(b, r1 + 2, w1 - 2, { lift: 10, crumbleEvery: 4, crystal: true, monitors: ['shield', 'rings10'] }); // CRYSTAL 4 — over the rollers
    highRoad(b, lb + 2, lb + 46, { lift: 9 }); // over the bridge of light
    b.spring(lb - 4, 38, 10);
    highRoad(b, strip - 21, strip - 2); // two ledges past the tunnel's ring cloud
    highRoad(b, g0 - 2, g1 + 4, { droneEvery: 2 }); // over the gauntlet

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, strip - 40, strip - 4, { shafts: [strip - 38], depth: 8, crabs: 1, prize: 'rings10', secret: true }); // secret 2 — under the landing strip
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
