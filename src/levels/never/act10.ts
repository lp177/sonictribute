import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, canopyRun, hazardGauntlet, phaseCrossing } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, loopHill, plunge, longJump, undercroft, springCliff, highRoad, lowRoad } from '../sections.ts';
import { cartDrop, hollowHall, lightBridge, loopWalk, onRamp, railDescent, railLift, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 10 — "Vault of No Hours" — the biome finale.
 *
 * No hour at all: every clock in the act runs at the fastest speed the biome
 * has used, and nothing here is asked alone. The first rail runs under a
 * roof of spikes. The hall has a trap in its lower floor as well as a roof
 * over its upper one. The cart's chasm is the widest yet, the light sweeps
 * instead of blinking, and the last pit of light is crossed with the ceiling
 * coming down. It is still all telegraphed — the difficulty is tempo, never
 * ambush — and the roads still fork: the galleries under the two hardest
 * knots are the way through for anyone who would rather read than react.
 * The act falls, is hauled back up, falls further, is sprung to the top one
 * last time, and then falls all the way to the vault door.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a slope to a lip.
 *   rail      the grind — under a loft of spikes, crabs in the chasm.
 *   knot      a roofed hall: three panes, four spikes, a trap below.
 *                                                            -- checkpoint
 *   lift      hauled up by a rail,
 *   loop      down through the loop (a crystal on its roof),
 *   cart      and off the brink: the widest chasm, nine rows of fall.
 *   knot      six spans of travelling light on the fast clock.
 *                                                            -- checkpoint
 *   valley    the deep one: floor, ledge, crystal ledge.
 *   knot      the hardest road in the biome; a trapped gallery under it.
 *   cliff     sprung up for the last time.                   -- checkpoint
 *   hill      a hill, the deepest cave, a crystal,
 *   leap      and off its far slope over the trap pit.
 *   knot      nine tiles of light under a falling roof.
 *   THE DESCENT
 *             a plunge into a loop into the longest rail of the act: sixty
 *             columns without a hazard, straight to the vault door.
 *   arena     the Shard Drill, enraged.
 *
 * ROADS: the middle road is the ground. The high road is the catwalks over
 * the rails, the hall's roof, the bail ledge, the valley's ledges and the
 * ledges stamped below — drones in every other gap. The low road is the
 * lower hall, the chasm and pit floors, the gallery under the hard road and
 * the cave under the hill.
 */
export const act10: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 10',
  title: 'Vault of No Hours',
  biome: 2,
  theme: 'crystal',
  width: 756,
  height: WORLD_ROWS,
  bossKind: 'shard',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // 0–29, down to row 26
    const r0 = c.endX;
    const loft = c.endRow - 10;
    c = railDescent(b, c.endX, c.endRow, { span: 36, drop: 8, pit: 6, crabs: 2, prize: 'shield', runout: 12 });
    // The loft over the first rail: its spikes come down in the chasm behind the rider.
    b.slab(r0 + 12, r0 + 40, loft, 2);
    for (let i = 0; i < 5; i++) b.stalactite(r0 + 15 + i * 6, loft + 1);
    c = hollowHall(b, c.endX, c.endRow, { len: 46, panes: 3, period: 150, spikes: 5, crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 1
    b.checkpoint(c.endX - 3, c.endRow);
    c = railLift(b, c.endX, c.endRow, { rise: 14, span: 22, top: 8 });
    loopWalk(b, c.endX, c.endRow, 7); // from the clifftop onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 7, up: 2, roof: 'crystal' }); // CRYSTAL 1 (the loop's roof)
    c = cartDrop(b, c.endX, c.endRow, { span: 24, drop: 9, pit: 8, crabs: 2, prize: 'crystal', runout: 16 }); // CRYSTAL 2 (bail ledge)
    const k2 = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 140, sweep: true, pit: 7, crabs: 2, prize: 'rings10' });
    // The way round the light: a catwalk a jump above the near bank, a drone in every gap.
    canopyRun(b, k2 + 1, c.endRow - 5, { len: 34 });
    b.drone(k2 + 11, c.endRow - 8, 1);
    b.drone(k2 + 24, c.endRow - 8, 1);
    b.checkpoint(c.endX - 3, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 12, basin: 16, out: 10, crabs: 2, prize: 'crystal' }); // CRYSTAL 3 (upper ledge)
    const k3 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 38, density: 3, period: 130 });
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 8 });
    b.checkpoint(c.endX - 3, c.endRow);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 12, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 4 (cave), secret 2
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2, pit: 'trap' });
    const k4 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 });
    // The roof over the light: armed as you step onto the first span.
    b.slab(k4 + 2, k4 + 16, c.endRow - 8, 2);
    for (const dx of [5, 8, 11, 14]) b.stalactite(k4 + dx, c.endRow - 7);
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 12 });
    loopWalk(b, c.endX, c.endRow, 6);
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'shield' });
    c = railDescent(b, c.endX, c.endRow, { span: 60, drop: 4, pit: 5, crabs: 0, prize: 'rings10', runout: 10 }); // the last rail: nothing under it but rings
    arenaApproach(b, c.endX, c.endRow, { width: 40 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, k3 + 2, k3 + 38, { droneEvery: 2, crumbleEvery: 3, monitors: ['shield'] }); // over the hard road
    onRamp(b, hill + 4);
    highRoad(b, hill + 8, hill + 92, { span: 10, gap: 4, droneEvery: 2, crystal: true }); // CRYSTAL 5 — over the hill and the leap

    /* =============================== LOW ROAD ==============================
     * The gallery under the hard road is trapped too — but one clock at a
     * time is easier to read than five.
     */
    lowRoad(b, k3 + 1, k3 + 30, { shafts: [k3 + 7], crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
