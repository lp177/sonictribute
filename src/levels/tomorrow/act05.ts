import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { arenaApproach, cartCanyon, hazardGauntlet, railCascade, stalactiteGallery } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
  lowRoad,
} from '../sections.ts';
import { lightBridge, ribbon, roofedTube, rooftops, skyRail } from './pieces.ts';

const W = 711;

/**
 * NOON TOMORROW — ACT 5 — "Mirage Toll Gate"
 *
 * The mid-biome test, and the mirror of the stairway: one long way DOWN to
 * the gate, a tier at a time. Every toy of the first four acts takes a turn —
 * a tunnel, a cart, the awning, a ribbon, hard light, the roofs — and each
 * tier is paid for with the height of the one before. Two short lifts re-arm
 * the descent; the Mirage waits at the bottom.
 *
 * BEATS:
 *   opening    a safe apron on the roofline.
 *   tier 1     the toll road's tunnel, out over the first drop,
 *   knot       and the cart where it lands.                     -- checkpoint
 *   tier 2     the hill (a crystal vault under it) and the leap its far slope
 *              feeds,
 *   knot       then the awning.
 *   lift       sprung up to the trap deck.                      -- checkpoint
 *   knot       the first full gauntlet — teeth, hopper, crane hook — with a
 *              bridge of drones over it for whoever would rather not.
 *   tier 3     a ribbon down off the deck (a crystal over it),
 *   knot       and a bridge of light where it sets you down.    -- checkpoint
 *   lift       a second spring,
 *   knot       a cascade of rails,
 *   tier 4     and the deep valley: roll it and the upper ledge's rail carries
 *              you on over the roofs.                           -- checkpoint
 *   knot       the roofs,
 *   gate       then the long arch: eight rows down into the last loop, and
 *              out of it into the toll plaza.
 *
 * ROADS: the middle road is the tiers. The high road is the catwalks and the
 * drone bridge; the low road is the vault, the gallery under the trap deck,
 * the valley under the ribbon and the street under the roofs.
 */
export const act05: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 5',
  title: 'Mirage Toll Gate',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  bossKind: 'mirage',
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20); // → row 24
    c = roofedTube(b, c.endX, c.endRow, { drop: 8, runout: 36, top: 'shield' }); // → row 32
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 });
    b.checkpoint(c.endX - 2, c.endRow);
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 12, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 1 (vault), secret 1 → row 34
    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2, pit: 'crab' }); // → row 36
    const aw = c.endX;
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 });
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 12 }); // → row 22
    b.checkpoint(c.endX - 3, c.endRow);
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 22, density: 3, period: 150 });
    const g1 = c.endX;
    c = skyRail(b, c.endX, c.endRow, { drop: 8, len: 52, depth: 14, hoppers: 2, prize: 'rings10', crystal: true, runout: 12 }); // CRYSTAL 2 → row 30
    const lb = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 12, period: 160, hazards: 1, prize: 'rings10' });
    b.checkpoint(c.endX - 2, c.endRow);
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 6 }); // → row 20
    c = railCascade(b, c.endX, c.endRow, { steps: 3, dropEach: 2, span: 8 }); // → row 26
    const lip = c.endX + 4 + 28 + 10 + 5; // first column past the valley's kicker
    c = launchValley(b, c.endX, c.endRow, { depth: 14, out: 8, crabs: 2, prize: 'crystal' }); // CRYSTAL 3 (upper ledge) → row 32
    b.checkpoint(c.endX - 2, c.endRow);
    const r0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -2, 1, -2, 3], crabs: 2, room: 'shield', secret: true }); // secret 2
    const r1 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 8, up: 0, roof: 'rings10' }); // → row 40
    c = arenaApproach(b, c.endX, c.endRow, { width: 60 });
    if (c.endX !== W) throw new Error(`act05 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, h0 + 2, aw - 2, { span: 11, gap: 3, droneEvery: 3, monitors: ['rings10'] }); // over the hill and the leap
    b.spring(h0 + 5, 32, 11);
    c = droneBridge(b, g0 + 1, { drones: 3, lift: 8, prize: 'crystal' }); // CRYSTAL 4 — over the gauntlet
    b.spring(g0 - 5, 22, 11);
    highRoad(b, lb + 2, lip - 34, { lift: 9, monitors: ['rings10'] }); // over the bridge of light, the lift and the cascade
    b.platform(r0 + 4, r0 + 11, 22); // the station over the roofs
    ribbon(b, lip + 37, 29, r0 + 4, 22);
    highRoad(b, r0 + 15, r1 + 14, { lift: 9, crumbleEvery: 3, droneEvery: 3 }); // on over them, to the head of the arch: its roof is a drop from here

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
