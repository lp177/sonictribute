import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, railCascade, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { alcove, cartDrop, loopWalk, onRamp, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 3 — "Cartfall Chasm"
 *
 * The minecart act. A cart is a ride you cannot steer and that WILL crash at
 * its buffer, so the only decision aboard is when to jump out: early and you
 * are on the chasm floor, late and the cart throws you onto the ledge past
 * the buffer, never and you pay a hit. The act is that decision made five
 * times, the fall under it getting longer each time. Its shape is a mine
 * section: flat workings cut by chasms, each one a step further down.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron, a slope,
 *   lesson    knot: a cart, a six-tile canyon, a buffer in plain sight.
 *   hill      the first downhill, a cave under it.           -- checkpoint
 *   chasm 1   the first track that DIVES: six rows down with the cart.
 *   knot      a short gallery of hanging spikes (Act 2's toy, once).
 *   valley    floor, ledge, or the crystal ledge — and it climbs out
 *             higher than it went in.                        -- checkpoint
 *   stair     knot: the pit-head stair,
 *   loop      and off its top through the loop.
 *   knot      a staircase of rails down to the next brink,
 *   chasm 2   eight rows, crabs under the track, an alcove under the brink.
 *   knot      the trapped workings, a gallery under them.    -- checkpoint
 *   cliff     sprung up.
 *   knot      the wide flat canyon: nine tiles, the same buffer.
 *   valley 2  down again, and its climb-out is the last brink.
 *                                                            -- checkpoint
 *   CARTFALL  thirty-four columns of track, fourteen rows of fall. A crystal
 *             on the ledge only a late jump reaches; another in the alcove
 *             under the brink, for whoever jumped early and walked back.
 *   home      the floor of the chasm country, the signpost.
 *
 * ROADS: the middle road is the ground and the carts. The high road is the
 * bail ledges, the valley's ledges and the catwalks stamped below; the low
 * road is every chasm floor, the cave under the first hill and the gallery
 * under the workings.
 */
export const act03: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 3',
  title: 'Cartfall Chasm',
  biome: 2,
  theme: 'crystal',
  width: 675,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22, { drop: 3 }); // 0–27, down to row 25
    c = cartCanyon(b, c.endX, c.endRow, { gap: 6 }); // the lesson
    const h1 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 8, down: 9, prize: 'rings10', hazards: 1 });
    b.checkpoint(c.endX - 4, c.endRow);
    c = cartDrop(b, c.endX, c.endRow, { span: 22, drop: 6, pit: 6, crabs: 1, prize: 'rings10', runout: 14 }); // chasm 1
    const g1 = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 });
    c = valley(b, c.endX, c.endRow, { depth: 9, out: 13, crabs: 2, prize: 'crystal' }); // CRYSTAL 1 (upper ledge); it climbs out higher than it went in
    b.checkpoint(c.endX - 3, c.endRow);
    const s0 = c.endX;
    c = stairClimb(b, c.endX, c.endRow, { steps: 2, rise: 4, tread: 8 }); // the pit-head stair
    loopWalk(b, c.endX, c.endRow, 6); // from the top of the stair onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 2, roof: 'rings10' });
    const k2 = c.endX;
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 6, span: 8, dropEach: 2 });
    const d2 = c.endX;
    c = cartDrop(b, c.endX, c.endRow, { span: 26, drop: 8, pit: 7, crabs: 2, prize: 'shield', runout: 14 }); // chasm 2
    // The alcove under the brink: bail early, then walk BACK along the floor.
    alcove(b, d2 + 1, d2 + 4, c.endRow + 7); // secret 1
    b.crystal(d2 + 2, c.endRow + 5); // CRYSTAL 2
    const k3 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 28, density: 2 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 13, top: 8 });
    const k4 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // the wide one
    c = valley(b, c.endX, c.endRow, { depth: 10, basin: 8, out: 6, crabs: 1, prize: 'rings10', retrySpring: false }); // its climb-out is the last brink
    b.checkpoint(c.endX - 3, c.endRow);
    const d3 = c.endX;
    c = cartDrop(b, c.endX, c.endRow, { span: 34, drop: 14, pit: 8, crabs: 2, prize: 'crystal', runout: 30 }); // THE CARTFALL — CRYSTAL 3 (bail ledge)
    alcove(b, d3 + 1, d3 + 4, c.endRow + 8); // secret 2: under the last brink, the longest walk back
    b.crystal(d3 + 2, c.endRow + 6); // CRYSTAL 4
    signpostFinish(b, c.endX, c.endRow, { len: 40 });

    /* ============================== HIGH ROAD ==============================
     * Catwalks between the bail ledges, so a good jump out of one cart can be
     * carried toward the next brink.
     */
    onRamp(b, h1 + 4);
    highRoad(b, h1 + 8, h1 + 50, { droneEvery: 3, monitors: ['rings10'] }); // over the first hill
    highRoad(b, g1 + 17, g1 + 44, { lift: 9, crumbleEvery: 3 }); // off the gallery's roof (a step down from the bail ledge) and out over the valley
    highRoad(b, s0 + 3, s0 + 20, { lift: 5, monitors: ['shield'] }); // a low shelf over each terrace: the stair has a second storey
    highRoad(b, k2 + 2, k2 + 30, { droneEvery: 2 }); // over the rail stair
    highRoad(b, k3 + 2, k3 + 30, { droneEvery: 2, crystal: true }); // CRYSTAL 5 — over the workings
    droneBridge(b, k4 - 4, { drones: 3, prize: 'rings10' }); // from the clifftop over the wide canyon: three bounces

    /* =============================== LOW ROAD ==============================
     * The gallery under the trapped workings: the safe way past them.
     */
    lowRoad(b, k3 + 1, k3 + 21, { shafts: [k3 + 7], crabs: 1, prize: 'rings10', secret: true }); // secret 3 — its lift comes up short of the hopper
  },
};
