import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  quarterPipeBowl,
  phaseCrossing,
  sneakUnder,
  cartCanyon,
  stalactiteGallery,
  stackedChoice,
  secretPocket,
  hazardGauntlet,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 8 — "Crystal Undertow"
 *
 * The skate park: FOUR quarter-pipe bowls with basins of every width the
 * route rule allows (4, 8, 6, 9), strung on deep rolling swells — enter
 * rolling and the act
 * plays itself as launches; enter walking and every bowl is a climbable
 * cradle. The undertow pulls both ways: the widest cart canyon and the
 * tightest phase clock in the biome so far sit mid-act. Fast lane: ground.
 */
const W = 408;

export const act08: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 8',
  title: 'Crystal Undertow',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, depth: 3, basin: 6 }); // the swells
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // bowl 1
    c = runway(b, c.endX, c.endRow, { len: 4 });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 8 }); // bowl 2
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 150 });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // bowl 3
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 1 (under), secret 1
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // the widest canyon
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 });
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 2 (sky shelf)
    c = secretPocket(b, c.endX, c.endRow); // crystal 3, secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 150 });
    c = runway(b, c.endX, c.endRow, { len: 6 });
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 32 }); // the long blind glide
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 9 }); // bowl 4, the wide goodbye
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 3
    c = runway(b, c.endX, c.endRow, { len: W - 16 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    // A drone rides the swell thermals near the start's hills.
    b.drone(60, 17, 3);

    // Sky overlay: the calm above the undertow, one crystal.
    const s = canopyRun(b, 30, 10, { len: 117, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
    b.crystal(288, 8); // crystal 5 — high over the gauntlet, ride the leap-of-faith arc
  },
};
