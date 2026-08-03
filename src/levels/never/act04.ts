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
  },
};
