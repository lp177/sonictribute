import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { phaseCrossing, runway, signpostFinish, stackedChoice, type MotifEnd } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { lightBridge, lightStair, roofedTube, rooftops } from './pieces.ts';

const W = 759;

/**
 * The act's own flight: terraces six rows apart — more than a jump — with a
 * well between them. A step of hard light hangs halfway up each well: two
 * hops and you are up. Meet it dark, or miss it, and the springs in the well
 * do the climbing instead.
 * FOOTPRINT: 4 + flights*13 columns. NET: rises flights*6 rows.
 */
function lightFlight(b: LevelBuilder, x: number, row: number, flights: number, period: number): MotifEnd {
  let cur = row;
  let cx = x + 4;
  b.floor(x, x + 3, cur);
  for (let i = 0; i < flights; i++) {
    b.floor(cx, cx + 5, cur + 3);
    b.spring(cx + 4, cur + 3, 11);
    b.spring(cx + 5, cur + 3, 11);
    b.phasePlatform(cx + 1, cx + 4, cur - 3, period, i % 2 === 0 ? 0 : Math.floor(period / 2));
    b.ringsH(cx + 2, cx + 3, cur - 5);
    cur -= 6;
    b.floor(cx + 6, cx + 12, cur);
    b.ringsH(cx + 8, cx + 10, cur - 3);
    cx += 13;
  }
  return { endX: cx, endRow: cur };
}

/**
 * NOON TOMORROW — ACT 2 — "Hardlight Stairway"
 *
 * The climbing act. It starts in the undercity and ends on the roofline, four
 * flights higher: every flight is a spring for whoever is in a hurry, and
 * beside or inside each one a stair of hard light that goes HIGHER — to the
 * catwalks, where the prizes are. Each landing spends a little of the height
 * on a release, so the silhouette is a staircase with worn steps.
 *
 * BEATS:
 *   opening    a safe apron, and the first valley roofed in hard light (slow).
 *   flight 1   a spring cliff; the first light stair beside it.
 *   landing    a hard-light crossing.                           -- checkpoint
 *   release    the long valley (crystal up top),
 *   flight 2   and out of it by steps of light over two wells.
 *   landing    the roofs, a street under them,
 *   release    a plunge off the last one into the loop.         -- checkpoint
 *   flight 3   a spring cliff.
 *   landing    two decks over a service gallery,
 *   release    the hill (a crystal in the vault under it) and the leap its
 *              far slope feeds.
 *   flight 4   the grand stair: the tallest cliff, and six steps of light
 *              that climb past its top to the crystal.          -- checkpoint
 *   roofline   a faster bridge of light, the last valley, the tunnel out.
 *
 * ROADS: the middle road is the ground and its flights. The high road is hard
 * light — each stair arrives on a catwalk that runs over the landing beyond.
 * The low road is the dips under the bridges, the street, the gallery and the
 * vault.
 */
export const act02: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 2',
  title: 'Hardlight Stairway',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 40); // down to row 44: the bottom of the city
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, period: 200, hazards: 0, prize: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 10 });
    const f1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 6 }); // FLIGHT 1 → row 34
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 7, period: 190 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = launchValley(b, c.endX, c.endRow, { depth: 12, basin: 14, out: 8, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge) → row 38
    c = lightFlight(b, c.endX, c.endRow, 2, 170); // FLIGHT 2 → row 26
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -2, 2, -1, 1], droneEvery: 3, room: 'shield', secret: true }); // secret 1
    const r1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 4 }); // → row 36
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 2, roof: 'rings10' }); // → row 38
    c = runway(b, c.endX, c.endRow, { len: 14, checkpoint: true });
    const f3 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 14 }); // FLIGHT 3 → row 26
    const k3 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 26 });
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 10, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (vault), secret 2 → row 30
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2, pit: 'crab' }); // → row 32
    c = runway(b, c.endX, c.endRow, { len: 6, rings: false });
    const f4 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // FLIGHT 4 → row 20, the roofline
    b.checkpoint(c.endX - 3, c.endRow);
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 16, period: 150, hazards: 2, prize: 'crystal' }); // CRYSTAL 3 (the pier)
    const v2 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 10, crabs: 1, prize: 'shoes' }); // → row 22
    c = roofedTube(b, c.endX, c.endRow, { drop: 6, runout: 36, top: 'shield' }); // → row 28
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act02 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ==============================
     * Every stair of light starts on the road before a flight and arrives on
     * a catwalk above the landing after it. The catwalks ride 8–9 rows up
     * here, not 11: the stairs do the climbing.
     */
    let s = lightStair(b, f1 - 8, 44, { steps: 5, period: 200, prize: 'rings10' }); // to row 26, eight over landing 1
    highRoad(b, s.endX + 4, s.endX + 34, { lift: 8 });
    highRoad(b, r0 - 11, r1 + 4, { crumbleEvery: 4, monitors: ['rings10'] }); // over the roofs, sprung from flight 2's top terrace
    b.spring(r0 - 5, 26, 10);
    highRoad(b, r1 + 10, r1 + 34); // down the plunge, as far as the loop
    s = lightStair(b, f3 - 16, 38, { steps: 6, period: 180, ledge: 4, prize: 'none' }); // to row 17, nine over landing 3
    highRoad(b, s.endX + 3, h0 + 30, { droneEvery: 3, crystal: true, monitors: ['rings10', 'rings10'] }); // CRYSTAL 4
    s = lightStair(b, f4 - 16, 32, { steps: 6, period: 160, ledge: 10, prize: 'crystal' }); // CRYSTAL 5 — the grand stair, to row 11
    highRoad(b, s.endX + 4, v2 + 2, { lift: 9, crumbleEvery: 2 });

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, k3 + 1, k3 + 24, { shafts: [k3 + 4], crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
