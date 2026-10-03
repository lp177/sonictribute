import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, hazardGauntlet, runway, secretPocket } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  undercroft,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { crumbleSpan, gliderBay, reefBowl, thermalCliff, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 6 — "Duskgate Bastion"
 *
 * The mid-biome check: the Wrecking Pod holds the gate, and the gate is at
 * the top. Everything the coast has taught gets one rep on the way — the
 * wing over the moat, the hoppers in the outer flats, the pendulums at the
 * gatehouse, the bowl as a way up — and the act is shaped like the siege it
 * is: down across the low ground, then up the wall by every means there is.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill to the brink of
 *   the moat  the wing, again: off the lip, up the thermal, onto the roost.
 *             Or the moat floor, and the climb.               -- checkpoint
 *   knot      three tide pools, three hoppers.
 *   valley    the outer ward: the kicker valley (crystal on the upper ledge).
 *   knot      the gatehouse — a hopper, two clocked traps, a pendulum pair
 *             overhead; the sally-port gallery beneath (crystal, secret
 *             room).                                          -- checkpoint
 *   headland  the last low ground, a cave under it (crystal, secret room),
 *   bridge    the drawbridge its far slope carries you over,
 *   plunge    the ditch,
 *   bowl      and the signature: the bowl at the foot of the wall, which
 *             throws you ten rows up it (crystal over the landing).
 *                                                            -- checkpoint
 *   terraces  the wall's own steps,
 *   tower     the wind up the keep (crystal on the perch),
 *   gate      a pocket of armour, the gate loop — and the arena.
 *
 * ROADS: the middle road is the siege line. The high road is the roost, the
 * wall-walk catwalks and the keep's perch; the low road is the moat floor,
 * the sally port and the headland's cave.
 */
export const act06: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 6',
  title: 'Duskgate Bastion',
  biome: 0,
  theme: 'verdant',
  width: 630,
  height: WORLD_ROWS,
  bossKind: 'pod',
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 26, { drop: 4 }); // down to row 30
    c = gliderBay(b, c.endX, c.endRow, { width: 56, depth: 10, out: 6, crabs: 2, prize: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true }); // the far shore: where the roost sets a wing down
    const ward = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 3, depth: 2, prize: 'shield' });
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 8, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge)
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 2, period: 150 });
    b.swingBall(g0 + 9, c.endRow - 11, 8, 150, 0); // the gatehouse pair: counter-phased, so one is always clear
    b.swingBall(g0 + 21, c.endRow - 11, 8, 150, 75);
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const g1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 10, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (cave), secret 1
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 4, crab: true });
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 4 });
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 10, lift: 10, prize: 'crystal' }); // CRYSTAL 3 (shelf over the wall)
    const wall = c.endX;
    b.checkpoint(c.endX - 4, c.endRow);
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4, tread: 8 });
    c = thermalCliff(b, c.endX, c.endRow, { rise: 6, top: 4, prize: 'crystal' }); // CRYSTAL 4 (keep's perch)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2: armour for the fight
    const gate = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 26 });
    arenaApproach(b, c.endX, c.endRow, { width: 44 });

    /* ============================== HIGH ROAD ==============================
     * The wall-walk. From the roost over the outer ward, and again along the
     * top of the wall to the gate loop, whose roof is a drop from it.
     */
    highRoad(b, ward - 12, g0 - 80, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // on from the roost, over the pools, to the valley's brink
    highRoad(b, g0 - 4, g1 + 30, { droneEvery: 3, monitors: ['shield'], onRamp: true }); // over the gatehouse, up the headland
    droneBridge(b, g1 + 34, { drones: 3, prize: 'rings10', onRamp: true }); // off its crown, toward the wall
    highRoad(b, wall - 8, gate + 74, { crumbleEvery: 3, droneEvery: 3, monitors: ['rings10'], onRamp: true }); // the top of the wall, to the gate

    /* =============================== LOW ROAD ==============================
     * The sally port under the gatehouse: in by the shaft at its head, out by
     * the springs past its end. Holds the third secret.
     */
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 5], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
