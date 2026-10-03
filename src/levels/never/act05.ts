import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, canopyRun, cartCanyon, hazardGauntlet, phaseCrossing, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  longJump,
  undercroft,
  springCliff,
  tubeShot,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { alcove, cartDrop, lightBridge, loopWalk, onRamp, railDescent, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 5 — "Shardheart Lock" — the mid-biome boss check.
 *
 * The exam. Everything the first four acts taught is asked once each, in the
 * order it was taught — rail, spikes, cart, light — and then asked again
 * harder: the cart dives, and the last light is crossed under a roof that is
 * falling. The Lock itself is at the very bottom of the act, so its shape is
 * the steepest in the biome: twice hauled back up a cliff, and both times
 * spent straight back down. The last drop is a tube that fires you at the
 * arena door.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a slope to a lip.
 *   Q1 rail   the grind down, a shield over it, an alcove under the lip.
 *   Q2 spikes knot: the flat gallery.                        -- checkpoint
 *   cliff     sprung up,
 *   loop      down through the loop (a crystal on its roof),
 *   leap      and over the trap pit on what the loop gave you.
 *   Q3 cart   knot: the flat canyon and its buffer.
 *   valley    floor, ledge, upper ledge.                     -- checkpoint
 *   Q4 light  knot: six spans, a crystal over the middle.
 *   hill      a hill, a crystal cave under it.
 *   knot      the trapped road, a gallery beneath.           -- checkpoint
 *   cliff     sprung up for the last time.
 *   Q3 again  the cart that dives: a crystal on the bail ledge.
 *   Q2 + Q4   knot: a pit of light under a roof of spikes. The roof says go,
 *             the light says wait.
 *   THE LOCK  one unbroken line to the door: a second loop, the long rail
 *             with crabs under it, and the tube that fires you at the arena.
 *   arena     the Shard Drill.
 *
 * ROADS: the middle road is the ground. The high road is the catwalk over
 * the rail, the valley's ledges, the bail ledge and the catwalks stamped
 * below; the low road is the chasm and pit floors, the cave under the hill
 * and the gallery under the trapped road.
 */
export const act05: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 5',
  title: 'Shardheart Lock',
  biome: 2,
  theme: 'crystal',
  width: 716,
  height: WORLD_ROWS,
  bossKind: 'shard',
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24); // 0–29, down to row 28
    const r0 = c.endX;
    c = railDescent(b, c.endX, c.endRow, { span: 30, drop: 8, pit: 5, crabs: 1, prize: 'shield', runout: 12 }); // Q1
    alcove(b, r0 + 1, r0 + 5, c.endRow + 5); // secret 1: step off the lip, and it is behind you
    b.monitor(r0 + 2, c.endRow + 5, 'rings10');
    const g1 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 4 }); // Q2
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 13, top: 8 });
    const l0 = c.endX;
    loopWalk(b, c.endX, c.endRow, 6); // from the clifftop onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'crystal' }); // CRYSTAL 1 (the loop's roof)
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2, pit: 'trap' });
    const k3 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // Q3
    c = valley(b, c.endX, c.endRow, { depth: 12, basin: 14, out: 8, crabs: 2, prize: 'rings10' });
    b.checkpoint(c.endX - 3, c.endRow);
    const k4 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 170, pit: 7, crabs: 1, prize: 'crystal' }); // Q4 — CRYSTAL 2
    // The way round the light: a catwalk a jump above the near bank, its gaps guarded.
    canopyRun(b, k4 + 1, c.endRow - 5, { len: 34 });
    b.drone(k4 + 11, c.endRow - 8, 1);
    b.drone(k4 + 24, c.endRow - 8, 1);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 7, crown: 10, down: 10, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 2
    const k5 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 2 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 8 });
    c = cartDrop(b, c.endX, c.endRow, { span: 22, drop: 8, pit: 7, crabs: 2, prize: 'crystal', runout: 16 }); // CRYSTAL 4 (bail ledge)
    const k6 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 });
    // The roof over the light: armed as you step onto the first span.
    b.slab(k6 + 2, k6 + 15, c.endRow - 8, 2);
    for (const dx of [5, 8, 11]) b.stalactite(k6 + dx, c.endRow - 7);
    const l1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 7, up: 3, roof: 'rings10' });
    c = railDescent(b, c.endX, c.endRow, { span: 42, drop: 6, pit: 6, crabs: 2, prize: 'rings10', runout: 8 }); // Q1 again, at full length
    c = tubeShot(b, c.endX, c.endRow, { drop: 6, runout: 30, top: 'shield' });
    arenaApproach(b, c.endX, c.endRow, { width: 36 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, g1 - 4, g1 + 20, { lift: 13, monitors: ['rings10'] }); // over the gallery's roof
    highRoad(b, l0 + 46, l0 + 78, { droneEvery: 3, monitors: ['rings10'] }); // on from the shelf past the loop, over the leap
    highRoad(b, k3 + 2, k3 + 30, { droneEvery: 2 }); // over the canyon: the way round the buffer
    onRamp(b, hill + 6);
    highRoad(b, hill + 10, hill + 56, { droneEvery: 2, crystal: true }); // CRYSTAL 5 — over the hill
    highRoad(b, k5 + 2, k5 + 30, { droneEvery: 2, monitors: ['shield'] }); // over the trapped road
    highRoad(b, l1 + 2, l1 + 48, { lift: 14, crumbleEvery: 3 }); // over the last loop

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, k5 + 1, k5 + 23, { shafts: [k5 + 7], crabs: 1, prize: 'rings10', secret: true }); // secret 3 — the lift comes up short of the hopper
  },
};
