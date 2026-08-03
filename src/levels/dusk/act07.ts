import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
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
 * DUSKMERE COAST — ACT 7 — "Foam Lantern Rise"
 *
 * The climb out of the bay, lit by lantern rows along the canopy — the sky
 * is the featured road: the early launch ramp boards the catwalks (the arc
 * is physics-probed by tests/skylanes.test.ts, so the opener stays), which
 * now hand off to a long lantern-lit glide over the reef bowls and rollers,
 * then trapped steps and catwalks out. The ground pays phase crossings, a
 * stalactite roof and a rail cascade; the sea-cave gallery beneath spans
 * nearly the whole rise, with its own grind line and clocked teeth.
 */
export const act07: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 7',
  title: 'Foam Lantern Rise',
  biome: 0,
  theme: 'verdant',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = corridorLoop(b, c.endX, c.endRow); // 20–47, loop centre 33

    // Launch set piece (48–69): the early door to the lantern walk.
    b.launchRamp(48, 24, 3); // 48–55, pad tops out on row 21
    b.gentleDown(56, 21, 3); // 56–61, back down to 24
    b.floor(62, 69, 24); // (shaft at 65)
    b.ringsH(63, 68, 21);
    c = { endX: 70, endRow: 24 };

    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 70–91, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 92–99 (shaft at 96)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 }); // 100–118
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 }); // 119–136
    b.crystal(128, 20); // CRYSTAL 2 — under the stalactite roof
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 137–144
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 5 }); // 145–159
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 160–189
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 190–201, secret 1 (opens into the gallery)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 2, period: 150 }); // 202–219
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 220–227 (shaft at 224)
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 228–239, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 240–270, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8 }); // 271–284, back to 24 (shaft at 280)
    c = secretPocket(b, c.endX, c.endRow); // 285–294, CRYSTAL 3 + secret 2
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 295–322: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 9 }); // 323–337, back to 24 (shaft at 330)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 338–347, secret 3
    signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 348–379

    // The lantern walk: catwalks where the ramp's fixed arc lands (~x74-84,
    // row 10 — probed), then the long glide over the bowl and the rollers,
    // trapped steps, and catwalks out.
    const s1 = canopyRun(b, 76, 10, { len: 52, crystal: true }); // 76–127, CRYSTAL 5 (sky)
    const g = glideRun(b, s1.endX, 9, { len: 64 }); // 128–191: the featured glide
    // Mercy mast-tops under the glide gap keep the lane continuous; a folded
    // wing drops to a shelf, then the rollers below.
    for (const mx of [140, 148, 156, 164, 172, 180]) b.platform(mx, mx + 1, 15);
    const k1 = skySteps(b, g.endX + 1, 10, { steps: 5, drone: true, trap: true }); // 192–229
    canopyRun(b, k1.endX, 10, { len: 52 }); // 230–281

    /* ============================ UNDER ROUTE ============================
     * The sea-cave gallery, carved last, from under the ramp to the final
     * rise. Shafts sit on plain flats — clear of the loop corridor (20–47),
     * the ramp, the bowl, the cascade and the leap mesa.
     */
    underGallery(b, 36, {
      len: 296, // 36–331, within 9 columns of the last secret pocket's room
      shafts: [29, 60, 188, 244, 294], // at 65, 96, 224, 280, 330
      hazards: 2,
      rail: true, // the grind line ends at the sneak-under's shield monitor
      crystal: true, // CRYSTAL 4 — under-lane prize at the gallery's heart
    });
  },
};
