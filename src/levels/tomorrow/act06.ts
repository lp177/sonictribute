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

const W = 384;

/**
 * NOON TOMORROW — ACT 6: the second half opens out. A wider world, a wider
 * phase gap (9 — the route-continuity limit), a four-spike awning, and the
 * act ENDS on its leap of faith: the blind drop delivers you straight onto
 * the finish straight. Fast lane: UNDER-slung — the cascade dive and the
 * deep dip carry rolling speed below the skyline.
 */
export const act06: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 6',
  title: 'Undertow Arcade',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 10–17
    c = quarterPipeBowl(b, c.endX, c.endRow); // 18–31: drop straight into the bowl
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 32–53, crystal 1 (sky shelf)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 54–72: widest gap yet
    c = runway(b, c.endX, c.endRow, { len: 7, rise: 3, checkpoint: true }); // 73–85, up to 21
    c = railCascade(b, c.endX, c.endRow); // 86–116: dive to 27
    c = runway(b, c.endX, c.endRow, { len: 5, rise: 3 }); // 117–127, up to 24
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 128–147
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 }); // 148–165
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 166–177, crystal 2 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 }); // 178–195
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 196–201
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 22 }); // 202–235: the deep loop
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 236–245, secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, depth: 3, basin: 6 }); // 246–281: deep dip
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 150 }); // 282–299
    c = secretPocket(b, c.endX, c.endRow); // 300–309, crystal 3 (ground), secret 3
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true, enemy: true }); // 310–319
    b.hopper(317, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 30 }); // 320–357: the closing blind drop
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 26 }); // 358–383, on the mesa row
    if (fin.endX !== W) throw new Error(`act06 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay.
    const s = canopyRun(b, 40, 9, { len: 120, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 110, crystal: true }); // crystal 5 (sky)
    b.phasePlatform(48, 52, 9, 170, 0);
    b.phasePlatform(168, 172, 9, 170, 85);
    b.drone(95, 6, 3);
    b.drone(215, 6, 3);

    // Undercity metro gallery, split around the cart canyon (133-140, ledge
    // floor on row 30 lives in the carve band; the ledge bridges the under
    // lane across the seams). Segment A shafts: 15 (fed by the dash pad at
    // 13) and 124 (the flat before the canyon boarding edge). Segment B
    // shaft: 269 (in the deep roller dip's basin) — clear of the deep loop
    // at 202-235, the bowl at 18-31 and the closing leap zone; the
    // sneakUnder pocket at 168-175 merges in as segment B's western
    // entrance. The under fast lane earns act 6's "UNDER-slung" billing.
    underGallery(b, 12, { len: 119, shafts: [3, 112], hazards: 1, crystal: false });
    underGallery(b, 143, { len: 213, shafts: [126], hazards: 2, crystal: false });
    // Service hatch: the late phase pit's slow lower route continues down
    // into the gallery through a 2-wide slot in the pit floor; twin springs
    // directly beneath throw a faller straight back to the surface, so the
    // hatch is a door, never a trap.
    b.carve(288, 29, 289, 33);
    b.spring(288, 34, 13);
    b.spring(289, 34, 13);
  },
};
