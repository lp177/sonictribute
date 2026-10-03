import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, rollersRun, runway, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  LO,
  rollingStart,
  loopHill,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { alcove, hangingRoof, loopWalk, railDescent, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 2 — "Stalactite Choir"
 *
 * The roof is the act. A stalactite is armed by whoever passes under it and
 * falls a moment later, so on its own it says one thing — keep moving — and
 * the act is that sentence sung five times, each verse asking a little more:
 * first over a downhill (you could not stop if you tried), then on the flat,
 * then down in the dark where the ceiling is low, then over a crab that makes
 * you want to stop, and last over a grind rail, the whole choir coming down
 * in the chasm behind you.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a first slope.
 *   verse 1   a hill with a cave under it; the roof hangs over its far
 *             slope, so the first spikes fall behind a runner.
 *   verse 2   knot: the flat gallery, three spikes.          -- checkpoint
 *   valley    open sky again: floor, ledge, or the crystal ledge.
 *   verse 3   knot: one trap on the road — and the crypt under it, spikes
 *             on a ceiling you can touch.                    -- checkpoint
 *   cliff     sprung up to the loft,
 *   loop      and down its far side through the loop.
 *   verse 4   knot: the long gallery, five spikes.
 *   valley 2  out from under the roof and down; its climb-out feeds
 *   leap      the long jump over the crab pit.               -- checkpoint
 *   verse 5   a second hill, roofed from crown to foot: its crab patrols
 *             under the spikes. A crystal sits on the roof.
 *   stair     knot: three tall terraces up to the loft.      -- checkpoint
 *   THE CHOIR the rail under the choir loft — six spikes over the chasm, a
 *             crystal on the catwalk and another in the alcove under the
 *             lip, for whoever steps off it and walks the floor instead.
 *   the nave  one roof over a long downhill and the swell after it, eight
 *             spikes falling in your wake; then open air and the signpost.
 *
 * ROADS: the middle road is the ground. The high road is the roofs
 * themselves (a spring or a drop gets you on top) and the ledges between
 * them; the low road is the two caves, the crypt and the chasm floor.
 */
export const act02: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 2',
  title: 'Stalactite Choir',
  biome: 2,
  theme: 'crystal',
  width: 683,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24, { drop: 3 }); // 0–27, down to row 27
    const h1 = c.endX;
    const crown1 = c.endRow - 7;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 11, prize: 'rings10', hazards: 1 });
    const g1 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 }); // verse 2
    b.checkpoint(c.endX - 2, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 12, basin: 14, out: 9, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    const k2 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 26, density: 1 });
    const crypt = c.endRow + LO - 5; // the ceiling row of the gallery under this road
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 });
    loopWalk(b, c.endX, c.endRow, 7); // from the clifftop onto the loop's roof, and on toward the long gallery's
    c = loopHill(b, c.endX, c.endRow, { drop: 7, up: 3, roof: 'shield' });
    const g4 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 22, count: 5 }); // verse 4
    c = valley(b, c.endX, c.endRow, { depth: 10, basin: 8, out: 4, crabs: 1, prize: 'rings10', retrySpring: false }); // out of the gallery and down: the second valley
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 3, pit: 'crab' });
    b.checkpoint(c.endX - 3, c.endRow);
    const h2 = c.endX;
    const crown2 = c.endRow - 6;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 10, prize: 'shield', hazards: 2, secret: true }); // secret 1
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 5, tread: 7 });
    b.checkpoint(c.endX - 3, c.endRow);
    const r0 = c.endX;
    const loft = c.endRow - 10;
    c = railDescent(b, c.endX, c.endRow, { span: 44, drop: 10, pit: 6, crabs: 1, prize: 'crystal', runout: 12 }); // CRYSTAL 2 (catwalk)
    // The alcove under the lip: STEP off the lip instead of running it, and
    // you are on the chasm floor with the whole choir overhead; the pocket is
    // behind you.
    const chasm = c.endRow + 6;
    alcove(b, r0 + 1, r0 + 5, chasm); // secret 2
    b.crystal(r0 + 2, chasm - 2); // CRYSTAL 3
    const nave = c.endX;
    c = runway(b, c.endX, c.endRow, { drop: 9, len: 12 });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 2, crown: 6, depth: 2, basin: 6 });
    const door = c.endX;
    signpostFinish(b, c.endX, c.endRow, { len: 38 });

    /* ================================ ROOFS ================================
     * Stamped after the ground they follow. Verse 1 hangs over a downhill, so
     * its spikes cannot catch anyone moving; verse 5 hangs over a patrolled
     * crown, where they can.
     */
    hangingRoof(b, h1 + 32, h1 + 54, { spikes: 2 }); // verse 1: the first hill's far slope
    b.spring(h1 + 29, crown1, 10); // the way onto it, from the crown
    hangingRoof(b, h2 + 20, h2 + 52, { spikes: 4, prize: 'crystal' }); // verse 5 — CRYSTAL 4 on top of it
    b.spring(h2 + 18, crown2, 10);
    // THE CHOIR: a loft over the rail's chasm. Every spike is armed by the
    // rider passing under it and comes down in the chasm behind them.
    b.slab(r0 + 12, r0 + 48, loft, 2);
    for (let i = 0; i < 6; i++) b.stalactite(r0 + 15 + i * 6, loft + 1);
    hangingRoof(b, nave + 2, door + 4, { spikes: 8 }); // the nave: one roof, the whole way down

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, g1 + 20, g1 + 44, { monitors: ['rings10'] }); // from the gallery's roof out over the valley's descent
    highRoad(b, k2 + 2, k2 + 30, { droneEvery: 2, monitors: ['rings10'] }); // over the trapped road
    highRoad(b, g4 + 84, h2 - 4, { crumbleEvery: 3, crystal: true }); // CRYSTAL 5 — over the leap

    /* =============================== LOW ROAD ==============================
     * The crypt under the trapped road: the ceiling is a hand above your head
     * and it is strung with spikes. Do not stand still.
     */
    lowRoad(b, k2 + 1, k2 + 24, { shafts: [k2 + 7], crabs: 0, prize: 'rings10', secret: true }); // secret 3
    for (const dx of [11, 15, 19]) b.stalactite(k2 + dx, crypt);
  },
};
