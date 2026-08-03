import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  stackedChoice,
  hazardGauntlet,
  corridorLoop,
  sneakUnder,
  phaseCrossing,
  railCascade,
  rollersRun,
  stalactiteGallery,
  secretPocket,
  quarterPipeBowl,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 9 — "Nevergleam Ascent"
 *
 * The last ordinary act climbs: the running lane rises to row 21 early and
 * stays high, the shelf lane of the opening choice floats a full nine rows
 * up, and the SKY canopy is the fast route for its first two thirds. Everything below
 * runs on end-of-biome clocks — 150-frame phase lights, a five-spike roof,
 * a density-3 gauntlet — before the leap drops you to the signpost run.
 */
const W = 400;

export const act09: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 9',
  title: 'Nevergleam Ascent',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true, lift: 9 }); // crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // the climb begins
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 2, period: 160 });
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 22 });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 2 (under), secret 1
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 });
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 5, span: 8, dropEach: 2 });
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, checkpoint: true });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 }); // the five-spike roof
    c = secretPocket(b, c.endX, c.endRow); // crystal 3, secret 2
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 });
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 140 });
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 30 }); // the drop off the ascent
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, checkpoint: true });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // secret 3
    c = runway(b, c.endX, c.endRow, { len: W - 16 - c.endX });
    signpostFinish(b, c.endX, c.endRow);

    // Sky overlay — the fast lane, one crystal.
    const s = canopyRun(b, 34, 9, { len: 117, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
    b.crystal(280, 7); // crystal 5 — the gleam above the bowl (sky)
  },
};
