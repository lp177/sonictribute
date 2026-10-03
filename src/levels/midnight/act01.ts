import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { STORY_HOUR_OF_MIDNIGHT } from '../../game/story.ts';
import { hazardGauntlet, rollersRun, runway, signpostFinish, stackedChoice, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  stairClimb,
  tubeShot,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 1 — "Midnight Clock-In"
 *
 * The gate of the shift that never ends. The gentlest act of the biome, so
 * its shape is the simplest one a foundry has: a BOWL. The road walks down
 * from the gate into the yard, the yard floor is where the speed is spent
 * (the biome's first loop), and the far side climbs back up to the bell deck.
 * The Foundry's machines are met one at a time and alone: two needles under a
 * gantry roof, one clocked plate. No vehicle yet.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      a safe apron tips downhill.
 *   valley    the first fork: walk the floor, run to the ledge, roll for more.
 *   knot      the first needle roof — two needles, nothing else; its roof is
 *             the high road.                               -- checkpoint
 *   slag heap a hill with the cellar under it (crystal, secret room).
 *   knot      the first clocked plate, a gallery under it. -- checkpoint
 *   yard      the plunge to the yard floor feeds the loop (crystal on its
 *             roof), two slag rollers and the leap over the cooling
 *             pond.                                         -- checkpoint
 *   lift      sprung back up the far wall,
 *   knot      a guarded road under a sprung shelf,
 *   valley 2  a valley that climbs out higher than it went in, -- checkpoint
 *   terraces  and the last steps to the bell deck (vault: crystal).
 *   bell      the tube through the stack fires you out to the signpost.
 *
 * ROADS: the high road is the valley's ledges, the needle roof and the
 * catwalks stamped below; the low road is the cellar under the heap, the
 * gallery under the plate and the pond.
 */
export const midnight01: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 1',
  title: 'Midnight Clock-In',
  biome: 1,
  theme: 'gear',
  width: 649,
  height: WORLD_ROWS,
  intro: STORY_HOUR_OF_MIDNIGHT,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // down to row 26
    c = valley(b, c.endX, c.endRow, { depth: 12, out: 8, basin: 12, crabs: 1, prize: 'rings10' }); // row 30
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 2 }); // the first needles, alone
    b.checkpoint(c.endX, c.endRow);
    const heap = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 10, prize: 'crystal', secret: true }); // row 34; CRYSTAL 1, secret 1
    c = runway(b, c.endX, c.endRow, { len: 8 }); // the heap's slope ends in ground and rings, not in the plate
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 1 }); // the first clocked plate, alone
    const g1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 6 }); // the yard floor, row 42
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 2, roof: 'crystal' }); // CRYSTAL 2 — seen from the road, dropped onto from the catwalk
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // slag rollers: the loop's speed, spent on a rhythm
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 0 }); // row 44, the bottom of the bowl
    const y1 = c.endX;
    b.checkpoint(c.endX - 3, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // row 32
    const s0 = c.endX;
    c = stackedChoice(b, c.endX, c.endRow, { len: 22 });
    c = valley(b, c.endX, c.endRow, { depth: 8, out: 12, basin: 14, crabs: 2, prize: 'shoes' }); // climbs out higher than it went in: row 28
    b.checkpoint(c.endX - 2, c.endRow);
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 3, tread: 8 }); // the bell deck, row 22
    c = vault(b, c.endX, c.endRow, { reward: 'crystal' }); // CRYSTAL 3, secret 2
    const s1 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 10, runout: 44, top: 'crystal' }); // CRYSTAL 4 — on the stack, a jump from the catwalk; row 32
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================== HIGH ROAD ==============================
     * The needle roof is itself a road: the valley's ledge sets you down
     * beside it, and from its far end a pair of drones is the bridge to the
     * heap's crown.
     */
    droneBridge(b, heap - 2, { drones: 2, lift: 5, prize: 'shield' });
    highRoad(b, g0, y1 - 8, { droneEvery: 3, monitors: ['rings10', 'shield'] }); // over the plate, down the plunge, over the loop
    highRoad(b, s0 + 2, s1 + 2, { crumbleEvery: 3, crystal: true, monitors: ['rings10'] }); // CRYSTAL 5 — the bell deck catwalk

    /* =============================== LOW ROAD ==============================
     * The gallery under the clocked plate: in by the shaft at its head, out
     * by the lift at its end.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
