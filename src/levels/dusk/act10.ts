import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  railCascade,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 10 — "Ebb-Light Ascent"
 *
 * The last ordinary act before the seawall, and the hardest: hazard clocks
 * run fast (140 frames), the pendulum alley swings in counterpoint over a
 * crumbling shelf, and two phase crossings bracket the stalactite roof. The
 * sky is the mercy route — an early launch ramp opens the longest canopy in
 * the biome, patrolled by drones but free of clocks.
 */
export const act10: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 10',
  title: 'Ebb-Light Ascent',
  biome: 0,
  theme: 'verdant',
  width: 400,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19

    // Launch set piece (20–41): the sky door opens immediately this time.
    b.launchRamp(20, 24, 3); // 20–27, pad tops out on row 21
    b.gentleDown(28, 21, 3); // 28–33, back to 24
    b.floor(34, 41, 24);
    b.ringsH(35, 40, 21);
    c = { endX: 42, endRow: 24 };

    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 150 }); // 42–59
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 140 }); // 60–75
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true, lift: 9 }); // 76–97, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 98–125

    // Pendulum pressure alley (126–151): two counter-phased swings, a
    // crumble shelf and a parting spike trap — read the rhythm, keep moving.
    b.floor(126, 151, 24);
    b.swingBall(131, 14, 9, 140, 0);
    b.swingBall(140, 14, 9, 140, 70);
    b.crumble(144, 147, 20);
    b.ringsH(144, 147, 18);
    b.ringsH(127, 138, 21);
    b.spikeTrap(149, 24, 140, 45);
    c = { endX: 152, endRow: 24 };

    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 152–157
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 158–169, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 170–200, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // 201–212, back to 24
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 213–224, CRYSTAL 2 (under) + secret 1
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // 225–238
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 5 }); // 239–256
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 257–275
    c = secretPocket(b, c.endX, c.endRow); // 276–285, CRYSTAL 3 + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 }); // 286–303
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 304–311
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // 312–343: the longest blind drop
    b.crystal(327, 12); // CRYSTAL 4 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10, enemy: true }); // 344–359, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 360–369, secret 3
    c = runway(b, c.endX, c.endRow, { len: 14, rings: false }); // 370–383
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 384–399

    b.drone(90, 12, 4); // guards the stacked shelves
    b.drone(230, 18, 4); // sweeps the bowl's launch window

    // The mercy route: the biome's longest canopy, high above the clocks.
    const s = canopyRun(b, 50, 7, { len: 143, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 130 });
  },
};
