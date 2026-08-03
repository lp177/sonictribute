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
  skySteps,
  glideRun,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 10 — "Ebb-Light Ascent"
 *
 * The last ordinary act before the seawall, and the hardest: hazard clocks
 * run fast (140 frames), the pendulum alley swings in counterpoint over a
 * crumbling shelf, and two phase crossings bracket the stalactite roof. The
 * sky is the mercy route with teeth of its own now — the early launch ramp
 * (probed by tests/skylanes.test.ts, so the opener stays) boards catwalks
 * that hand off to a glide straight over the pendulum alley, its second
 * thermal blowing up through the swing-balls' reach. The sea-cave gallery
 * below spans nearly the whole ascent, grind line included.
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
    c = corridorLoop(b, c.endX, c.endRow); // 98–125, loop centre 111

    // Pendulum pressure alley (126–151): two counter-phased swings, a
    // crumble shelf and a parting spike trap — read the rhythm, keep moving.
    // The glide line crosses directly overhead; the wind column at 131–135
    // lifts a bailed flyer up past the swings' reach — teeth both ways.
    b.floor(126, 151, 24);
    b.swingBall(131, 14, 9, 140, 0);
    b.swingBall(140, 14, 9, 140, 70);
    b.crumble(144, 147, 20);
    b.ringsH(144, 147, 18);
    b.ringsH(127, 138, 21);
    b.spikeTrap(149, 24, 140, 45);
    c = { endX: 152, endRow: 24 };

    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 152–157 (shaft at 155)
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 158–169, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 170–200, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 201–212, back to 24 (shaft at 209)
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 213–224, secret 1 (opens into the gallery)
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // 225–238
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 5 }); // 239–256
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 257–275
    c = secretPocket(b, c.endX, c.endRow); // 276–285, CRYSTAL 2 + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 }); // 286–303
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 304–311 (shaft at 308)
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // 312–343: the longest blind drop
    b.crystal(327, 12); // CRYSTAL 3 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10 }); // 344–359, back to 24 (shaft at 352)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 360–369, secret 3
    c = runway(b, c.endX, c.endRow, { len: 14, rings: false }); // 370–383
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 384–399

    b.drone(90, 12, 4); // guards the stacked shelves
    b.drone(230, 18, 4); // sweeps the bowl's launch window

    // The mercy route with its own teeth: catwalks where the ramp's arc
    // lands (row 10, probed), the pendulum glide, then steps and catwalks.
    const s1 = canopyRun(b, 50, 10, { len: 65, crystal: true }); // 50–114, CRYSTAL 5 (sky)
    const g = glideRun(b, s1.endX, 9, { len: 56 }); // 115–170: over the pendulum alley
    // Mercy mast-tops under the glide; the shaft at 155 stays just clear of
    // the second thermal so its spring lift is never wind-capped.
    for (const mx of [126, 134, 142, 150, 158]) b.platform(mx, mx + 1, 15);
    const k1 = skySteps(b, g.endX + 1, 10, { steps: 5, drone: true, trap: true }); // 171–208
    const s2 = canopyRun(b, k1.endX, 10, { len: 52 }); // 209–260
    const k2 = skySteps(b, s2.endX, 10, { steps: 4, trap: true, drone: false }); // 261–291
    canopyRun(b, k2.endX, 10, { len: 42 }); // 292–333

    /* ============================ UNDER ROUTE ============================
     * The sea-cave gallery under the whole ascent, carved last. Shafts sit
     * on plain flats, clear of the ramp, the loop corridor (98–125), the
     * cascade, the bowl and the leap mesa; the second phase crossing's pit
     * floor carries a carved door down as well.
     */
    underGallery(b, 40, {
      len: 316, // 40–355, within 9 columns of the last secret pocket's room
      shafts: [115, 169, 268, 312], // at 155, 209, 308, 352
      hazards: 2,
      rail: true,
      crystal: true, // CRYSTAL 4 — under-lane prize below the rail runway
    });
    // Door in the second phase crossing's lower route (floor row 29).
    b.carve(264, 29, 265, 33);
    b.spring(264, 34, 13);
    b.spring(265, 34, 13);
  },
};
