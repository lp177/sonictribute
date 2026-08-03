import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 2 — "Gullwing Causeway"
 *
 * A long rolling causeway over the bay. The act teaches the launch ramp as a
 * door to the sky: the canopy catwalks are the fast lane here, entered off
 * the mid-act ramp, while the ground road pays a toll of pendulums and one
 * gentle spike gauntlet. Clocked hazards all sit far past AMBIENT_RANGE of
 * the start, so an idle hero on the first apron hears nothing.
 */
export const act02: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 2',
  title: 'Gullwing Causeway',
  biome: 0,
  theme: 'verdant',
  width: 340,
  build(b: LevelBuilder): void {
    // Ground chain, left to right (each motif lays its own ground).
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: the start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // 22–79: the causeway swells
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 80–101, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 102–109
    c = corridorLoop(b, c.endX, c.endRow); // 110–137
    c = secretPocket(b, c.endX, c.endRow); // 138–147, CRYSTAL 2 + secret 1

    // Launch set piece (148–169): the door to the canopy. Ease back down off
    // the pad — a hard step after a launcher strands slow arrivals.
    b.launchRamp(148, 24, 3); // 148–155, pad tops out on row 21
    b.gentleDown(156, 21, 3); // 156–161, back to row 24
    b.floor(162, 169, 24);
    b.ringsH(163, 168, 21);
    c = { endX: 170, endRow: 24 };

    // Pendulum reef (170–189): two swing balls bracketing a crumble ledge —
    // pure timing, fully visible, no clocks that chirp unprompted.
    b.floor(170, 189, 24);
    b.swingBall(175, 14, 9, 160, 0);
    b.crumble(180, 182, 20);
    b.ringsH(180, 182, 18);
    b.swingBall(185, 14, 9, 160, 80);
    b.ringsH(171, 178, 21);
    c = { endX: 190, endRow: 24 };

    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 190–201, CRYSTAL 3 (under) + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 12, density: 1 }); // 202–213: one telegraphed trap
    c = secretPocket(b, c.endX, c.endRow); // 214–223, CRYSTAL 4 + secret 3
    c = runway(b, c.endX, c.endRow, { len: 12, checkpoint: true, enemy: true }); // 224–235
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 236–265
    c = runway(b, c.endX, c.endRow, { len: 20 }); // 266–285
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 286–315
    c = runway(b, c.endX, c.endRow, { len: 8, rings: false }); // 316–323
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 324–339

    // Sky overlay, stamped after the ground chain. It starts within 9 columns
    // of the stacked-choice shelves so the sky lane reads as one route.
    const s = canopyRun(b, 104, 9, { len: 117, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 111 });
  },
};
