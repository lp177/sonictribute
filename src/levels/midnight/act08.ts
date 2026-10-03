import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { phaseCrossing, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  longJump,
  loopHill,
  undercroft,
  springCliff,
  stairClimb,
  tubeShot,
  highRoad,
  droneBridge,
} from '../sections.ts';
import { needleChute, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 8 — "Needle Roof Annex"
 *
 * The annex where the roof grew teeth. This is the act that happens INDOORS:
 * the road keeps going under things — gantry roofs that step downhill with
 * it, two flues it is fired out of — and what hangs from those roofs is the
 * needle, the biome's oldest machine, finally the star. A needle only ever
 * catches a hero who has stopped, so each roof is paired with a reason to
 * stop: first nothing (roll, and they fall behind you), then a patrolling
 * crab, then a hopper, and last a climb, jump by jump, with the roof coming
 * down. The roofs' tops are the high road. And between the needles, the
 * shift's new machine is shown once, safely: a hard-light crossing.
 *
 * BEATS (knot = tension, the rest is release):
 *   door      apron, then the first needle chute straight into
 *   valley    a valley: sixteen rows of descent under and past the roof.
 *   knot      a needle roof with a crab walking under it.   -- checkpoint
 *   hill      over it or through the store beneath (crystal, secret),
 *   flue      and through the first flue (secret on its top).
 *   knot      the first shift-change crossing, alone.       -- checkpoint
 *   lift      sprung up to the long roof:
 *   CHUTE     ten rows down under a needle in every bay (crystal on the
 *             roof), into the loop at its foot (crystal on ITS roof).
 *   knot      the densest roof, a hopper under it,          -- checkpoint
 *   terraces  and a climb under needles: no rolling away from these.
 *   valley 2  a vault (crystal), a leap whose run-up is under needles, a
 *             last valley (crystal up top),
 *   flue 2    and the flue that fires you out to the signpost.
 */
export const midnight08: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 8',
  title: 'Needle Roof Annex',
  biome: 1,
  theme: 'gear',
  width: 658,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 3 }); // row 25
    c = needleChute(b, c.endX, c.endRow, { drop: 8, every: 2 }); // row 33
    c = valley(b, c.endX, c.endRow, { depth: 8, out: 9, crabs: 1, prize: 'rings10' }); // row 32
    const n1 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 });
    b.enemy(n1 + 9, c.endRow, 4); // the reason to hesitate under the roof
    b.checkpoint(c.endX, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, down: 6, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 1, secret 1; row 30
    const f0 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 36, top: 'shield' }); // row 38
    b.secret(f0 + 3, c.endRow - 18, f0 + 12, c.endRow - 15); // secret 2 — the top of the flue
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 180 }); // the first hard-light crossing, alone
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // row 26
    const r0 = c.endX;
    c = needleChute(b, c.endX, c.endRow, { drop: 10, every: 1 }); // the long roof; row 36
    b.crystal(r0 + 12, c.endRow - 15); // CRYSTAL 2 — on the roof's stair, reached from the catwalk
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'crystal' }); // CRYSTAL 3
    const n2 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 22, count: 5 });
    b.hopper(n2 + 9, c.endRow);
    b.checkpoint(c.endX, c.endRow);
    const t0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 4, tread: 8 }); // row 28
    // One roof over both terraces, needles over each: the climb is slow, so
    // these are the needles that can actually catch you.
    b.slab(t0 + 3, t0 + 19, c.endRow - 7, 2);
    b.stalactite(t0 + 7, c.endRow - 6);
    b.stalactite(t0 + 11, c.endRow - 6);
    b.stalactite(t0 + 16, c.endRow - 6);
    c = vault(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 4, secret 3
    const j0 = c.endX;
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 0 });
    b.slab(j0, j0 + 9, c.endRow - 7, 2); // a needle roof over the run-up: no standing there to judge the leap
    b.stalactite(j0 + 3, c.endRow - 6);
    b.stalactite(j0 + 7, c.endRow - 6);
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 6, crabs: 2, prize: 'crystal' }); // CRYSTAL 5; row 32
    c = tubeShot(b, c.endX, c.endRow, { drop: 6, runout: 44, top: 'rings10' }); // row 38
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ==============================
     * Every roof is a road. Catwalks join them: onto the first gallery's
     * roof, a drone bridge off the hill's crown, a line over the long chute
     * (its bays are a staircase down to the loop's roof), and one over the
     * last gallery to the roof of the terraces.
     */
    highRoad(b, n1 - 12, h0 + 6, { lift: 6, monitors: ['rings10'] });
    droneBridge(b, h0 + 26, { drones: 2, prize: 'rings10' });
    highRoad(b, r0 - 6, n2 - 30, { lift: 6, droneEvery: 3 });
    highRoad(b, n2 - 4, t0 + 22, { lift: 6, crumbleEvery: 3, monitors: ['shield', 'rings10'] });
  },
};
