import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, rollersRun, runway, secretPocket, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  undercroft,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 4 — "Hopper Shallows"
 *
 * The hoppers' debut, and the act is shaped for them: a basin. The road
 * comes down off a bluff, spends its middle out on the tide flats — low,
 * wide, never level — and climbs the far bluff to finish. The flats are
 * where the coiled hoppers live, one to a pool, each leaping the same arc
 * forever: first three in shallow pools with nothing else about, then four
 * in deeper ones with a crystal hung in one arc, then mixed with clocked
 * traps. Nothing else is new.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill,
 *   loop      and the bluff's own loop takes that slope to the flats.
 *                                                            -- checkpoint
 *   knot      THE HOPPERS: three shallow pools, each arc drawn in rings.
 *   valley    the first fork: floor, ledge, or (rolled) the shield ledge;
 *             sand ripples beyond it.
 *   knot      four deeper pools; the crystal hangs in the third arc.
 *                                                            -- checkpoint
 *   sandbank  a hill with the sea cave under it (crystal, secret room),
 *   leap      and its far slope clears the tide pool.
 *   knot      hoppers either side of a clocked trap; a gallery beneath.
 *                                                            -- checkpoint
 *   valley 2  the signature: the long kicker valley that climbs OUT of the
 *             basin — the upper ledge (crystal) wants the whole descent.
 *   terraces  up the far bluff, a hopper on the middle step.   -- checkpoint
 *   home      a pocket in the clifftop, the plunge down its back, swells,
 *             the signpost.
 *
 * ROADS: the middle road is the flats. The high road is the catwalks strung
 * between the two bluffs, kept by whoever the kickers threw; the low road is
 * the sandbank's cave and the gallery under the last knot.
 */
export const act04: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 4',
  title: 'Hopper Shallows',
  biome: 0,
  theme: 'verdant',
  width: 684,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 4 }); // down to row 26
    c = loopHill(b, c.endX, c.endRow, { drop: 8, up: 2, roof: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 12, checkpoint: true }); // a loop's landing is ground and rings
    const f1 = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 3, depth: 1, prize: 'rings10' }); // the debut: alone, on open sand
    c = launchValley(b, c.endX, c.endRow, { depth: 10, out: 6, crabs: 1, prize: 'shield' });
    const v1 = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 4, depth: 3, basin: 6 }); // the sand ripples: nothing on them but rings
    const f2 = c.endX;
    c = tideFlats(b, c.endX, c.endRow, { pools: 4, depth: 2, prize: 'crystal' }); // CRYSTAL 1 (over the third pool)
    b.checkpoint(c.endX - 1, c.endRow);
    const bank = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 10, prize: 'crystal', hazards: 1, secret: true }); // CRYSTAL 2 (cave), secret 1
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2 });
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 26, density: 1, period: 160 });
    b.hopper(g0 + 9, c.endRow); // the same arc as in the pools, now with a trap either side to read
    b.hopper(g0 + 18, c.endRow);
    b.spikeTrap(g0 + 15, c.endRow, 160, 80);
    const g1 = c.endX;
    b.checkpoint(g1 - 2, c.endRow);
    c = launchValley(b, c.endX, c.endRow, { depth: 8, basin: 12, out: 12, crabs: 2, prize: 'crystal' }); // CRYSTAL 3 (upper ledge)
    const st = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 3, tread: 8, guard: false });
    b.hopper(st + 14, c.endRow + 3); // the middle terrace's tenant
    b.checkpoint(c.endX - 3, c.endRow);
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 8 });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 2, crown: 6, depth: 2, basin: 6 });
    const home = c.endX;
    signpostFinish(b, c.endX, c.endRow, { len: 26 });

    /* ============================== HIGH ROAD ==============================
     * Bluff to bluff over the flats. A fall from it lands in a pool, and from
     * that height a hopper under your feet returns the whole drop.
     */
    highRoad(b, 34, f1 - 14, { monitors: ['rings10'], onRamp: true }); // over the bluff's loop: its roof is a drop from here. It stops short of the first pools — nobody is carried over the hoppers' debut
    highRoad(b, v1 + 2, f2 - 2, { droneEvery: 2, onRamp: true }); // on from the valley's ledges, over the ripples
    highRoad(b, f2 + 2, bank + 28, { crumbleEvery: 3, crystal: true, monitors: ['rings10', 'shield'], onRamp: true }); // CRYSTAL 4 — over the deep pools and the sandbank
    droneBridge(b, bank + 32, { drones: 4, prize: 'rings10', onRamp: true }); // off its crown, over the leap
    highRoad(b, g0 - 2, g1 + 4, { droneEvery: 2, onRamp: true }); // over the last knot
    highRoad(b, st - 22, home - 6, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // up the far bluff over its terraces, then off it over the swells: the last of the height

    /* =============================== LOW ROAD ==============================
     * The gallery under the last knot. Holds the third secret.
     */
    lowRoad(b, g0 + 1, g1 - 1, { shafts: [g0 + 4], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
