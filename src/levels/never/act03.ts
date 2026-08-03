import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  cartCanyon,
  railCascade,
  corridorLoop,
  sneakUnder,
  quarterPipeBowl,
  secretPocket,
  hazardGauntlet,
  rollersRun,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 3 — "Cartfall Chasm"
 *
 * The minecart act: three canyons, each wider than the last, each crossed by
 * a cart that WILL crash at its buffer — the first is right at the start so
 * "jump before the end" is learned with a six-tile fall as the only stake.
 * A rail cascade stitches the canyons together. Fast lane: the carts and
 * rails themselves; the canopy is the coward's bypass.
 */
const W = 400;

export const act03: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 3',
  title: 'Cartfall Chasm',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 21, { len: 10, rings: false });
    b.start(4, 21);
    c = cartCanyon(b, c.endX, c.endRow, { gap: 6 }); // the tutorial crash
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true });
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 6, span: 7, dropEach: 3 });
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true });
    c = corridorLoop(b, c.endX, c.endRow);
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 1 (under), secret 1
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // the middle canyon
    c = runway(b, c.endX, c.endRow, { len: 6, enemy: true });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 });
    c = secretPocket(b, c.endX, c.endRow); // crystal 2, secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 160 });
    c = runway(b, c.endX, c.endRow, { len: 4 });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // the widest fall
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 3 (sky shelf)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 3
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 26 });
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: W - 16 - 6 - c.endX });
    signpostFinish(b, c.endX, c.endRow);

    // Sky overlay: two canopy stretches, each carrying a crystal.
    const s = canopyRun(b, 40, 10, { len: 117, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117, crystal: true }); // crystal 5 (sky)

    /* ================ UNDER — THE CARTFALL UNDERCUT (whole act) ============
     * A biome-length carved route at row 34 beneath the canyons. It breaks
     * only at the two deep canyon ledges (126-133 and 198-206, floor row 30)
     * — those ledges are themselves standable under-lane floor, so they
     * bridge the route across the skips. Shafts avoid the cart tracks and
     * buffers, the loop's run-up corridor (81-108) and every patrol.
     */
    // The long western run: entered under the rail cascade's safety floors.
    underGallery(b, 14, { len: 112, row: 34, shafts: [28], hazards: 1, rail: true, crystal: false });
    // And, on theme, a cart crossing the undercut below the loop corridor.
    b.cartRide(80, 34, 100, 34);
    // Between the two deep canyons.
    underGallery(b, 134, { len: 64, row: 34, shafts: [3, 55], hazards: 1, rail: true, crystal: false });
    // The eastern runs, split so each stays stocked and entered.
    underGallery(b, 207, { len: 84, row: 34, shafts: [2, 60], hazards: 1, rail: true, crystal: false });
    underGallery(b, 291, { len: 86, row: 34, shafts: [24, 64, 78], hazards: 1, rail: true, crystal: false });
  },
};
