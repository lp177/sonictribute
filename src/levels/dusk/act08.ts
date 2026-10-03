import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, railCascade, runway, signpostFinish, sneakUnder, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  plunge,
  undercroft,
  springCliff,
  stairClimb,
  tubeShot,
  highRoad,
  droneBridge,
  lowRoad,
  cave,
  groundRow,
} from '../sections.ts';


/**
 * DUSKMERE COAST — ACT 8 — "Sea-Cave Galleries"
 *
 * The act under the coast. The middle road itself goes into the rock here —
 * twice through a bluff, in the dark — and under much of what stays in
 * daylight there is a gallery: two headland caves, two long cave roads, a
 * pocket in a clifftop, the floor of the cart canyon. Three of the five
 * crystals are down there. The mine cart is the galleries' toy, and the
 * hanging spikes are their roof: both appear once, alone.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the apron tips downhill
 *   tube 1    straight into the first bluff, and out over the bay.
 *   headland  the first fork: over the hill or into the cave under it
 *             (crystal, secret room).
 *   knot      THE CART: ride it over the canyon and bail before the buffer.
 *                                                            -- checkpoint
 *   plunge    down to the low shelf and over the sump,
 *   cliff     and sprung back up; a pocket in the clifftop (crystal) that
 *             turns out to be the mouth of the first cave road.
 *   knot      the roofed gallery: hanging spikes that fall behind a runner.
 *             The first cave road beneath it, with its rail. -- checkpoint
 *   loop      on its hill,
 *   rails     a cascade of grind rails down the far side,
 *   valley    into the kicker valley (shield on the upper ledge).
 *   knot      hoppers and clocked traps; the second cave road beneath
 *             (crystal, secret room).                         -- checkpoint
 *   headland 2 the deep cave: clocked spikes, a secret room.
 *   terraces  up the last bluff,
 *   tube 2    the signature: the long tube, and the mouth of the sea cave.
 *             The crystal hangs at the top of the fastest arc — only a roll
 *             through the whole tunnel reaches it. Then the strand, and
 *             the signpost.
 *
 * ROADS: the low road is the star — both headland caves, both cave roads,
 * the canyon floor. The middle road is the ground and the two tunnels; the
 * high road is the catwalks over the knots and the bluff roofs.
 */
export const act08: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 8',
  title: 'Sea-Cave Galleries',
  biome: 0,
  theme: 'verdant',
  width: 688,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24, { drop: 4 }); // down to row 28
    const t1 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 32, top: 'rings10' });
    const h1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 8, prize: 'crystal', hazards: 1, secret: true }); // CRYSTAL 1 (cave), secret 1
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // the galleries' toy, alone
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 2 });
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 2, pit: 'trap' }); // the sump
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 4 });
    c = sneakUnder(b, c.endX, c.endRow, { crystal: true }); // CRYSTAL 2 (clifftop pocket)
    const s0 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 32, count: 5 });
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const s1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'rings10' });
    c = railCascade(b, c.endX, c.endRow, { steps: 3, dropEach: 2 });
    c = launchValley(b, c.endX, c.endRow, { depth: 8, out: 10, crabs: 2, prize: 'shield' });
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 2, period: 150 });
    b.hopper(g0 + 15, c.endRow); // a second hopper: the dark is theirs too
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const g1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 10, prize: 'shoes', hazards: 2, secret: true }); // secret 3
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 4, tread: 8 }); // steps, not a spring: a spring's arc lands on the bluff's roof and misses the tunnel
    const t2 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 10, runout: 40, top: 'shield' });
    b.crystal(t2 + 33 + 11, c.endRow - 12); // CRYSTAL 5 — the top of the rolled arc out of the mouth; a run passes a row under it
    signpostFinish(b, c.endX, c.endRow, { len: 26 });

    /* ============================== HIGH ROAD ==============================
     * Over the rooflines. The bluffs' own tops are part of it: a full jump
     * up from the road, or a step off the bridges.
     */
    droneBridge(b, t1 - 10, { drones: 3, lift: 12, prize: 'rings10', onRamp: true }); // from over the apron onto the first bluff
    highRoad(b, h1 - 12, h1 + 30, { droneEvery: 3, monitors: ['rings10'], onRamp: true }); // over the bay's landing, up the headland
    highRoad(b, s0 - 8, s1 + 44, { lift: 12, crumbleEvery: 3, monitors: ['shield'], onRamp: true }); // over the roofed gallery and the loop (its roof is a drop from here)
    highRoad(b, g0 - 10, g1 + 30, { droneEvery: 2, crystal: true, monitors: ['rings10'], onRamp: true }); // CRYSTAL 4 — over the last knot
    droneBridge(b, t2 - 16, { drones: 3, lift: 8, prize: 'rings10', onRamp: true }); // off the last clifftop onto the bluff

    /* =============================== LOW ROAD ==============================
     * The two cave roads. (No crab under the rail: a knock-back lands the
     * walker on it, and the rail carries him the wrong way.)
     */
    // The first is cut by hand, so that its mouth can be the clifftop pocket:
    // what looked like a closet goes on, under the roofed gallery, to a spring
    // lift at its far end.
    const fl = groundRow(b, s1 - 1) + 10;
    cave(b, s0 - 3, s1 - 1, fl);
    b.ringsH(s0 + 4, s0 + 12, fl - 2);
    b.rail(s0 + 14, fl - 3, s0 + 26, fl - 2);
    b.monitor(s1 - 8, fl, 'rings10');
    b.carve(s1 - 3, fl - 10, s1 - 1, fl - 1);
    b.spring(s1 - 2, fl, 13);
    b.spring(s1 - 1, fl, 13);
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 5], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 3, secret 2
  },
};
