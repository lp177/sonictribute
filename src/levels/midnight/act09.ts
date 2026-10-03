import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, phaseCrossing, runway, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  loopHill,
  plunge,
  longJump,
  undercroft,
  springCliff,
  tubeShot,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { shiftBridge, valley, vault } from './pieces.ts';

/**
 * OTHERWHILE FOUNDRY — ACT 9 — "Shift-Change Catwalks"
 *
 * The whole act is timed to the shift bell. Its shape is a TRENCH: the road
 * plunges off the near rim into the long works trench, runs its floor —
 * valley, hill, loop — and is sprung out at the far rim. And over the
 * trench, rim to rim at the height you left, run the catwalks of the title:
 * steel ledges joined by hard-light panels that are only there half the
 * shift. Jump onto them at the brow of the plunge and you cross the act high
 * and level, panel by panel; miss a beat and you are on the trench floor,
 * which is where the speed is. The hard-light bridge is the same idea drawn
 * large, three times: a trough in the road and a light across it.
 *
 * BEATS (knot = tension, the rest is release):
 *   gate      apron, and the first bridge: cross on the light or walk the
 *             trough.
 *   plunge    off the rim — or jump for the catwalk.
 *   valley    the trench's first hollow (crystal on its top shelf).
 *   knot      a hard-light crossing over a pit.            -- checkpoint
 *   hill      over it or through the cable cellar (crystal, secret); its
 *             crown is a jump below the catwalk (crystal up there).
 *   knot      plates and a hopper, a duct beneath (crystal), then a vault.
 *                                                          -- checkpoint
 *   loop      whose exit speed is for the leap and
 *   BRIDGE    the long light: forty columns of trough under it (crystal
 *             over the middle). Only pace gets you all the way across.
 *   lift      sprung out of the trench.                    -- checkpoint
 *   knot      the fastest crossing, a drone over it,
 *   far rim   a last valley, a third light on the shortest shift of all, and
 *             the flue that fires you to the signpost.
 */
export const midnight09: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 9',
  title: 'Shift-Change Catwalks',
  biome: 1,
  theme: 'gear',
  width: 683,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 22); // row 26
    c = shiftBridge(b, c.endX, c.endRow, { depth: 6, bed: 16, period: 200, prize: 'rings10', crabs: 1 });
    const rim = c.endX;
    const deck = c.endRow + 1; // the catwalk: a row under the rim
    c = plunge(b, c.endX, c.endRow, { drop: 12, runout: 6 }); // the trench, row 38
    c = valley(b, c.endX, c.endRow, { depth: 8, out: 6, crabs: 2, prize: 'crystal' }); // CRYSTAL 1; row 40
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 });
    b.checkpoint(c.endX - 3, c.endRow);
    const hill = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 14, down: 8, prize: 'crystal', secret: true }); // CRYSTAL 2, secret 1
    c = runway(b, c.endX, c.endRow, { len: 8 }); // the hill's slope ends in ground and rings
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 2, period: 140 });
    const g1 = c.endX;
    c = vault(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2
    b.checkpoint(c.endX - 1, c.endRow);
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 6, roof: 'rings10' });
    c = longJump(b, c.endX, c.endRow, { gap: 14, fall: 0, pit: 'crab' });
    c = shiftBridge(b, c.endX, c.endRow, { depth: 6, bed: 28, period: 170, prize: 'crystal', crabs: 2 }); // THE LONG LIGHT; CRYSTAL 3
    const far = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 10 }); // out of the trench, row 28
    b.checkpoint(c.endX - 5, c.endRow);
    const p3 = c.endX;
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 });
    b.drone(p3 + 8, c.endRow - 5, 2); // the shift's last trick: the light AND something to dodge over it
    c = valley(b, c.endX, c.endRow, { depth: 10, out: 8, crabs: 1, prize: 'shoes' }); // row 30
    c = shiftBridge(b, c.endX, c.endRow, { depth: 8, bed: 12, period: 150, prize: 'shield', crabs: 1 }); // the third light: shortest shift, deepest trough
    const rim2 = c.endX;
    c = tubeShot(b, c.endX, c.endRow, { drop: 8, runout: 40, top: 'rings10' }); // row 38
    signpostFinish(b, c.endX, c.endRow, { len: 24 });

    /* ============================ THE CATWALKS =============================
     * Rim to rim over the trench, a row under the rim it leaves, rising and
     * falling a row or two as it goes: eight columns of steel, then five of
     * hard light, the lights counter-phased so every other one is lit. It
     * does not follow the ground — that is the point of it. Skipped wherever
     * a set piece already owns the air.
     */
    let lit = 0;
    for (let x = rim + 5, i = 0; x + 8 < far; x += 13, i++) {
      const row = deck + [0, -1, -2, -1, 0, 1][i % 6];
      let clear = true;
      for (let cx = x; cx <= x + 12; cx++) for (let y = row - 3; y <= row; y++) if (b.grid[y][cx] !== '.') clear = false;
      if (!clear) continue;
      b.platform(x, x + 7, row);
      if (i % 2 === 0) b.ringsH(x + 1, x + 6, row - 2);
      else if (i % 3 === 1) b.monitor(x + 4, row, i % 12 === 1 ? 'shield' : 'rings10');
      if (x + 13 + 8 < far) b.phasePlatform(x + 8, x + 12, row, 180, lit++ % 2 === 0 ? 0 : 90);
    }
    b.crystal(hill + 32, deck - 4); // CRYSTAL 4 — over the catwalk above the hill's crown

    /* ============================== HIGH ROAD ============================== */
    highRoad(b, p3 - 6, rim2 + 20, { droneEvery: 3, crumbleEvery: 4, monitors: ['rings10'] }); // the far rim

    /* =============================== LOW ROAD ==============================
     * The duct under the plates.
     */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, traps: 1, prize: 'crystal', secret: true }); // CRYSTAL 5, secret 3
  },
};
