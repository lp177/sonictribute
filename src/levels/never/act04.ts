import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { canopyRun, phaseCrossing, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  longJump,
  undercroft,
  springCliff,
  tubeShot,
  highRoad,
} from '../sections.ts';
import { alcove, lightBridge, loopWalk, onRamp, railDescent, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 4 — "Phaselight Gallery"
 *
 * Hard light: floors that are only there half the time, and always say so
 * before they go. The act is a W — two deep valleys between three high
 * plateaus — and the plateaus are the gallery: every one of them ends at a
 * gap that only light crosses. Speed is no use on a bridge that is not lit,
 * so the knots here ask for the opposite of the valleys: wait, read, step.
 * And the light is not only an obstacle. It is hung over the second valley
 * as a road of its own, under a long jump as a net, and up a cliff as a
 * stair to a crystal — if you trust it.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a slope.
 *   lesson    knot: one pit, two spans, a slow clock.
 *   valley    the first deep one: floor, ledge, crystal ledge.  -- checkpoint
 *   knot      a bridge of three spans (a brave jump still clears it).
 *   cliff     sprung up — and a stair of light climbs on from the clifftop
 *             to a crystal that the spring alone does not reach.
 *   loop      down the plateau's far side through the loop.
 *   knot      six spans — too far to jump — on a faster clock; an alcove
 *             under the near bank.
 *                                                               -- checkpoint
 *   rail      off the plateau by the grind rail,
 *   leap      and into a long jump with a net of light under it,
 *   hill      and over the hill, a crystal cave beneath.
 *   knot      the wide pit, nine tiles on two spans.
 *   cliff     sprung up to the last plateau.                    -- checkpoint
 *   gallery   the second valley — and a road of light laid level across
 *             its descent, straight to the ledges.
 *   THE SWEEP knot: six spans lit in sequence. Walk with the light.
 *   home      the tube out of the gallery, one last loop, the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the valleys'
 * ledges, the light over valley 2 and the catwalks stamped below; the low
 * road is every pit floor under a bridge, and the cave under the hill.
 */
export const act04: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 4',
  title: 'Phaselight Gallery',
  biome: 2,
  theme: 'crystal',
  width: 714,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 26); // 0–29, down to row 30
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 6, period: 220 }); // the lesson
    c = valley(b, c.endX, c.endRow, { depth: 13, out: 9, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    b.checkpoint(c.endX - 3, c.endRow);
    const k2 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { spans: 3, period: 200, prize: 'rings10' });
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 8 });
    // The stair of light: two blinking steps on from the clifftop, then a ledge.
    const top = c.endRow;
    b.phasePlatform(c.endX - 6, c.endX - 4, top - 3, 200, 0);
    b.phasePlatform(c.endX - 2, c.endX, top - 6, 200, 100);
    b.platform(c.endX + 2, c.endX + 6, top - 9);
    b.crystal(c.endX + 4, top - 11); // CRYSTAL 2
    loopWalk(b, c.endX, c.endRow, 7); // from the clifftop, under the stair of light, onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 7, up: 3, roof: 'shield' });
    const k3 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 180, pit: 7, crabs: 1, prize: 'rings10' });
    // The way round the light: a catwalk a jump above the near bank, its gaps guarded.
    canopyRun(b, k3 + 1, c.endRow - 5, { len: 34 });
    b.drone(k3 + 11, c.endRow - 8, 1);
    b.drone(k3 + 24, c.endRow - 8, 1);
    alcove(b, k3, k3 + 3, c.endRow + 7); // secret 1: back under the near bank
    b.monitor(k3 + 1, c.endRow + 7, 'shield');
    b.checkpoint(c.endX - 3, c.endRow);
    const r0 = c.endX;
    c = railDescent(b, c.endX, c.endRow, { span: 32, drop: 9, pit: 5, crabs: 1, prize: 'rings10', runout: 12 });
    const j0 = c.endX;
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2 });
    // The net: miss the jump while it is lit and you walk the rest.
    b.phasePlatform(j0 + 13, j0 + 18, c.endRow, 180, 0);
    b.phasePlatform(j0 + 19, j0 + 24, c.endRow, 180, 90);
    const h = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 9, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 2
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 });
    c = springCliff(b, c.endX, c.endRow, { rise: 13, top: 8 });
    b.checkpoint(c.endX - 3, c.endRow);
    const v2 = c.endX;
    const rim = c.endRow;
    c = valley(b, c.endX, c.endRow, { depth: 10, basin: 8, out: 10, crabs: 2, prize: 'rings10' });
    // THE GALLERY: a level road of light out over the valley's descent, a
    // hop above the rim. It ends over the lower ledge.
    for (let i = 0; i < 7; i++) b.phasePlatform(v2 + 6 + i * 5, v2 + 9 + i * 5, rim - 2, 180, (i % 2) * 90);
    b.ringsH(v2 + 7, v2 + 38, rim - 4);
    const k5 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 160, sweep: true, pit: 8, crabs: 2, prize: 'shield' }); // THE SWEEP
    alcove(b, k5, k5 + 3, c.endRow + 8); // secret 3
    b.crystal(k5 + 1, c.endRow + 6); // CRYSTAL 4
    c = tubeShot(b, c.endX, c.endRow, { drop: 7, runout: 32, top: 'crystal' }); // CRYSTAL 5 (on the bluff)
    loopWalk(b, c.endX, c.endRow, 6); // off the landing strip onto the last loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 5, roof: 'rings10' });
    signpostFinish(b, c.endX, c.endRow, { len: 30 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, 32, 66, { lift: 9 }); // over the lesson: a way to watch the clock from above
    highRoad(b, k2 - 4, k2 + 22, { droneEvery: 2, monitors: ['rings10'] }); // over the first bridge: the way round it
    onRamp(b, h + 4);
    highRoad(b, h + 8, h + 58, { span: 12, gap: 3, droneEvery: 2, monitors: ['rings10'] }); // over the hill, its cave two roads below
    highRoad(b, r0 + 40, h + 2, { crumbleEvery: 3 }); // over the rail's landing and the leap
  },
};
