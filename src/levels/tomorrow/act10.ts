import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  railCascade,
  cartCanyon,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  arenaApproach,
  canopyRun,
} from '../motifs.ts';

const W = 420;

/**
 * NOON TOMORROW — ACT 10: the campaign finale. The widest act in the game,
 * every toy in the biome at its tightest clock, and the harder arena
 * approach the finale owes: a blind leap onto the low road, then a density-3
 * gauntlet runs straight into the Mirage's plaza with no breather between.
 * Everything is still telegraphed; nothing is still forgiving.
 */
export const act10: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 10',
  title: 'The Unstruck Noon',
  biome: 3,
  theme: 'neon',
  width: W,
  bossKind: 'mirage',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true, enemy: true }); // 10–19
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 20–41, crystal 1 (sky shelf)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 42–71
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 72–90
    c = runway(b, c.endX, c.endRow, { len: 7, rise: 3, checkpoint: true, dashPad: true }); // 91–103, up to 21
    c = railCascade(b, c.endX, c.endRow); // 104–134: dive to 27
    c = runway(b, c.endX, c.endRow, { len: 7, rise: 3 }); // 135–147, up to 24
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 148–167
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 }); // 168–187: the long awning
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 188–199, crystal 2 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 120 }); // 200–219
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 22 }); // 220–253: the deep loop
    c = secretPocket(b, c.endX, c.endRow); // 254–263, crystal 3 (ground), secret 2
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 8 }); // 264–281
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 282–300
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true, enemy: true }); // 301–307
    b.hopper(306, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // 308–339: the last blind leap, to 27
    c = secretPocket(b, c.endX, c.endRow); // 340–349, crystal 4 (under band), secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 120 }); // 350–365: no breather
    const fin = arenaApproach(b, c.endX, c.endRow, { width: 54 }); // 366–419: the final plaza
    if (fin.endX !== W) throw new Error(`act10 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: the last canopy, high and long. Lengths are 13k+8 so the
    // chained seam stays a standard 5-tile hop.
    const s = canopyRun(b, 40, 8, { len: 146, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 112 });
    b.phasePlatform(48, 52, 8, 150, 0);
    b.phasePlatform(198, 202, 8, 150, 75);
    b.drone(115, 5, 3);
    b.drone(235, 5, 3);
    b.drone(320, 6, 3);
  },
};
