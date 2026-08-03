import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  railCascade,
  cartCanyon,
  sneakUnder,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

const W = 352;

/**
 * NOON TOMORROW — ACT 3: the sky-rail act. Two grind cascades on the ground,
 * a rail-ribbon canopy that steps DOWN between tower blocks (run off a shelf
 * lip to catch each connecting rail), and the biome's first minecart canyon.
 * Fast lane: SKY, if you can hold the ribbon; the ground pays in dash pads.
 */
export const act03: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 3',
  title: 'Ribbonrail Junction',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    // This act enters high (row 21) so the opening rail cascade has room to
    // spend six rows of height on speed.
    let c = runway(b, 0, 21, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 21);
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 10–17
    c = railCascade(b, c.endX, c.endRow); // 18–48: the tutorial cascade, to row 27
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true }); // 49–60, up to 24
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 61–82, crystal 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 83–110
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 111–118
    b.hopper(113, 24);
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 119–138: first cart — bail or pay
    c = secretPocket(b, c.endX, c.endRow); // 139–148, crystal 2 (ground), secret 1
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 149–166
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 167–172
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 173–202
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 203–214, crystal 3 (under), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 }); // 215–230
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 231–238
    c = railCascade(b, c.endX, c.endRow, { dropEach: 1 }); // 239–269: shallow rails, to row 26
    c = runway(b, c.endX, c.endRow, { len: 8, rise: 2, checkpoint: true }); // 270–281, up to 24
    c = quarterPipeBowl(b, c.endX, c.endRow); // 282–295
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 296–305, secret 3
    c = runway(b, c.endX, c.endRow, { len: 20, dashPad: true, enemy: true }); // 306–325
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 26 }); // 326–351
    if (fin.endX !== W) throw new Error(`act03 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: three tower blocks of canopy stepping downward, joined by
    // grind-rail ribbons. Each rail ends exactly on the next block's deck, so
    // the ride always sets you down on real floor.
    const s1 = canopyRun(b, 36, 10, { len: 90, crystal: true }); // crystal 4 (sky)
    b.rail(122, 10, s1.endX, 12); // ribbon 1: off the block-1 lip
    const s2 = canopyRun(b, s1.endX, 12, { len: 91, crystal: true }); // crystal 5 (sky)
    b.rail(212, 12, s2.endX, 14); // ribbon 2: down to the low block
    canopyRun(b, s2.endX, 14, { len: 65 });
    b.drone(90, 7, 3);
    b.drone(150, 9, 3);
    b.drone(250, 11, 3);

    // Undercity metro gallery, in two segments: the cart canyon's carved pit
    // (124-130, consolation ledge on row 30) sits exactly in the gallery's
    // carve band, so the corridor stops either side of it and the canyon
    // ledge itself carries the under lane across (gaps of 2 tiles, well
    // under the 9-tile route-continuity limit). Segment A shafts: 15 (fed by
    // the dash pad at 13) and 76 (under a stackedChoice shelf, clear of the
    // crab at 68-74). Segment B shafts: 236 and 278 (both dash-pad fed) and
    // 321 (the last exit before the finish straight) — all clear of the loop
    // at 83-110, both rail cascades and the bowl at 282-295. The sneakUnder
    // pocket at 205-212 merges into segment B as a mid-act entrance.
    underGallery(b, 12, { len: 110, shafts: [3, 64], hazards: 1, crystal: false });
    underGallery(b, 133, { len: 191, shafts: [103, 145, 188], hazards: 1, crystal: false });
  },
};
