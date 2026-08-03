import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  quarterPipeBowl,
  railCascade,
  stackedChoice,
  sneakUnder,
  cartCanyon,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  leapOfFaith,
  rollersRun,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 4 — "Rivet Gantry Rush"
 *
 * The riveting yard: gantries, grind rails and the biome's first ore cart.
 * Opens with a sunken half-pipe bowl straight off the gate ramp, drops three
 * rail steps to the yard floor, and introduces the minecart canyon — ride the
 * cart over the gap and bail before the buffer, or pay the crash. Ends on a
 * second leap of faith with a crystal at the top of the arc.
 */
export const midnight04: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 4',
  title: 'Rivet Gantry Rush',
  biome: 1,
  theme: 'gear',
  width: 340,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: yard gate
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, rings: false, dashPad: true }); // 10–21, up to row 21
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 22–37: the rivet bowl
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 38–43
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 6, span: 7, dropEach: 2 }); // 44–88, down to row 27
    b.drone(67, 21, 2); // hovers over the middle rail line
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 89–100, back to row 24
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 101–122, crystal 1 (sky shelf)
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 123–134, crystal 2 (under), secret 1
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 135–154: the first ore cart
    b.drone(143, 22, 2); // patrols the canyon airspace the bailers fly through
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 155–162
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 163–178
    c = secretPocket(b, c.endX, c.endRow); // 179–188, crystal 3 (ground), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 2, period: 140 }); // 189–206
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 207–216, secret 3
    c = leapOfFaith(b, c.endX, c.endRow, { drop: 3, glide: 24 }); // 217–248: over the gantry edge
    b.crystal(238, 9); // 4 (sky) — at the crest of the leap, beside the catwalk
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true }); // 249–262, back to row 24
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 263–292
    signpostFinish(b, c.endX, c.endRow, { len: 47 }); // 293–339

    // Sky overlay at row 10 (leap ring trail tops out at row 11 — no clash).
    let s = canopyRun(b, 44, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 39 });
  },
};
