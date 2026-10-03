import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { arenaApproach, boardSprint, cartCanyon, hazardGauntlet, phaseCrossing, railCascade, stalactiteGallery } from '../motifs.ts';
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
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { lightBridge, lightStair, ribbon, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 760;

/**
 * NOON TOMORROW — ACT 10 — "The Unstruck Noon"
 *
 * The finale: the widest act in the game and everything it taught, on the
 * tightest clocks. Its shape is the clock tower itself. The first half sinks
 * to the foot of it and climbs — valley, hard light, a hill, rails, a leap, a
 * cart, then three flights up through the bridge of light and the gauntlet to
 * the summit roofs. The second half is the way down, and it is ONE run: a
 * ribbon off the summit, the Mag-Board waiting where it sets you down, and
 * then nothing but slope, awning and tunnel until the board is taken from you
 * at the gate, where the Mirage has stopped being patient.
 *
 * BEATS:
 *   opening    a safe apron tips downhill.
 *   valley     roll it: the upper ledge's rail climbs over the next knot.
 *   knot       hard light on the 2-second clock.                -- checkpoint
 *   hill       over it or through its vault (crystal),
 *   knot       a cascade of rails off its far slope,
 *   leap       the gap they feed,
 *   knot       and the cart at the foot of the tower.
 *   flight 1   sprung up — or up the stair of light.            -- checkpoint
 *   knot       the bridge of light.
 *   flight 2   a second spring.
 *   knot       the last gauntlet, a bridge of drones over it,
 *   arch       and the loop on the tower's shoulder.
 *   knot       the summit roofs, their catwalk crumbling.       -- checkpoint
 *   THE WAY DOWN
 *   ribbon     off the summit (a crystal over the rail),
 *   knot       onto the board: one pad, one pit,
 *   drop       down the tower face,
 *   knot       under the awning before its spikes can fall,
 *   tunnel     and out through the last bluff into the plaza.
 *
 * ROADS: the middle road is the ground. The high road is the rail and
 * catwalks over the first half, the stair, the drones and the summit catwalk;
 * the low road is the valley floors, the vault, the gallery under the
 * gauntlet and the street under the summit. They converge on the way down.
 */
export const act10: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 10',
  title: 'The Unstruck Noon',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  bossKind: 'mirage',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 26); // → row 30
    const lip = c.endX + 4 + 28 + 10 + 5; // first column past the valley's kicker
    c = launchValley(b, c.endX, c.endRow, { depth: 14, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge) → row 32
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 });
    b.checkpoint(c.endX - 2, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 16, down: 12, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (vault), secret 1 → row 36
    c = railCascade(b, c.endX, c.endRow, { steps: 2, dropEach: 2 }); // → row 40
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 0, pit: 'trap' });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 });
    const f1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 6 }); // FLIGHT 1 → row 28
    b.checkpoint(c.endX - 2, c.endRow);
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 12, period: 130, hazards: 2, prize: 'shield' });
    const f2 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 8, top: 12 }); // FLIGHT 2 → row 20, the tower's shoulder
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 3, period: 120 });
    const g1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 4, roof: 'rings10' });
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, 2, -2, 3, -1], depth: 10, crabs: 2, droneEvery: 2, room: 'crystal', secret: true }); // CRYSTAL 3, secret 2 → row 22
    const r1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);

    // THE WAY DOWN — one run, summit to gate.
    c = skyRail(b, c.endX, c.endRow, { drop: 8, len: 60, depth: 14, hoppers: 2, prize: 'rings10', crystal: true, runout: 8 }); // CRYSTAL 4 → row 30
    const ramp = c.endX;
    c = boardSprint(b, c.endX, c.endRow, { sections: 1, board: true });
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 4 }); // → row 38
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 5 });
    c = roofedTube(b, c.endX, c.endRow, { drop: 6, runout: 33, top: 'shield' }); // → row 44
    b.boardEnd(c.endX + 2); // the board is taken at the gate: the fight is on foot
    c = arenaApproach(b, c.endX, c.endRow, { width: W - c.endX }); // 56 columns: the plaza takes whatever the act leaves
    if (c.endX !== W) throw new Error(`act10 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ============================== */
    // The valley's upper ledge is a station: its rail climbs over the hard
    // light to the catwalk that crosses the hill.
    b.platform(h0 + 2, h0 + 9, 22);
    ribbon(b, lip + 37, 33, h0 + 2, 22);
    highRoad(b, h0 + 13, f1 - 18, { span: 11, gap: 3, crumbleEvery: 4, droneEvery: 3, monitors: ['rings10'] }); // over the hill, the cascade, the leap and the cart
    // Light beside flight 1, the catwalk over the bridge, drones over the gauntlet.
    const s = lightStair(b, f1 - 16, 40, { steps: 6, period: 130, ledge: 6, prize: 'rings10' }); // to row 19
    highRoad(b, s.endX + 3, f2 - 2, { lift: 9, crumbleEvery: 4 });
    c = droneBridge(b, g0 + 1, { drones: 3, prize: 'crystal' }); // CRYSTAL 5
    b.spring(g0 - 4, 20, 11);
    highRoad(b, r0 + 2, r1 + 4, { lift: 9, span: 10, crumbleEvery: 4, droneEvery: 2, monitors: ['rings10', 'shield'] }); // the summit catwalk
    b.spring(r0 - 3, 20, 10);
    highRoad(b, ramp - 6, ramp + 16, { monitors: [] }); // one last deck, over the on-ramp

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 2, prize: 'rings10', secret: true }); // secret 3
  },
};
