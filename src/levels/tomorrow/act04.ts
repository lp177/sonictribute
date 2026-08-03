import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  cartCanyon,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

const W = 352;

/**
 * NOON TOMORROW — ACT 4: the maintenance district. Longer roller runs feed a
 * cart canyon, a bigger stalactite awning and the act's mid-course leap of
 * faith. Difficulty knob: hazard clocks tighten to 150–160 and the gauntlet
 * runs at density 2. Fast lane: GROUND (roll everything).
 */
export const act04: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 4',
  title: 'Static Signal Yards',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true, enemy: true }); // 10–19
    c = rollersRun(b, c.endX, c.endRow); // 20–77: two full cycles
    c = secretPocket(b, c.endX, c.endRow); // 78–87, crystal 1 (ground), secret 1
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 88–93
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 94–113
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 114–129
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 }); // 130–147
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 148–153
    c = corridorLoop(b, c.endX, c.endRow, { drop: 2, corridor: 24 }); // 154–185
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 186–197, crystal 2 (under), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 2, period: 150 }); // 198–215
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 216–223
    b.hopper(220, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 224–251: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true }); // 252–263, up to 24
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 264–285, crystal 3 (sky shelf)
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 286–301
    c = secretPocket(b, c.endX, c.endRow); // 302–311, crystal 4 (ground), secret 3
    c = runway(b, c.endX, c.endRow, { len: 16, enemy: true }); // 312–327
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 24 }); // 328–351
    if (fin.endX !== W) throw new Error(`act04 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay — lengths are 13k+8 so each chained seam stays a standard
    // 5-tile hop. The last run rides high over the leap zone (row 9 clears
    // the ring trail at rows 11–14) and hands the sky lane to the
    // stackedChoice shelves at 266.
    const s = canopyRun(b, 40, 9, { len: 112, crystal: true }); // crystal 5 (sky)
    const s2 = canopyRun(b, s.endX, s.endRow, { len: 60 });
    canopyRun(b, s2.endX, s2.endRow, { len: 60 });
    b.phasePlatform(48, 52, 9, 180, 0);
    b.phasePlatform(160, 164, 9, 180, 90); // aligned to the real 160-164 seam
    b.drone(110, 6, 3);
    b.drone(240, 7, 4);

    // Undercity metro gallery, split around the cart canyon (99-106, ledge
    // floor on row 30 — inside the gallery carve band); the ledge itself
    // carries the under lane across the 2-tile seams. Segment A shafts: 68
    // (in the second roller dip's basin, springs lift back to the dip floor)
    // and 91 (plain runway past the checkpoint). Segment B shafts: 280
    // (under a stackedChoice shelf, clear of the crab at 271-277 and the
    // shelf crystal at 279) and 313 (clear of the crab patrol at 317-323) —
    // all clear of the loop at 154-185, the leap zone at 224-251 and the
    // bowl at 286-301. The sneakUnder pocket at 188-195 merges into segment
    // B as its mid-act entrance.
    underGallery(b, 12, { len: 87, shafts: [56, 79], hazards: 1, crystal: false });
    underGallery(b, 109, { len: 214, shafts: [171, 204], hazards: 1, crystal: false });
  },
};
