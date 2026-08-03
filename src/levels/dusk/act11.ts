import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  railCascade,
  leapOfFaith,
  arenaApproach,
  canopyRun,
  skySteps,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 11 — "Last Light Seawall"
 *
 * The biome finale. It opens on a surf bowl that flings a running start
 * straight onto the seawall's sky catwalks — every act opens differently,
 * and the finale opens with a launch. Everything Duskmere taught runs
 * back-to-back along the wall, the arena approach is the hard version (a
 * density-3 gauntlet on a fast clock feeding directly into the Wrecking
 * Pod's gate), and beneath it all the last sea-cave gallery runs from the
 * bowl to the arena wall. The shield pocket just before the gauntlet is the
 * reward for exploring, not a handout.
 */
export const act11: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 11',
  title: 'Last Light Seawall',
  biome: 0,
  theme: 'verdant',
  width: 400,
  bossKind: 'pod',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 8, rings: false }); // 0–7: start apron
    b.start(4, 24);
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 8–23: the surf-bowl opener
    c = runway(b, c.endX, c.endRow, { len: 16 }); // 24–39: the launch's landing runway
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // 40–97: the seawall swells
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 98–119, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 120–147, loop centre 133
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 148–155 (shaft at 152)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 156–171
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 172–190
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 191–202, secret 1 (opens into the gallery)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 150 }); // 203–220
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 221–232, up to row 21 (shaft at 229)
    c = railCascade(b, c.endX, c.endRow); // 233–263, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 264–275, back to 24 (shaft at 272)
    c = secretPocket(b, c.endX, c.endRow); // 276–285, CRYSTAL 2 + secret 2
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 286–313: blind drop to row 27
    b.crystal(299, 13); // CRYSTAL 3 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true }); // 314–327, back to 24 (shaft at 324)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 328–337, secret 3
    // The hard approach: one last fast-clock gauntlet with no breather
    // between its exit and the arena gates.
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 3, period: 140 }); // 338–351
    arenaApproach(b, c.endX, c.endRow, { width: 48 }); // 352–399: the finale arena

    b.drone(125, 18, 4); // over the loop corridor
    b.drone(250, 22, 4); // hunts along the rail cascade

    // Sky overlay: the opener bowl's fling lands on the first catwalks, and
    // from there the lane alternates catwalks and trapped steps to the wall.
    const s1 = canopyRun(b, 24, 10, { len: 78 }); // 24–101: the surf bowl's catch
    const k1 = skySteps(b, s1.endX, 10, { steps: 5, drone: true, trap: true }); // 102–139
    const s2 = canopyRun(b, k1.endX, 10, { len: 52, crystal: true }); // 140–191, CRYSTAL 5 (sky)
    const k2 = skySteps(b, s2.endX, 10, { steps: 5, trap: true, drone: false }); // 192–229
    const s3 = canopyRun(b, k2.endX, 10, { len: 78 }); // 230–307
    skySteps(b, s3.endX, 10, { steps: 4, trap: true, drone: true }); // 308–338, ending before the arena

    /* ============================ UNDER ROUTE ============================
     * The last sea-cave, carved last: from beneath the opener bowl's basin
     * (within 9 columns, keeping the under lane continuous) to the shield
     * pocket at the arena's doorstep. Shafts on plain flats only — clear of
     * the bowl, the loop corridor (120–147), the rails and the leap mesa.
     */
    underGallery(b, 26, {
      len: 304, // 26–329
      shafts: [126, 203, 246, 298], // at 152, 229, 272, 324
      hazards: 2,
      rail: true,
      crystal: true, // CRYSTAL 4 — under-lane prize beneath the phase pit
    });
  },
};
