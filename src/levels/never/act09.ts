import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { canopyRun, hazardGauntlet, rollersRun, signpostFinish, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  undercroft,
  springCliff,
  stairClimb,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { alcove, cartDrop, lightBridge, loopWalk, railLift, valley } from './pieces.ts';

/**
 * THE UNDERWHEN — ACT 9 — "Nevergleam Ascent"
 *
 * The way back up. Eight acts have drilled downward; this one starts on the
 * floor of the mine and finishes twenty-three rows above it, and every toy
 * the biome used to take you down is turned round to haul you up. The rail
 * runs uphill. The cart's track climbs. The terraces are roofed with spikes,
 * so the one place you must stop and aim is the one place you may not. And
 * every valley in it climbs out higher than it went in — the releases still
 * run downhill, they just never give back all the height the lifts won.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   an apron on the mine floor.
 *   lift      the rail that runs UP: the road walks onto it.
 *   valley    floor, ledge, upper ledge — out two rows above the way in.
 *                                                            -- checkpoint
 *   stair     knot: three terraces under a roof of spikes, a crab on the
 *             middle one.
 *   loop      off the top of the stair, down through the loop,
 *   plunge    and on down the cliff — the act's one real loss of height.
 *   knot      a bridge of light, a crystal over it.          -- checkpoint
 *   cart      the track that CLIMBS: seven rows up across the shaft, a
 *             crystal on the bail ledge, an alcove under the brink.
 *   hill      a hill that keeps its height: long up, short down, a crystal
 *             cave under it.
 *   knot      a gallery of five spikes.                      -- checkpoint
 *   valley 2  down at a roll, out on the far side.
 *   cliff     sprung to the summit — and a stair of light climbs on from
 *             the clifftop to the Nevergleam itself.
 *   knot      the summit is guarded: the hard road, and a gallery under
 *             it with the last crystal.
 *   THE RIDGE a loop on the roof of the world, the long swells after it,
 *             the signpost in open air.
 *
 * ROADS: the middle road is the ground and its lifts. The high road is the
 * valleys' ledges, the bail ledge, the stair of light and the catwalks
 * stamped below; the low road is the shaft floor under the cart, the pit
 * under the bridge, the cave under the hill and the gallery under the hard
 * road.
 */
export const act09: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 9',
  title: 'Nevergleam Ascent',
  biome: 2,
  theme: 'crystal',
  width: 682,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 43, { drop: 2 }); // 0–25, down to row 45: the floor of the mine
    c = railLift(b, c.endX, c.endRow, { rise: 10, span: 18, top: 8 });
    c = valley(b, c.endX, c.endRow, { depth: 9, out: 11, crabs: 1, prize: 'rings10' });
    b.checkpoint(c.endX - 3, c.endRow);
    const s0 = c.endX;
    const foot = c.endRow;
    c = stairClimb(b, c.endX, c.endRow, { steps: 3, rise: 3, tread: 7 });
    // The roof over the stair: one spike per terrace, armed as you land on it.
    for (let i = 0; i < 3; i++) {
      const tread = foot - 3 * (i + 1);
      b.slab(s0 + 4 + i * 7, s0 + 10 + i * 7, tread - 8, 2); // six rows clear: room for the jump up to the next
      b.stalactite(s0 + 8 + i * 7, tread - 7);
    }
    loopWalk(b, c.endX, c.endRow, 8); // from the top of the stair onto the loop's roof
    c = loopHill(b, c.endX, c.endRow, { drop: 8, up: 2, roof: 'shield' });
    canopyRun(b, c.endX - 2, c.endRow - 5, { len: 60 }); // level from the brink of the plunge out over the bridge of light: the way round it
    c = plunge(b, c.endX, c.endRow, { drop: 9, runout: 12 });
    c = lightBridge(b, c.endX, c.endRow, { spans: 6, period: 160, pit: 6, crabs: 1, prize: 'crystal' }); // CRYSTAL 1
    b.checkpoint(c.endX - 3, c.endRow);
    const cart = c.endX;
    c = cartDrop(b, c.endX, c.endRow, { span: 16, drop: -7, pit: 13, crabs: 2, prize: 'crystal', runout: 12 }); // the cart that climbs — CRYSTAL 2 (bail ledge)
    alcove(b, cart + 1, cart + 4, c.endRow + 13); // secret 1: back under the brink
    b.monitor(cart + 2, c.endRow + 13, 'shield');
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 9, crown: 10, down: 4, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 2
    const g = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 });
    b.checkpoint(c.endX - 2, c.endRow);
    c = valley(b, c.endX, c.endRow, { depth: 12, out: 9, crabs: 2, prize: 'rings10' });
    c = springCliff(b, c.endX, c.endRow, { rise: 8, top: 8 });
    // The stair of light: three steps on from the clifftop to the Nevergleam.
    const top = c.endRow;
    b.phasePlatform(c.endX - 7, c.endX - 5, top - 3, 150, 0);
    b.phasePlatform(c.endX - 3, c.endX - 1, top - 6, 150, 75);
    b.phasePlatform(c.endX + 1, c.endX + 3, top - 9, 150, 0);
    b.platform(c.endX + 5, c.endX + 10, top - 12);
    b.crystal(c.endX + 8, top - 14); // CRYSTAL 4 — the Nevergleam
    const k3 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 30, density: 3, period: 140 }); // the summit is guarded
    const l1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 6, depth: 2, basin: 6 });
    signpostFinish(b, c.endX, c.endRow, { len: 30 });

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, hill + 8, g + 2, { lift: 5, span: 10, gap: 4, droneEvery: 2, monitors: ['shield'] }); // low over the hill, a jump up from it, and onto the gallery's roof
    highRoad(b, k3 + 14, l1 + 50, { lift: 14, crumbleEvery: 3, droneEvery: 3, monitors: ['rings10'] }); // over the hard road and the ridge loop

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, k3 + 1, k3 + 22, { shafts: [k3 + 7], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3 — lifts out short of the hopper
  },
};
