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
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 11 — "Last Light Seawall"
 *
 * The biome finale. Everything Duskmere taught runs back-to-back along the
 * seawall, and the arena approach is the hard version: a density-3 hazard
 * gauntlet on a fast clock feeds directly into the Wrecking Pod's gate, so
 * arriving with rings means reading one last rhythm under pressure. The
 * shield pocket just before it is the reward for exploring, not a handout.
 */
export const act11: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 11',
  title: 'Last Light Seawall',
  biome: 0,
  theme: 'verdant',
  width: 400,
  bossKind: 'pod',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // 20–77: the seawall swells
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 78–99, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 100–127
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 128–135
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 5 }); // 136–150
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 151–166
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 167–185
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 186–197, CRYSTAL 2 (under) + secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 150 }); // 198–215
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 216–227, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 228–258, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // 259–270, back to 24
    c = secretPocket(b, c.endX, c.endRow); // 271–280, CRYSTAL 3 + secret 2
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 281–308: blind drop to row 27
    b.crystal(294, 13); // CRYSTAL 4 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true }); // 309–322, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 323–332, secret 3
    // The hard approach: one last fast-clock gauntlet with no breather
    // between its exit and the arena gates.
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 15, density: 3, period: 140 }); // 333–347
    arenaApproach(b, c.endX, c.endRow, { width: 52 }); // 348–399: the finale arena

    b.drone(105, 18, 4); // over the loop corridor
    b.drone(250, 22, 4); // hunts along the rail cascade

    // Sky overlay, joined to the stacked shelves.
    const s = canopyRun(b, 60, 8, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 130 });
  },
};
