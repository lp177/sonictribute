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
  underGallery,
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

    /* ================ UNDER — THE UNDERTOW ITSELF (whole act) ==============
     * The name finally earns its keep: a carved route at row 34 pulled under
     * every bowl and swell. It breaks only at the cart canyon's deep ledge
     * (175-183, floor row 30) — standable under-lane floor that bridges the
     * route — and re-enters past the last bowl's pocket. Shafts punch hill
     * crowns and flat road, clear of every pipe, dash pad, cart track,
     * gauntlet clock and patrol range.
     */
    // hazards 0: shaft springs at the second swell crown sit where the motif
    // would put its spikes.
    underGallery(b, 14, { len: 81, row: 34, shafts: [3, 37], hazards: 0, rail: true, crystal: false });
    underGallery(b, 95, { len: 80, row: 34, shafts: [0, 43], hazards: 1, rail: true, crystal: false });
    // hazards 0: the surface gauntlet above this stretch is teeth enough.
    underGallery(b, 184, { len: 82, row: 34, shafts: [2, 38], hazards: 0, rail: true, crystal: false });
    underGallery(b, 266, { len: 80, row: 34, shafts: [14, 58], hazards: 1, rail: true, crystal: false });
    // hazards 0: this stretch owns the finish runway's shaft springs.
    underGallery(b, 352, { len: 40, row: 34, shafts: [6, 27], hazards: 0, crystal: false });
  },
};
