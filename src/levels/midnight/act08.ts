import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  stalactiteGallery,
  rollersRun,
  phaseCrossing,
  stackedChoice,
  corridorLoop,
  sneakUnder,
  hazardGauntlet,
  secretPocket,
  boardSprint,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 8 — "Needle Roof Annex"
 *
 * The annex where the roof grew teeth: three stalactite galleries, each
 * longer and denser than the last, open the act seconds after the gate and
 * close it before the goal. Between them, the biome's new late-shift
 * mechanism appears for the first time — shift-change catwalks (hard-light
 * phase platforms) bridging the annex's two service pits.
 */
export const midnight08: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 8',
  title: 'Needle Roof Annex',
  biome: 1,
  theme: 'gear',
  width: 360,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: annex door
    b.start(4, 24);
    // The first needles hang just past the door — armed only by passing
    // beneath, so the idle-start contract still holds.
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 10–25
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 26–31
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 32–61
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 180 }); // 62–79: first shift-change catwalk
    b.crystal(70, 21); // 1 (ground) — over the phase pit, for the confident
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 80–101, crystal 2 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 102–109
    c = corridorLoop(b, c.endX, c.endRow); // 110–137
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 4 }); // 138–157: denser roof
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 158–169, crystal 3 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 130 }); // 170–185
    c = secretPocket(b, c.endX, c.endRow); // 186–195, crystal 4 (ground), secret 2
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 }); // 196–214: wider, faster
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 215–224, secret 3
    c = boardSprint(b, c.endX, c.endRow, { sections: 2 }); // 225–258
    b.drone(235, 20, 2);
    b.drone(249, 20, 2);
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 }); // 259–276: the densest roof
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 277–284
    c = quarterPipeBowl(b, c.endX, c.endRow); // 285–298
    c = runway(b, c.endX, c.endRow, { len: 20, enemy: true }); // 299–318
    signpostFinish(b, c.endX, c.endRow, { len: 41 }); // 319–359

    // Sky overlay — the only route with no teeth over it.
    let s = canopyRun(b, 44, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 52 });
  },
};
