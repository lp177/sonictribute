import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import type { MonitorKind } from '../../game/entities.ts';
import { cartCanyon, hazardGauntlet, rollersRun, runway, signpostFinish, stackedChoice } from '../motifs.ts';
import {
  WORLD_ROWS,
  LO,
  cave,
  groundRow,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  highRoad,
  droneBridge,
} from '../sections.ts';
import { lightBridge, rooftops, skyRail } from './pieces.ts';

const W = 718;

interface Attic {
  /** First column of the room in the gallery's ceiling. */
  x: number;
  prize: 'crystal' | MonitorKind;
  secret?: boolean;
}

/**
 * The undertow: ONE gallery under a whole block of the act, floor `LO` rows
 * under the street. You drop in by a shaft, and the rail hung under the shaft
 * catches you and carries you the length of the block — 9 px/frame, faster
 * than anything on the roofs above — to the spring lift at the far end. Jump
 * off the ride and you are on the gallery floor with the crabs; jump off at
 * the right moment and you are in one of the rooms in its ceiling. A runner
 * skims a `well` of 3 columns without noticing it; 6 takes anyone not rolling.
 * Stamp AFTER the ground chain. It refuses a line that would leave less than
 * two rows of roof anywhere (it names the column).
 */
function undertow(b: LevelBuilder, x0: number, x1: number, floor: number, shafts: number[], attics: Attic[], crabs = 2, well = 3): void {
  const HEAD = 7;
  // The rail hangs FOUR rows over the floor: a rail is boarded in whichever
  // direction you are moving, and a crab's knock-back lifts its victim 36 px
  // — at three rows it put them on the ride backwards.
  const RAIL = 4;
  for (let x = x0; x <= x1; x++) {
    if (groundRow(b, x) > floor - HEAD - 2) throw new Error(`act06: the undertow ${x0}..${x1} has no roof at column ${x}`);
  }
  for (const a of attics) {
    for (let x = a.x; x <= a.x + 7; x++) {
      if (groundRow(b, x) > floor - HEAD - 6) throw new Error(`act06: the room at ${a.x} has no roof at column ${x}`);
    }
  }
  const lift = groundRow(b, x1 - 1);
  const tops = shafts.map((sx) => groundRow(b, sx));
  cave(b, x0, x1, floor, HEAD);
  shafts.forEach((sx, i) => b.carve(sx, tops[i], sx + well - 1, floor - 1));
  // The rail starts under the first shaft: falling in IS boarding. It stops
  // short of the lift, over the floor, so the ride sets you down.
  const tip = x1 - 7;
  b.rail(shafts[0], floor - RAIL, tip, floor - RAIL);
  for (let x = shafts[0] + 5; x < tip - 2; x += 4) b.rings.push({ x: x * 16 + 8, y: (floor - RAIL) * 16 - 22 });
  for (const a of attics) {
    b.carve(a.x, floor - HEAD - 4, a.x + 7, floor - HEAD - 1);
    // The room's floor stops two columns short of its far wall: one-way
    // ledges cannot be dropped through, and a room must let you back out.
    b.platform(a.x, a.x + 5, floor - HEAD);
    if (a.prize === 'crystal') b.crystal(a.x + 2, floor - HEAD - 2);
    else b.monitor(a.x + 2, floor - HEAD, a.prize);
    if (a.secret) b.secret(a.x, floor - HEAD - 4, a.x + 7, floor - HEAD - 1);
  }
  const len = tip - shafts[0];
  for (let i = 0; i < crabs; i++) b.enemy(shafts[0] + 8 + Math.floor(((i + 0.5) * (len - 12)) / crabs), floor, 3);
  b.carve(x1 - 2, lift, x1, floor - 1);
  b.spring(x1 - 1, floor, 13);
  b.spring(x1, floor, 13);
}

/**
 * NOON TOMORROW — ACT 6 — "Undertow Arcade"
 *
 * The act where the low road is the star. The city here is three tower
 * blocks with courtyards between them; the middle road climbs each block,
 * picks its way across the roof and plunges off the far side. Under every
 * block runs the undertow: a gallery with a rail in it that takes whoever
 * drops in and carries them through, fast, past rooms in the ceiling where
 * the act keeps its crystals. The silhouette is a battlement; the line under
 * it is the act.
 *
 * BEATS:
 *   opening    a safe apron, and the forecourt valley.
 *   block A    the first shaft in the street — drop in for the undertow, or
 *              take the spring to the roof: the loop, two decks, and the
 *              plunge back down.                                -- checkpoint
 *   courtyard  the hill with its own vault under it.
 *   block B    a second shaft, a second spring: the trap line, a roller, the
 *              roofs (so three roads are stacked here), the plunge.
 *                                                               -- checkpoint
 *   block C    the long one. Over the top: a ribbon, a bridge of light, a
 *              cart, a plunge. Underneath: the undertow proper, the length of
 *              the block, with the last crystal in its ceiling. -- checkpoint
 *   home       one leap over the last pit, and a straight to the signpost.
 *
 * ROADS: the middle road is the roofs and courtyards. The low road is the
 * three undertows and the vault — over half the act; the high road is short
 * here, a catwalk and a bridge of drones.
 */
export const act06: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 6',
  title: 'Undertow Arcade',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 24); // → row 28
    c = launchValley(b, c.endX, c.endRow, { depth: 14, crabs: 1, prize: 'rings10' }); // → row 30

    // BLOCK A
    const a0 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 12, rings: false });
    c = springCliff(b, c.endX, c.endRow, { rise: 8, top: 6 }); // → row 22
    const aTop = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 4, up: 4, roof: 'shield' });
    c = stackedChoice(b, c.endX, c.endRow, { len: 22, crystal: true }); // CRYSTAL 1 (upper deck)
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 10 }); // → row 30
    const a1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);

    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 10, down: 8, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 2 (vault), secret 1 → row 32

    // BLOCK B
    const b0 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 12, rings: false });
    c = springCliff(b, c.endX, c.endRow, { rise: 10, top: 12 }); // → row 22
    const bTop = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 2, period: 150 });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    const br0 = c.endX;
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -1, 1, -1, 1], crabs: 2, room: 'rings10', secret: true }); // secret 2
    const br1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 10, runout: 10 }); // → row 32
    const b1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);

    // BLOCK C
    const c0 = c.endX;
    c = runway(b, c.endX, c.endRow, { len: 12, rings: false });
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // → row 20
    c = skyRail(b, c.endX, c.endRow, { drop: 6, len: 40, depth: 10, hoppers: 1, prize: 'rings10', crystal: true }); // CRYSTAL 3 → row 26
    const lb = c.endX;
    c = lightBridge(b, c.endX, c.endRow, { depth: 6, basin: 16, period: 150, hazards: 2, prize: 'shield' });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 });
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 10 }); // → row 32
    const c1 = c.endX;
    b.checkpoint(c.endX - 2, c.endRow);

    c = longJump(b, c.endX, c.endRow, { gap: 12, fall: 2 }); // → row 34
    c = runway(b, c.endX, c.endRow, { len: 24 });
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act06 chain ends at ${c.endX}, not ${W}`);

    /* =============================== LOW ROAD ==============================
     * Three undertows, each from the street before a block to the street
     * after it. The first is short and plain: it is the lesson.
     */
    undertow(b, a0 + 3, a1 - 3, 30 + LO, [a0 + 5], [{ x: a0 + 38, prize: 'rings10' }]);
    undertow(b, b0 + 3, b1 - 3, 32 + LO, [b0 + 4], [{ x: b0 + 31, prize: 'shield', secret: true }, { x: b0 + 58, prize: 'crystal' }], 3, 6); // CRYSTAL 4, secret 3
    undertow(b, c0 + 3, c1 - 3, 32 + LO, [c0 + 4], [{ x: c0 + 21, prize: 'rings10' }, { x: c0 + 75, prize: 'crystal' }], 3, 6); // CRYSTAL 5

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, aTop + 2, aTop + 12, { lift: 9 }); // one ledge over the loop's run-up: its roof is a drop from here
    b.spring(aTop - 3, 22, 10);
    highRoad(b, aTop + 28, aTop + 66, { lift: 12, monitors: ['rings10'] }); // on from the roof, over the decks
    c = droneBridge(b, bTop + 2, { drones: 3, prize: 'rings10' });
    b.spring(bTop - 4, 22, 11);
    highRoad(b, br0 + 2, br1 + 4, { lift: 9, crumbleEvery: 3, droneEvery: 2 }); // over the roofs: three roads stacked
    b.spring(br0 + 1, 22, 10);
    highRoad(b, lb + 2, lb + 46, { lift: 9, monitors: ['rings10'] }); // over the bridge of light
    b.spring(lb - 5, 26, 10);
  },
};
