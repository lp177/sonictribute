import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  railCascade,
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

const W = 400;

/**
 * NOON TOMORROW — ACT 9: the hardest signpost act in the campaign. Every
 * clock runs at 120–130, both gauntlets are density 3, the phase gaps sit at
 * the 9-tile limit, and the act closes leap-of-faith INTO a cart canyon on
 * the low road. All of it stays telegraphed; none of it waits for you.
 * Fast lane: SKY rail ribbons — the ground is where the traps are.
 */
export const act09: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 9',
  title: 'Skyline Curfew',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 22–51
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 52–70: the fast blink
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true, enemy: true }); // 71–77
    b.hopper(76, 24);
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 78–97
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 120 }); // 98–117
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 118–139, crystal 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 140–167
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 5 }); // 168–185: dense awning
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 186–197, crystal 2 (under), secret 1
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true, dashPad: true }); // 198–209, up to 21
    c = railCascade(b, c.endX, c.endRow); // 210–240: dive to 27
    c = runway(b, c.endX, c.endRow, { len: 5, rise: 3 }); // 241–251, up to 24
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 252–270
    c = quarterPipeBowl(b, c.endX, c.endRow); // 271–284
    c = secretPocket(b, c.endX, c.endRow); // 285–294, crystal 3 (ground), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 130 }); // 295–310
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 311–316
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 30 }); // 317–354: blind drop to 27
    c = secretPocket(b, c.endX, c.endRow); // 355–364, crystal 4 (under band), secret 3
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 365–384: the last cart, on the low road
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 15 }); // 385–399
    if (fin.endX !== W) throw new Error(`act09 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: two blocks joined by a rail ribbon, high at row 8.
    const s1 = canopyRun(b, 36, 8, { len: 129, crystal: true }); // crystal 5 (sky)
    b.rail(161, 8, s1.endX, 10);
    canopyRun(b, s1.endX, 10, { len: 115 });
    b.drone(130, 5, 3);
    b.drone(225, 6, 3);
    b.drone(300, 5, 3);

    // Undercity metro gallery, in two segments. The first cart canyon
    // (83-91, ledge floor row 30), the post-leap secret pocket (room floor
    // row 31 at 357-363) and the low-road canyon (370-376, ledge floor row
    // 33) all live in the gallery's carve band, so the corridor stops short
    // of each and those floors carry the under lane across (seams of 2-6
    // tiles, limit 9). Segment A shaft: 17 (fed by the dash pad at 13), plus
    // a service hatch in the first phase pit's floor. Segment B shafts: 134
    // (under a stackedChoice shelf, clear of the crab at 125-131 and the
    // shelf crystal at 133) and 248 (the flat before the second phase gate)
    // — clear of the loop at 140-167, both gauntlets and the bowl; the
    // sneakUnder pocket at 188-195 merges in as a mid entrance.
    underGallery(b, 12, { len: 69, shafts: [5], hazards: 1, crystal: false });
    underGallery(b, 94, { len: 259, shafts: [40, 154], hazards: 2, crystal: false });
    // The hatch: the pit's slow lower route continues into the metro; twin
    // springs directly beneath throw a faller straight back to the surface.
    b.carve(59, 29, 60, 33);
    b.spring(59, 34, 13);
    b.spring(60, 34, 13);
    // Flickering service light over segment B's spike strip — undercity
    // dressing and a blink-timed hop line for anyone reading the rhythm.
    b.phasePlatform(209, 212, 31, 160, 0);
  },
};
