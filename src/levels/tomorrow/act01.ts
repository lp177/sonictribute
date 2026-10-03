import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { STORY_HOUR_OF_TOMORROW } from '../../game/story.ts';
import { phaseCrossing, quarterPipeBowl, rollersRun, runway, secretPocket, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { roofedTube, rooftops } from './pieces.ts';

const W = 732;

/**
 * NOON TOMORROW — ACT 1 — "Dawnshift Boulevard"
 *
 * The last biome opens gently: the city at first light, wide avenues that
 * sink and rise, and each of its toys shown once with nothing at stake. The
 * shape is a boulevard — long slopes, an overpass, a road tunnel, and a home
 * straight that rolls like a road.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening    a safe apron tips downhill.
 *   overpass   the first fork: over the hill, or through the empty underpass.
 *   knot       the first hard light — one slow crossing.     -- checkpoint
 *   avenue     the long valley: walk it, run it, or roll it for the crystal.
 *   knot       the boulevard's two decks, a service gallery under them.
 *   arch       the loop, fed by its own hill; a crystal on its roof.
 *                                                              -- checkpoint
 *   on-ramp    sprung up to the rooftops,
 *   knot       the first roofs — low, wide, and a street under them,
 *   tunnel     then through the last block and out over the canal.
 *                                                              -- checkpoint
 *   terraces   a jump-up climb,
 *   bowl       the skate bowl that throws you back into the air,
 *   knot       a pocket under the road and a lone security hopper on it,
 *   boulevard  and the long way down: one last valley (speed shoes on its
 *              ledge), then rollers to the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the valleys' ledges
 * and the catwalks stamped below (the bowl throws you up to one of them);
 * the low road is the underpass, the service gallery and the street under
 * the roofs.
 */
export const act01: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 1',
  title: 'Dawnshift Boulevard',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  intro: STORY_HOUR_OF_TOMORROW,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24); // down to row 28
    const over = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 16, prize: 'rings10', hazards: 0 }); // row 30
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 6, period: 210 }); // hard light, shown slow
    b.checkpoint(c.endX - 2, c.endRow);
    c = launchValley(b, c.endX, c.endRow, { depth: 14, crabs: 1, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    const k1 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 24 });
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'crystal' }); // CRYSTAL 2 (loop roof)
    const l1 = c.endX;
    b.checkpoint(c.endX - 1, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 6 });
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, 1, -1, 2], width: 8, alley: 3, room: 'crystal', secret: true }); // CRYSTAL 3, secret 1
    const r1 = c.endX;
    c = roofedTube(b, c.endX, c.endRow, { drop: 8, runout: 32, top: 'shield' }); // the road tunnel under the last block; a strip long enough for a rolled exit
    c = longJump(b, c.endX, c.endRow, { gap: 10, fall: 2 });
    b.checkpoint(c.endX - 3, c.endRow);
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4, guard: false });
    const t0 = c.endX;
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // the skate bowl: its far lip throws you at the catwalk
    c = secretPocket(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 4, secret 2
    c = runway(b, c.endX, c.endRow, { len: 14 });
    b.hopper(c.endX - 8, c.endRow); // the city's first security hopper, alone on open ground
    const v2 = c.endX;
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 2, crabs: 0, prize: 'shoes' }); // speed shoes for the rollers
    const v3 = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 3, rise: 3, depth: 3, crown: 6, basin: 6 });
    const home = c.endX;
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act01 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ==============================
     * Act 1 hands the height out: every catwalk has a spring under its first
     * ledge or a shelf within a jump of it.
     */
    highRoad(b, over + 23, over + 45, { monitors: ['rings10'] }); // off the overpass crown
    b.spring(over + 24, 20, 10);
    highRoad(b, k1 + 2, l0 + 18, { monitors: ['shield'], crystal: true }); // CRYSTAL 5 — over the decks, to the loop's roof
    highRoad(b, l0 + 32, l1 + 2); // and on from the roof to the on-ramp
    highRoad(b, r0 - 2, r1 + 6, { lift: 7, monitors: ['rings10'] }); // over the roofs: the on-ramp's spring reaches it
    // Two stretches, with the last valley's own ledges between them: a catwalk
    // that ended over the valley would drop its walkers at the kicker's foot.
    highRoad(b, t0 - 1, v2 + 2, { droneEvery: 3, monitors: ['rings10'] }); // from the top terrace, over the bowl and the hopper
    highRoad(b, v3, home, { droneEvery: 3, monitors: ['rings10'] }); // and over the rollers
    b.spring(t0 - 3, 24, 10);

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, k1 + 1, k1 + 22, { shafts: [k1 + 4], crabs: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
