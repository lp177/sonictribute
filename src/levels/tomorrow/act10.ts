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
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

const W = 420;

/**
 * NOON TOMORROW — ACT 10: the campaign finale. The widest act in the game,
 * every toy in the biome at its tightest clock, and the harder arena
 * approach the finale owes: a blind leap onto the low road, then a density-3
 * gauntlet runs straight into the Mirage's plaza with no breather between.
 * Everything is still telegraphed; nothing is still forgiving.
 */
export const act10: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 10',
  title: 'The Unstruck Noon',
  biome: 3,
  theme: 'neon',
  width: W,
  bossKind: 'mirage',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true, enemy: true }); // 10–19
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 20–41, crystal 1 (sky shelf)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 42–71
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 72–90
    c = runway(b, c.endX, c.endRow, { len: 7, rise: 3, checkpoint: true, dashPad: true }); // 91–103, up to 21
    c = railCascade(b, c.endX, c.endRow); // 104–134: dive to 27
    c = runway(b, c.endX, c.endRow, { len: 7, rise: 3 }); // 135–147, up to 24
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 148–167
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 5 }); // 168–187: the long awning
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 188–199, crystal 2 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 120 }); // 200–219
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 22 }); // 220–253: the deep loop
    c = secretPocket(b, c.endX, c.endRow); // 254–263, crystal 3 (ground), secret 2
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 8 }); // 264–281
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 120 }); // 282–300
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true, enemy: true }); // 301–307
    b.hopper(306, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // 308–339: the last blind leap, to 27
    c = secretPocket(b, c.endX, c.endRow); // 340–349, crystal 4 (under band), secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 120 }); // 350–365: no breather
    const fin = arenaApproach(b, c.endX, c.endRow, { width: 54 }); // 366–419: the final plaza
    if (fin.endX !== W) throw new Error(`act10 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: the last canopy, high and long. Lengths are 13k+8 (138 =
    // 13*10+8) so the chained seam stays a standard 5-tile hop — 146 left an
    // unbridged 8-tile sky gap with the phase platform buried in solid deck.
    const s = canopyRun(b, 40, 8, { len: 138, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 112 });
    b.phasePlatform(48, 52, 8, 150, 0);
    b.phasePlatform(173, 177, 8, 150, 75); // bridges the mid-canopy seam
    b.drone(115, 5, 3);
    b.drone(235, 5, 3);
    b.drone(320, 6, 3);

    // Undercity metro gallery, in two segments ending well short of the
    // final plaza — no tunnelling under the boss arena. The cart canyon
    // (153-161, ledge floor row 30) and the post-leap secret pocket (room
    // floor row 31 at 342-348) sit in the carve band, so the corridor stops
    // either side and those floors bridge the under lane (seams of 2-4
    // tiles). Segment A shafts: 36 (under a stackedChoice shelf, clear of
    // the crab at 27-33 and the shelf crystal at 35) and 143 (the flat
    // before the canyon boarding edge), plus a service hatch in the first
    // phase pit. Segment B shaft: 165 (two tiles past the cart's crash
    // buffer at 163 — the ride still sets you down on solid floor), plus a
    // hatch in the late phase pit; the sneakUnder pocket at 190-197 merges
    // in. All clear of the deep loop at 220-253, both gauntlets, the wide
    // bowl and the rail cascade. Finale pressure: hazards 2 in both halves.
    underGallery(b, 12, { len: 139, shafts: [24, 131], hazards: 2, crystal: false });
    underGallery(b, 164, { len: 174, shafts: [1], hazards: 2, crystal: false });
    // The hatches: each phase pit's slow lower route continues into the
    // metro; twin springs directly beneath throw a faller straight back to
    // the surface, so the hatches are doors, never traps.
    b.carve(79, 29, 80, 33);
    b.spring(79, 34, 13);
    b.spring(80, 34, 13);
    b.carve(289, 29, 290, 33);
    b.spring(289, 34, 13);
    b.spring(290, 34, 13);
    // Flickering service light over segment B's spike strip.
    b.phasePlatform(241, 244, 31, 150, 75);
  },
};
