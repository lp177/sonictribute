import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { phaseCrossing, signpostFinish } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, loopHill, plunge, longJump, springCliff, highRoad } from '../sections.ts';
import { hollowHall, lightBridge, loopWalk, railDescent, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 7 — "Hollow Hour Halls"
 *
 * The halls are built in pairs, one over the other, and the floor between
 * them is hard light: panes let into the upper hall's floor that are there
 * for half of every clock and gone for the rest. So the act's two roads are
 * not side by side, they are the SAME road seen at two times — cross a pane
 * lit and you stay up; cross it dark and you are in the lower hall, with its
 * own loot, its own crabs and a spring lift at the far end. From the second
 * hall on there is a roof as well, and stalactites hang over the panes: Act
 * 2's rule (keep moving) set directly against Act 4's (wait for the light).
 * Between halls the act is steep and short — the terraces of a building, not
 * the hills of a cave.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a long first slope.
 *   hall 1    knot: open to the sky, two panes on a slow clock.
 *   valley    floor, ledge, crystal ledge; it climbs out higher than it
 *             went in.                                       -- checkpoint
 *   hall 2    knot: roofed, three panes, a spike over each. Secret below.
 *   plunge    off the terrace,
 *   leap      into a long jump over a trap pit.
 *   knot      a plain pit of light (the old kind).           -- checkpoint
 *   cliff     sprung up,
 *   loop      through the loop.
 *   hall 3    knot: a faster clock, a trap in the lower hall, a crystal.
 *   plunge    down a terrace.
 *   knot      a bridge of travelling light, a crystal over it.
 *                                                            -- checkpoint
 *   cliff     sprung up to the top terrace.
 *   THE GREAT HALL
 *             knot: four panes on the fastest clock, six spikes, two crabs
 *             and a crystal below.
 *   rail      out of the halls by the long rail,
 *   home      one more loop, the last terrace, the signpost.
 *
 * ROADS: the middle road is the upper halls. The high road is their roofs
 * and the ledges between; the low road is the lower halls and the pit
 * floors.
 */
export const act07: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 7',
  title: 'Hollow Hour Halls',
  biome: 2,
  theme: 'crystal',
  width: 718,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 26, { drop: 5 }); // 0–31, down to row 31
    c = hollowHall(b, c.endX, c.endRow, { len: 38, panes: 2, period: 220, crabs: 0, prize: 'rings10' }); // hall 1: the lesson
    c = valley(b, c.endX, c.endRow, { depth: 10, basin: 18, out: 12, crabs: 1, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    b.checkpoint(c.endX - 3, c.endRow);
    const h2 = c.endX;
    c = hollowHall(b, c.endX, c.endRow, { len: 40, panes: 3, period: 180, spikes: 3, crabs: 1, prize: 'shield', secret: true }); // hall 2 — secret 1
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 18 });
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2, pit: 'trap' });
    const k3 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 });
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 13, top: 8 });
    loopWalk(b, c.endX, c.endRow, 6); // from the clifftop onto the loop's roof, and on to hall 3's
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 3, roof: 'rings10' });
    c = hollowHall(b, c.endX, c.endRow, { len: 44, panes: 3, period: 160, spikes: 4, crabs: 1, traps: 1, prize: 'crystal', secret: true }); // hall 3 — CRYSTAL 2, secret 2
    const p3 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 7, runout: 16 });
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 170, sweep: true, pit: 6, crabs: 1, prize: 'crystal' }); // CRYSTAL 3 (over the travelling light)
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 });
    c = hollowHall(b, c.endX, c.endRow, { len: 50, panes: 4, period: 150, spikes: 6, crabs: 2, traps: 1, prize: 'crystal', secret: true }); // THE GREAT HALL — CRYSTAL 4, secret 3
    c = railDescent(b, c.endX, c.endRow, { span: 52, drop: 10, pit: 6, crabs: 2, prize: 'crystal', runout: 10 }); // CRYSTAL 5 (catwalk)
    loopWalk(b, c.endX, c.endRow, 6); // off the rail's landing onto the last loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'shield' });
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 24 });
    signpostFinish(b, c.endX, c.endRow, { len: 40 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, 34, 68, { lift: 9, monitors: ['rings10'] }); // over hall 1, where there is no roof to run on
    highRoad(b, h2 + 40, k3 + 16, { droneEvery: 3, crumbleEvery: 3, monitors: ['rings10'] }); // off hall 2's roof, over the plunge, the leap and the pit
    highRoad(b, p3 - 6, p3 + 20, { droneEvery: 2, monitors: ['shield'] }); // off hall 3's roof and down the terrace
  },
};
