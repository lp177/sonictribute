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

const W = 384;

/**
 * NOON TOMORROW — ACT 7: rush hour, forever. Dash pads chain like traffic
 * lights, the cart canyon stretches to the 9-tile limit, and two gauntlets
 * (the closer at density 3) book-end the act. The canopy steps down through
 * three tower blocks on rail ribbons. Fast lane: GROUND — this is the speed
 * act; hold the pads and never brake.
 */
export const act07: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 7',
  title: 'Rush Hour Forever',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 14, dashPad: true, enemy: true }); // 10–23
    c = corridorLoop(b, c.endX, c.endRow); // 24–51
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 52–59
    b.hopper(58, 24);
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 140 }); // 60–75
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 76–97, crystal 1 (sky shelf)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 98–116
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true }); // 117–123
    c = rollersRun(b, c.endX, c.endRow); // 124–181: two cycles at full tilt
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 182–193, crystal 2 (under), secret 1
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 194–213: the limit canyon
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 3 }); // 214–227
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 228–233
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 234–249
    c = secretPocket(b, c.endX, c.endRow); // 250–259, crystal 3 (ground), secret 2
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 130 }); // 260–277
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 278–285
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 22 }); // 286–315: blind drop to 27
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true }); // 316–327, up to 24
    c = secretPocket(b, c.endX, c.endRow); // 328–337, crystal 4 (ground), secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 }); // 338–355
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 28 }); // 356–383
    if (fin.endX !== W) throw new Error(`act07 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: tower blocks joined by descending rail ribbons, each rail
    // ending flush on the next block's deck.
    const s1 = canopyRun(b, 36, 10, { len: 103, crystal: true }); // crystal 5 (sky)
    b.rail(135, 10, s1.endX, 12);
    const s2 = canopyRun(b, s1.endX, 12, { len: 100 });
    // A real ribbon, not a 1-column stub: the rail spans the whole seam.
    b.rail(s2.endX - 1, 12, s2.endX + 4, 14);
    canopyRun(b, s2.endX + 4, 14, { len: 40 });
    b.drone(85, 7, 3);
    b.drone(200, 8, 3);
    b.drone(300, 7, 3);

    // Undercity metro gallery, split around the limit cart canyon (199-207,
    // ledge floor on row 30 sits in the carve band and bridges the under
    // lane itself). Late act: hazard pressure 2 (spikes + a clocked trap,
    // both far beyond idle-silence range of the start). Segment A shafts:
    // 21 (fed by the opening dash-pad straight, clear of the crab at 14-20),
    // 52 (landing feeds the pad at 55, three tiles clear of the hopper at
    // 58) and 121 (plain floor past the checkpoint) — clear of the loop at
    // 24-51. Segment B shaft: 283 (pad-fed, landing delivers you onto the
    // leap-of-faith launch pad); the sneakUnder pocket at 184-191 is
    // segment A's eastern entrance.
    underGallery(b, 12, { len: 185, shafts: [9, 40, 109], hazards: 2, crystal: false });
    underGallery(b, 210, { len: 140, shafts: [73], hazards: 2, crystal: false });
    // Service hatch in the late phase pit's floor (same grammar as act 6):
    // the slow lower route continues into the metro; twin springs beneath
    // the slot throw a faller straight back out.
    b.carve(266, 29, 267, 33);
    b.spring(266, 34, 13);
    b.spring(267, 34, 13);
  },
};
