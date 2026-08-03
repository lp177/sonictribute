import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  stackedChoice,
  phaseCrossing,
  sneakUnder,
  rollersRun,
  secretPocket,
  stalactiteGallery,
  leapOfFaith,
  quarterPipeBowl,
  hazardGauntlet,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 4 — "Phaselight Gallery"
 *
 * Hard-light is the theme: four phase crossings whose clocks tighten from a
 * lazy 200 frames to a brisk 150 as the act runs on. Fast lane: the SKY —
 * an almost unbroken crystal canopy runs the whole act, and the ground below
 * is where the blinking bridges live. The mid-act blind leap drops you back
 * into the thick of it.
 */
const W = 392;

export const act04: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 4',
  title: 'Phaselight Gallery',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 1 (sky shelf)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 6, period: 200 }); // lesson
    c = runway(b, c.endX, c.endRow, { len: 6 });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 180 }); // practice
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 2 (under), secret 1
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 }); // the wide one
    c = secretPocket(b, c.endX, c.endRow); // crystal 3, secret 2
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 3 });
    c = runway(b, c.endX, c.endRow, { len: 6, enemy: true });
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 30 });
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 8 });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 7, period: 150 }); // the exam
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 2, period: 150 });
    c = runway(b, c.endX, c.endRow, { len: W - 16 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    // Sky overlay — the fast lane: one near-continuous canopy, two crystals.
    let s = canopyRun(b, 28, 10, { len: 104, crystal: true }); // crystal 4 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 104, crystal: true }); // crystal 5 (sky)

    /* =============== UNDER — THE DARKLIGHT GALLERY (whole act) =============
     * The counterweight to the act's blinking surface: one continuous carved
     * corridor at row 34, stamped last so nothing back-fills it. Nothing in
     * this act keeps floor in rows 30-33, so all four segments merge; the
     * phase-pit floors (row 29) and secret pockets (row 28) keep a thin roof
     * over it. Shafts sit on flat road clear of the pits, the bowl's pipes,
     * the leap launcher and every patrol range.
     */
    underGallery(b, 14, { len: 94, row: 34, shafts: [29], hazards: 1, rail: true, crystal: false });
    underGallery(b, 108, { len: 94, row: 34, shafts: [56], hazards: 1, rail: true, crystal: false });
    underGallery(b, 202, { len: 94, row: 34, shafts: [14, 38], hazards: 1, rail: true, crystal: false });
    underGallery(b, 296, { len: 75, row: 34, shafts: [37, 60], hazards: 1, rail: true, crystal: false });
  },
};
