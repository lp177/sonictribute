import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { arenaApproach, hazardGauntlet, runway, secretPocket } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  plunge,
  undercroft,
  tubeShot,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { crumbleSpan, reefBowl, thermalCliff, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 11 — "Last Light Seawall"
 *
 * The biome finale, and the wall is the level: it starts on top of the
 * seawall, goes straight down its face, runs the foreshore at the foot —
 * the fastest ground in the biome — and then has to get back up, because
 * the Wrecking Pod's gate is on the far parapet. Everything Duskmere taught
 * is here once, at its hardest, and two things are here that are nowhere
 * else: two loops back to back, and a bowl that throws you into a bowl.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the wall's top, the wing on the parapet over it,
 *   plunge    and the whole face of the seawall, twelve rows, into
 *   valley    the kicker valley at its foot: the first fork — or, from the
 *             parapet, a glide clean over both —
 *   leap      and the widest tide pool on the coast, for the speed that is
 *             left.
 *   knot      the full gauntlet: three clocked traps, a hopper, a pendulum;
 *             a gallery beneath (crystal, secret room).       -- checkpoint
 *   loops     two, back to back, the second fed by the first's exit.
 *   knot      three tide pools, a hopper and a clocked trap in each.
 *   buttress  the hill against the wall, a cave under it (crystal, secret).
 *   bowls     the signature: its far slope into a bowl whose fling sets you
 *             down at the brink of a second, which throws you ten rows up
 *             the wall (crystal over the landing).            -- checkpoint
 *   knot      the breach: rotten decking under a pendulum pair.
 *   tower     the sea wind up to the parapet (crystal on the perch); a
 *             pocket of armour.
 *   knot      the wall-walk: two clocked traps, a hopper, a pendulum.
 *   home      the tunnel through the last bastion: fired out of it onto
 *             the run to the gate.
 *
 * ROADS: the middle road is the wall, down and up. The high road is the
 * parapet — the glide off it at the start, catwalks over the knots, drone
 * bridges where the wall is broken; the low road is the gallery under the
 * gauntlet, the buttress's cave and the hollow reefs past the bowls.
 */
export const act11: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 11',
  title: 'Last Light Seawall',
  biome: 0,
  theme: 'verdant',
  width: 734,
  height: WORLD_ROWS,
  bossKind: 'pod',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 4 }); // along the top of the wall, down to row 26
    const wallTop = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 4 });
    c = launchValley(b, c.endX, c.endRow, { depth: 8, out: 8, crabs: 2, prize: 'shield' });
    c = longJump(b, c.endX, c.endRow, { gap: 16, fall: 0, pit: 'trap' }); // the widest pool on the coast
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 3, period: 140 });
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const g1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'rings10' });
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 10, roof: 'crystal' }); // CRYSTAL 2 (second loop's roof)
    const f0 = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 3, depth: 2, prize: 'rings10' });
    for (let i = 0; i < 3; i++) b.spikeTrap(f0 + i * 16 + 11, c.endRow + 2, 140, i * 47); // a trap where each hop comes down
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, down: 6, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 2
    const b0 = c.endX;
    c = reefBowl(b, c.endX, c.endRow, { drop: 4, basin: 8, run: 36, prize: 'rings10' }); // a long reef: whoever drops off its shelf must land before the second bowl, not in it
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 10, lift: 10, prize: 'crystal' }); // CRYSTAL 4 (shelf over the wall)
    b.checkpoint(c.endX - 4, c.endRow);
    const d0 = c.endX;
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 6, crab: true });
    b.swingBall(d0 + 8, c.endRow - 11, 8, 140, 0);
    b.swingBall(d0 + 17, c.endRow - 11, 8, 140, 70);
    const d1 = c.endX;
    c = thermalCliff(b, c.endX, c.endRow, { rise: 8, top: 4, prize: 'crystal' }); // CRYSTAL 5 (perch)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 3: armour for the rematch
    const w0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 2, period: 140 });
    b.swingBall(w0 + 17, c.endRow - 11, 8, 140, 20); // the last pendulum, over the last stretch of wall
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 34, top: 'rings10' });
    arenaApproach(b, c.endX, c.endRow, { width: 44 });

    /* ============================== HIGH ROAD ==============================
     * The parapet. It starts as the one place the wing can be had: a ledge
     * over the wall's top, a jump up from it. Run off its end with jump held
     * and the whole face of the wall, and the valley at its foot, go by
     * underneath.
     */
    b.platform(wallTop - 6, wallTop + 6, 21);
    b.glider(wallTop + 3, 19);
    b.ringsH(wallTop - 4, wallTop + 1, 19);
    droneBridge(b, g0 - 32, { drones: 3, lift: 9, prize: 'rings10', onRamp: true }); // over the wide pool, for whoever kept the valley's height
    highRoad(b, g0 - 2, f0 - 2, { crumbleEvery: 4, droneEvery: 2, monitors: ['rings10', 'shield'], onRamp: true }); // over the gauntlet and both loops: their roofs are a drop from here
    highRoad(b, f0 + 2, h0 + 14, { crumbleEvery: 3, droneEvery: 2, monitors: ['rings10'], onRamp: true }); // over the pools, up the buttress
    droneBridge(b, h0 + 18, { drones: 4, prize: 'rings10', onRamp: true }); // off its crown, toward the bowls
    highRoad(b, d0 - 12, d1 + 2, { crumbleEvery: 3, droneEvery: 2, monitors: ['rings10'], onRamp: true }); // off the bowl's shelf, over the breach
    highRoad(b, w0 - 12, w0 + 22, { crumbleEvery: 3, droneEvery: 2, onRamp: true }); // over the wall-walk, to the bastion's roof

    /* =============================== LOW ROAD ==============================
     * The gallery under the gauntlet: the way round the rhythm, at the price
     * of a trap of its own.
     */
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 5], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 1, secret 1
    // The reefs the bowls throw you onto are hollow. The first one's lift
    // comes up under its own shelf, so it sets you down on the high road.
    lowRoad(b, b0 + 38, b0 + 58, { shafts: [b0 + 40], crabs: 0, traps: 1, prize: 'shield' });
    lowRoad(b, d0 - 26, d0 - 3, { shafts: [d0 - 24], crabs: 1, prize: 'rings10' });
  },
};
