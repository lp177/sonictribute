import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stalactiteGallery,
  secretPocket,
  stackedChoice,
  phaseCrossing,
  sneakUnder,
  hazardGauntlet,
  leapOfFaith,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 2 — "Stalactite Choir"
 *
 * The roof is the theme: three galleries of hanging crystal, each longer and
 * denser than the last, teach "keep moving under the spikes" as a rhythm.
 * Between them, the biome's first phase-light crossings on forgiving clocks
 * and the biome's first blind leap. Fast lane: ground (rolling straight
 * through every gallery); the canopy above is the calm detour.
 */
const W = 384;

export const act02: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 2',
  title: 'Stalactite Choir',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 2 }); // verse 1
    c = secretPocket(b, c.endX, c.endRow); // crystal 1, secret 1
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true });
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 2 (sky shelf)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 }); // verse 2
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 6, period: 210 });
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 3 (under), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 1, period: 170 });
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // the biome's first blind drop
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // verse 3
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 });
    c = secretPocket(b, c.endX, c.endRow); // crystal 4, secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 7, period: 180 });
    c = runway(b, c.endX, c.endRow, { len: W - 16 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    // Sky overlay, stamped after the ground chain per the build-order rule.
    const s = canopyRun(b, 30, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX + 104, s.endRow, { len: 91 });
  },
};
