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
} from '../motifs.ts';

const W = 400;

/**
 * NOON TOMORROW — ACT 8: the mixing act. Carts, rails and phase gates stop
 * taking turns: two cart canyons, a rail cascade fed by a dash pad, and both
 * phase crossings at the 9-tile limit on 130–140 frame clocks. The gauntlet
 * runs density 3 at 130. Fast lane: rotates — sky first third, ground
 * middle, and the finale drops you low. Leap of faith before the finish.
 */
export const act08: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 8',
  title: 'Vertigo Concourse',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 10–31, crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 32–39
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 40–59: cart straight out of the gate
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 60–78
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true }); // 79–85
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 86–101
    c = corridorLoop(b, c.endX, c.endRow, { drop: 2, corridor: 24 }); // 102–133
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 134–145, crystal 2 (under), secret 1
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, dashPad: true }); // 146–157, up to 21
    c = railCascade(b, c.endX, c.endRow, { run: 5, span: 8 }); // 158–188: long rails, to 27
    c = runway(b, c.endX, c.endRow, { len: 5, rise: 3, checkpoint: true }); // 189–199, up to 24
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 130 }); // 200–219
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 8 }); // 220–237: the wide bowl
    c = secretPocket(b, c.endX, c.endRow); // 238–247, crystal 3 (ground), secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 248–277
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 278–297: second cart, at the limit
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 130 }); // 298–316
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true, enemy: true }); // 317–323
    b.hopper(322, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 28 }); // 324–359: blind drop to 27
    c = secretPocket(b, c.endX, c.endRow); // 360–369, crystal 4 (under band), secret 3
    c = runway(b, c.endX, c.endRow, { len: 10, enemy: true }); // 370–379
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 20 }); // 380–399
    if (fin.endX !== W) throw new Error(`act08 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: the high concourse, up at row 8 now.
    const s = canopyRun(b, 40, 8, { len: 140, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 125 });
    b.phasePlatform(48, 52, 8, 160, 0);
    b.phasePlatform(188, 192, 8, 160, 80);
    b.drone(120, 5, 3);
    b.drone(260, 5, 3);
    b.drone(340, 10, 3);
  },
};
