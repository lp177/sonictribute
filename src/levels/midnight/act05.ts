import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, railCascade, rollersRun, signpostFinish, stackedChoice, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  cave,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { slagChute, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 5 — "Coolant Undercroft"
 *
 * The cellars where the coolant runs. This act goes DOWN EARLY AND STAYS
 * DOWN: the pipe rails drop it under the works in its first tenth and the
 * road never climbs back to the gate's height. Here the low road is the
 * star. There is a cave under both hills, a rail gallery under the second
 * gauntlet, and — the act's signature — the COOLANT MAIN: one gallery two
 * hundred columns long that runs under a knot, a whole valley, a rhythm of
 * humps and a second knot, with its own grind rails, crystal and store-room.
 * Three of the five crystals are below ground; the catwalks are thin on
 * purpose.
 *
 * BEATS (knot = tension, the rest is release):
 *   door      apron, then the pipe rails: three grinds down into the cellars.
 *   hill 1    over it, or through the sump beneath (crystal, secret).
 *   knot      dripstone needles.                           -- checkpoint
 *   loop      on its own slope.
 *   knot      plates and a hopper — and the shaft into the COOLANT MAIN,
 *   valley    which runs on under the valley (a second shaft in its floor),
 *   humps     under the pump humps,
 *   knot      and under the guarded deck beyond, where its lift comes up.
 *                                                          -- checkpoint
 *   sluice    a slag chute crossed by ore cart (crystal over the track).
 *   lift      the spring back up,                          -- checkpoint
 *   knot      a long plate walk with a rail gallery under it,
 *   hill 2    the pump-house hill and its cellar,
 *   outfall   a leap, a vault (crystal), and the plunge to the signpost.
 */
export const midnight05: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 5',
  title: 'Coolant Undercroft',
  biome: 1,
  theme: 'gear',
  width: 683,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24); // row 28
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 6, span: 7, dropEach: 3 }); // the pipe rails: row 37
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 12, down: 9, prize: 'crystal', secret: true }); // CRYSTAL 1, secret 1; row 39
    const n0 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 });
    b.checkpoint(c.endX, c.endRow);
    c = loopHill(b, c.endX, c.endRow, { drop: 5, up: 5, roof: 'shield' });
    const m0 = c.endX;
    const road = c.endRow; // the road over the head of the main
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 2 });
    const v0 = c.endX;
    const hollow = c.endRow + 7; // the valley's floor
    c = valley(b, c.endX, c.endRow, { depth: 7, out: 9, basin: 8, crabs: 1, prize: 'rings10' }); // floor row 46; out at row 37
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 6, depth: 2, basin: 6 }); // the pump humps
    c = stackedChoice(b, c.endX, c.endRow, { len: 24 });
    const m1 = c.endX;
    b.checkpoint(c.endX, c.endRow);
    c = slagChute(b, c.endX, c.endRow, { drop: 6, bed: 10, line: 'cart', prize: 'crystal' }); // CRYSTAL 2 — over the track; row 43
    c = springCliff(b, c.endX, c.endRow, { rise: 9, top: 12 }); // row 34
    b.checkpoint(c.endX - 5, c.endRow);
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 34, density: 2, period: 140 });
    const g1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 10, prize: 'shoes', hazards: 2 }); // row 38
    c = longJump(b, c.endX, c.endRow, { gap: 13, fall: 1, pit: 'crab' }); // the hill's far slope is the run-up; row 39
    c = vault(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 3, secret 2
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 44 }); // the outfall: row 45
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ==============================
     * Thin on purpose: a service walk over the needles and the loop, another
     * over the plate walk. This act pays underground.
     */
    highRoad(b, n0 - 2, m0 - 4, { monitors: ['rings10'] });
    highRoad(b, g0 + 2, g1 + 26, { crumbleEvery: 2, crystal: true }); // CRYSTAL 4 — over the plate walk, on ledges that give way

    /* ============================ THE COOLANT MAIN =========================
     * One gallery from the head of the first gauntlet to the tail of the
     * guarded deck beyond the humps, sixteen rows under the road and three
     * under the valley's floor. In by the shaft among the plates or the one
     * in the valley floor; out by the lift at its far end.
     */
    const F = road + 16;
    const x0 = m0 + 1;
    const x1 = m1 - 2;
    cave(b, x0, x1, F, 6);
    b.carve(m0 + 2, road, m0 + 4, F - 1); // the way in, among the plates
    b.carve(v0 + 52, hollow, v0 + 54, F - 1); // and from the valley floor
    b.ringsH(x0 + 8, x0 + 18, F - 2);
    b.enemy(x0 + 24, F, 4);
    b.spikeTrap(x0 + 36, F, 150, 0);
    b.rail(x0 + 44, F - 3, x0 + 84, F - 2); // the pipe run: forty columns of grind
    b.ringsH(x0 + 48, x0 + 80, F - 5);
    b.crystal(x0 + 64, F - 6); // CRYSTAL 5 — over the rail: jump from the grind
    b.enemy(x0 + 96, F, 4);
    b.spikeTrap(x0 + 106, F, 150, 60);
    b.rail(x0 + 120, F - 2, x0 + 150, F - 3); // a second run under the humps, climbing a row
    b.ringsH(x0 + 124, x0 + 146, F - 5);
    b.enemy(x0 + 160, F, 4);
    b.monitor(x1 - 8, F, 'shield');
    b.ringBox(x1 - 14, F - 2, 4, 1);
    b.secret(x1 - 16, F - 6, x1 - 5, F - 1); // secret 3 — the store-room at the main's far end
    b.carve(x1 - 2, road - 2, x1, F - 1); // the lift out, under the deck two rows higher
    b.spring(x1 - 1, F, 13);
    b.spring(x1, F, 13);

    /* =============================== LOW ROAD ==============================
     * The rail gallery under the plate walk.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 3], crabs: 2, traps: 1, rail: true, prize: 'rings10' });
  },
};
