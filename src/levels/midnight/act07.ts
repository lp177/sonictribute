import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  boardSprint,
  leapOfFaith,
  corridorLoop,
  stackedChoice,
  sneakUnder,
  railCascade,
  hazardGauntlet,
  secretPocket,
  cartCanyon,
  stalactiteGallery,
  rollersRun,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 7 — "Skyhook Expressway"
 *
 * Back on the skyway, but higher: the sky lane is the fast lane this act.
 * The Mag-Board fires seconds after the gate, a leap of faith launches the
 * runner straight into catwalk altitude, and the catwalks themselves carry
 * monitors — the reward for staying up. The ground chain runs a row high
 * (22) the whole way to keep the climb into the sky short.
 */
export const midnight07: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 7',
  title: 'Skyhook Expressway',
  biome: 1,
  theme: 'gear',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 22, { len: 10, rings: false }); // 0–9: expressway ramp
    b.start(4, 22);
    c = runway(b, c.endX, c.endRow, { len: 6, rings: false, dashPad: true }); // 10–15
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 16–63: board out of the gate
    b.drone(26, 17, 2);
    b.drone(54, 17, 2);
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 64–71
    c = leapOfFaith(b, c.endX, c.endRow, { drop: 3, glide: 22 }); // 72–101: fling into catwalk height
    b.crystal(94, 6); // 1 (sky) — above the catwalk the leap lands beside
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // 102–113, back to row 22
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 24 }); // 114–149
    c = stackedChoice(b, c.endX, c.endRow, { len: 26, crystal: true }); // 150–175, crystal 2 (sky shelf)
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 176–187, crystal 3 (under), secret 1
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 7, span: 8, dropEach: 2 }); // 188–222, to row 26
    c = runway(b, c.endX, c.endRow, { rise: 2, len: 6 }); // 223–232, back to row 24
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 130 }); // 233–250
    c = secretPocket(b, c.endX, c.endRow); // 251–260, crystal 4 (ground), secret 2
    c = cartCanyon(b, c.endX, c.endRow); // 261–280
    b.drone(269, 21, 2);
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 281–290, secret 3
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 291–306
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 307–314
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 315–344
    signpostFinish(b, c.endX, c.endRow, { len: 35 }); // 345–379

    // The express catwalks sit at row 8 — above the leap arc's ring trail
    // (rows 9+) so no platform tile can bury a leap ring — and carry the
    // monitors that make the sky line worth holding.
    let s = canopyRun(b, 84, 8, { len: 104, crystal: true }); // crystal 5 (sky)
    b.monitor(56, 8, 'rings10');
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    b.monitor(160, 8, 'shoes');
    canopyRun(b, s.endX, s.endRow, { len: 104 });

    // Under the expressway: the utility bore, three segments. The sneak-under
    // pocket (floor 32, cols 178–185) and the cart canyon ledge (floor 30,
    // cols 266–272) stay as raised side-chambers — each opens onto the bore
    // with a two-to-four-row hop, so they are doors, not breaks. Shafts: the
    // gate runway (8), under the stacked-choice west platform (155), the
    // climb-out runway (229), between stalactites (296) and the run-out
    // (358) — clear of the board decks (16–63), the leap (72–101), the loop
    // corridor (114–149), the rail steps and the full-density gauntlet.
    underGallery(b, 4, { len: 174, row: 34, shafts: [4, 151], hazards: 2, crystal: false });
    underGallery(b, 186, { len: 80, row: 34, shafts: [43], hazards: 2, crystal: false });
    underGallery(b, 273, { len: 100, row: 34, shafts: [23, 85], hazards: 2, crystal: false });
  },
};
