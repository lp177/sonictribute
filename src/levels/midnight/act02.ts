import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, railCascade, rollersRun, runway, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  kicker,
  ringArc,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 2 — "Slaglight Causeway"
 *
 * A raised road over the slag channels, lit only by what runs in them. The
 * act's shape is a PLATEAU WITH CUTS: the causeway holds its height and the
 * channels are cut across it — each one a question of speed, each wider than
 * the last — with one long excursion down the grind rails to the channel bed
 * and back. First rails of the biome, first hopper; the needles return, three
 * of them now, under the causeway's arches.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      the apron tips onto the causeway.
 *   cut 1     the first channel is a valley: walk its bed, or fly it.
 *   knot      plates and the first hopper, a slag drain under them.
 *                                                          -- checkpoint
 *   cut 2     a leap, then the rails: three grinds down to the channel bed,
 *   bed       where the loop stands on its own slope.       -- checkpoint
 *   knot      needles under the arches,
 *   lift      and the spring back up to the causeway.       -- checkpoint
 *   humps     a rhythm of hills and dips (crystal on the catwalk over them).
 *   mound     the furnace mound and its cellar (crystal, secret) — whose far
 *   cut 3     slope is the run-up for the widest channel of the three.
 *   knot      a vault under the road (crystal, secret), then the terraces.
 *   slag jump the plunge and the kicker at its foot: out over the last
 *             channel to the signpost (crystal at the top of a rolled arc).
 */
export const midnight02: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 2',
  title: 'Slaglight Causeway',
  biome: 1,
  theme: 'gear',
  width: 614,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24, { drop: 3 }); // row 27: the causeway
    c = valley(b, c.endX, c.endRow, { depth: 9, out: 9, basin: 12, crabs: 1, prize: 'shoes' }); // cut 1: out as high as in
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 26, density: 2 }); // the first hopper
    const g1 = c.endX;
    b.checkpoint(c.endX + 1, c.endRow);
    c = longJump(b, c.endX, c.endRow, { gap: 11, fall: 0 }); // cut 2
    const r0 = c.endX;
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 6, span: 7, dropEach: 4 }); // the first rails: down to the bed, row 39
    c = loopHill(b, c.endX, c.endRow, { drop: 5, up: 2, roof: 'shield' }); // row 42
    const bed = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 }); // three needles under the arches
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // back on the causeway, row 30
    b.checkpoint(c.endX - 4, c.endRow);
    const h0 = c.endX;
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 3, crown: 6, depth: 3, basin: 6 });
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 9, prize: 'crystal', hazards: 2, secret: true }); // row 33; CRYSTAL 1, secret 1
    const j0 = c.endX;
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2, pit: 'crab' }); // cut 3: the mound's slope is the run-up
    c = vault(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 2, secret 2
    const t0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 4, tread: 7 }); // row 27
    b.checkpoint(c.endX - 2, c.endRow);
    // The slag jump: the plunge is the run-up, the kicker at its foot the
    // launch, and nothing waits on the landing but ground.
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 12 }); // row 37; the long foot is the retry run-up
    kicker(b, c.endX, c.endRow);
    const lip = c.endX + 5;
    b.floor(lip, lip + 43, c.endRow);
    ringArc(b, lip, c.endRow - 4, 7, -7, 7, 5);
    ringArc(b, lip, c.endRow - 4, 9, -9, 8, 5);
    b.crystal(lip + 11, c.endRow - 12); // CRYSTAL 3 — the top of a rolled arc, a row over a run one
    signpostFinish(b, lip + 44, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, g0 - 2, r0 - 4, { droneEvery: 3, monitors: ['rings10'] }); // over the plates and the second cut
    highRoad(b, bed + 2, bed + 28, { lift: 12, monitors: ['rings10'] }); // from the loop's exit onto the arches
    highRoad(b, h0 - 6, j0 - 12, { crumbleEvery: 4, crystal: true, monitors: ['shield'] }); // CRYSTAL 4 — over the humps and the mound
    c = droneBridge(b, j0 + 2, { drones: 3, prize: 'crystal' }); // CRYSTAL 5 — drones across the widest cut
    highRoad(b, c.endX + 6, t0 + 16, { monitors: ['rings10'] });

    /* =============================== LOW ROAD ==============================
     * The slag drain under the plates: its shaft is the first thing the
     * knot offers, its lift comes up at the lip of the second cut.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
